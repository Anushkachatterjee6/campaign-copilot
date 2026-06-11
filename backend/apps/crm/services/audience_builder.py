import json
import os
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Count, DecimalField, Max, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.crm.models import Channel, ChurnRisk, Customer
from apps.crm.prompts.audience_builder import (
    AUDIENCE_BUILDER_SYSTEM_PROMPT,
    build_audience_builder_user_prompt,
)


ALLOWED_CATEGORIES = {"Coffee", "Beauty", "Fashion", "Electronics", "General"}
ALLOWED_CHANNELS = {choice.value for choice in Channel}
ALLOWED_CHURN_RISKS = {choice.value for choice in ChurnRisk}


class AudienceBuilderError(Exception):
    default_code = "AUDIENCE_BUILDER_ERROR"


class AudienceBuilderConfigurationError(AudienceBuilderError):
    default_code = "OPENAI_NOT_CONFIGURED"


class AudienceBuilderOpenAIError(AudienceBuilderError):
    default_code = "OPENAI_REQUEST_FAILED"


class AudienceFilterValidationError(AudienceBuilderError):
    default_code = "INVALID_AUDIENCE_FILTERS"


@dataclass(frozen=True)
class AudienceResult:
    filters: dict[str, Any]
    audience_size: int
    avg_spend: int
    top_city: str | None


class AudienceBuilderService:
    filter_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            # All monetary thresholds are in INR
            "min_total_spend": {"type": "number", "minimum": 0},
            "inactive_days": {"type": "integer", "minimum": 1},
            "cities": {
                "type": "array",
                "items": {"type": "string"},
            },
            "categories": {
                "type": "array",
                "items": {"type": "string", "enum": sorted(ALLOWED_CATEGORIES)},
            },
            "preferred_channels": {
                "type": "array",
                "items": {"type": "string", "enum": sorted(ALLOWED_CHANNELS)},
            },
            # RFM filters (from Customer.rfm_score and Customer.churn_risk)
            "min_rfm_score": {"type": "integer", "minimum": 1, "maximum": 5},
            "churn_risk": {
                "type": "string",
                "enum": sorted(ALLOWED_CHURN_RISKS),
            },
        },
        "required": [],
    }

    def build_audience(self, user_input: str) -> AudienceResult:
        filters = self.convert_natural_language_to_filters(user_input)
        validated_filters = self.validate_filters(filters)
        return self.generate_audience(validated_filters)

    def convert_natural_language_to_filters(self, user_input: str) -> dict[str, Any]:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise AudienceBuilderConfigurationError("OPENAI_API_KEY is not configured.")

        try:
            from openai import OpenAI
        except ImportError as exc:
            raise AudienceBuilderConfigurationError(
                "The openai package is not installed. Install backend/requirements.txt."
            ) from exc

        client = OpenAI(api_key=api_key)
        model = os.environ.get("OPENAI_AUDIENCE_MODEL", "gpt-4o-mini")

        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": AUDIENCE_BUILDER_SYSTEM_PROMPT,
                    },
                    {
                        "role": "user",
                        "content": build_audience_builder_user_prompt(user_input),
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0,
            )
        except Exception as exc:
            raise AudienceBuilderOpenAIError("OpenAI could not parse the audience request.") from exc

        try:
            raw = response.choices[0].message.content or "{}"
            return json.loads(raw)
        except (AttributeError, TypeError, json.JSONDecodeError) as exc:
            raise AudienceBuilderOpenAIError("OpenAI returned an invalid audience filter payload.") from exc

    def validate_filters(self, filters: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(filters, dict):
            raise AudienceFilterValidationError("Filters must be a JSON object.")

        allowed_fields = {
            "min_total_spend",
            "inactive_days",
            "cities",
            "categories",
            "preferred_channels",
            "min_rfm_score",
            "churn_risk",
        }
        unknown_fields = set(filters) - allowed_fields
        if unknown_fields:
            raise AudienceFilterValidationError(
                f"Unsupported filter fields: {', '.join(sorted(unknown_fields))}."
            )

        validated: dict[str, Any] = {}

        if "min_total_spend" in filters:
            try:
                min_total_spend = Decimal(str(filters["min_total_spend"]))
            except Exception as exc:
                raise AudienceFilterValidationError("min_total_spend must be numeric.") from exc
            if min_total_spend < 0:
                raise AudienceFilterValidationError("min_total_spend must be greater than or equal to 0.")
            validated["min_total_spend"] = min_total_spend

        if "inactive_days" in filters:
            try:
                inactive_days = int(filters["inactive_days"])
            except (TypeError, ValueError) as exc:
                raise AudienceFilterValidationError("inactive_days must be an integer.") from exc
            if inactive_days < 1:
                raise AudienceFilterValidationError("inactive_days must be at least 1.")
            validated["inactive_days"] = inactive_days

        if "cities" in filters:
            validated["cities"] = self._validate_string_list(filters["cities"], "cities")

        if "categories" in filters:
            categories = self._validate_string_list(filters["categories"], "categories")
            invalid_categories = set(categories) - ALLOWED_CATEGORIES
            if invalid_categories:
                raise AudienceFilterValidationError(
                    f"Unsupported categories: {', '.join(sorted(invalid_categories))}."
                )
            validated["categories"] = categories

        if "preferred_channels" in filters:
            channels = [value.lower() for value in self._validate_string_list(filters["preferred_channels"], "preferred_channels")]
            invalid_channels = set(channels) - ALLOWED_CHANNELS
            if invalid_channels:
                raise AudienceFilterValidationError(
                    f"Unsupported preferred_channels: {', '.join(sorted(invalid_channels))}."
                )
            validated["preferred_channels"] = channels

        if "min_rfm_score" in filters:
            try:
                min_rfm = int(filters["min_rfm_score"])
            except (TypeError, ValueError) as exc:
                raise AudienceFilterValidationError("min_rfm_score must be an integer.") from exc
            if not 1 <= min_rfm <= 5:
                raise AudienceFilterValidationError("min_rfm_score must be between 1 and 5.")
            validated["min_rfm_score"] = min_rfm

        if "churn_risk" in filters:
            churn_risk = str(filters["churn_risk"]).lower().strip()
            if churn_risk not in ALLOWED_CHURN_RISKS:
                raise AudienceFilterValidationError(
                    f"churn_risk must be one of: {', '.join(sorted(ALLOWED_CHURN_RISKS))}."
                )
            validated["churn_risk"] = churn_risk

        if not validated:
            raise AudienceFilterValidationError("At least one valid audience filter is required.")

        return validated

    def generate_audience(self, filters: dict[str, Any]) -> AudienceResult:
        queryset = Customer.objects.annotate(
            total_spend=Coalesce(
                Sum("orders__amount"),
                Value(Decimal("0"), output_field=DecimalField(max_digits=12, decimal_places=2)),
            ),
            last_order_date=Max("orders__order_date"),
            order_count=Count("orders"),
        )

        if "min_total_spend" in filters:
            queryset = queryset.filter(total_spend__gt=filters["min_total_spend"])

        if "inactive_days" in filters:
            cutoff = timezone.now() - timedelta(days=filters["inactive_days"])
            queryset = queryset.filter(last_order_date__lt=cutoff)

        if filters.get("cities"):
            queryset = queryset.filter(city__in=filters["cities"])

        if filters.get("preferred_channels"):
            queryset = queryset.filter(preferred_channel__in=filters["preferred_channels"])

        if filters.get("categories"):
            queryset = queryset.filter(orders__category__in=filters["categories"]).distinct()

        if "min_rfm_score" in filters:
            queryset = queryset.filter(rfm_score__gte=filters["min_rfm_score"])

        if "churn_risk" in filters:
            queryset = queryset.filter(churn_risk=filters["churn_risk"])

        matched_customers = list(queryset.values("id", "total_spend"))
        audience_size = len(matched_customers)
        total_spend = sum((row["total_spend"] or Decimal("0") for row in matched_customers), Decimal("0"))
        avg_spend = int(total_spend / audience_size) if audience_size else 0

        top_city_row = (
            queryset.exclude(city="")
            .values("city")
            .annotate(customer_count=Count("id", distinct=True))
            .order_by("-customer_count", "city")
            .first()
        )

        public_filters = dict(filters)
        if "min_total_spend" in public_filters:
            public_filters["min_total_spend"] = float(public_filters["min_total_spend"])

        return AudienceResult(
            filters=public_filters,
            audience_size=audience_size,
            avg_spend=avg_spend,
            top_city=top_city_row["city"] if top_city_row else None,
        )

    def _validate_string_list(self, value: Any, field_name: str) -> list[str]:
        if not isinstance(value, list):
            raise AudienceFilterValidationError(f"{field_name} must be a list.")
        if not all(isinstance(item, str) and item.strip() for item in value):
            raise AudienceFilterValidationError(f"{field_name} must contain only non-empty strings.")
        return [item.strip() for item in value]
