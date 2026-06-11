import json
import os
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Count, DecimalField, Max, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.crm.models import Channel, Customer
from apps.crm.prompts.campaign_copilot import (
    CAMPAIGN_COPILOT_SYSTEM_PROMPT,
    build_campaign_copilot_user_prompt,
)
from apps.crm.services.audience_builder import (
    AudienceBuilderConfigurationError,
    AudienceBuilderOpenAIError,
)


class CampaignCopilotError(Exception):
    default_code = "CAMPAIGN_COPILOT_ERROR"


class CampaignCopilotConfigurationError(CampaignCopilotError):
    default_code = "OPENAI_NOT_CONFIGURED"


class CampaignCopilotOpenAIError(CampaignCopilotError):
    default_code = "OPENAI_REQUEST_FAILED"


class CampaignCopilotValidationError(CampaignCopilotError):
    default_code = "INVALID_CAMPAIGN_REQUEST"


@dataclass(frozen=True)
class CampaignDraft:
    audience_summary: dict[str, Any]
    reasoning: str
    recommended_channel: str
    generated_message: str
    expected_outcome: dict[str, Any]


class CampaignCopilotService:
    draft_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "reasoning": {"type": "string"},
            "generated_message": {"type": "string"},
            "expected_outcome": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "estimated_reach": {"type": "integer"},
                    "expected_engagement_rate": {"type": "number"},
                    "expected_conversion_rate": {"type": "number"},
                    "expected_revenue": {"type": "number"},
                    "summary": {"type": "string"},
                },
                "required": [
                    "estimated_reach",
                    "expected_engagement_rate",
                    "expected_conversion_rate",
                    "expected_revenue",
                    "summary",
                ],
            },
        },
        "required": ["reasoning", "generated_message", "expected_outcome"],
    }

    def build_campaign_draft(self, user_input: str) -> CampaignDraft:
        if not user_input.strip():
            raise CampaignCopilotValidationError("Campaign input is required.")

        audience_queryset = self.create_audience(user_input)
        audience_summary = self.generate_audience_insights(audience_queryset, user_input)
        recommended_channel = self.recommend_channel(audience_queryset)
        generated = self.generate_personalized_campaign(
            user_input=user_input,
            audience_summary=audience_summary,
            recommended_channel=recommended_channel,
        )

        return CampaignDraft(
            audience_summary=audience_summary,
            reasoning=generated["reasoning"],
            recommended_channel=recommended_channel,
            generated_message=generated["generated_message"],
            expected_outcome=generated["expected_outcome"],
        )

    def create_audience(self, user_input: str):
        filters = self._infer_audience_filters(user_input)
        queryset = Customer.objects.annotate(
            total_spend=Coalesce(
                Sum("orders__amount"),
                Value(Decimal("0"), output_field=DecimalField(max_digits=12, decimal_places=2)),
            ),
            last_order_date=Max("orders__order_date"),
            order_count=Count("orders"),
        )

        if filters["category"]:
            queryset = queryset.filter(orders__category=filters["category"])

        if filters["inactive_days"]:
            cutoff = timezone.now() - timedelta(days=filters["inactive_days"])
            queryset = queryset.filter(last_order_date__lt=cutoff)

        return queryset.distinct()

    def generate_audience_insights(self, audience_queryset, user_input: str) -> dict[str, Any]:
        customers = list(
            audience_queryset.values(
                "id",
                "city",
                "preferred_channel",
                "total_spend",
                "order_count",
                "last_order_date",
            )
        )
        audience_size = len(customers)
        total_spend = sum((row["total_spend"] or Decimal("0") for row in customers), Decimal("0"))
        total_orders = sum((row["order_count"] or 0 for row in customers), 0)

        top_city_row = (
            audience_queryset.exclude(city="")
            .values("city")
            .annotate(customer_count=Count("id", distinct=True))
            .order_by("-customer_count", "city")
            .first()
        )

        channel_mix = list(
            audience_queryset.values("preferred_channel")
            .annotate(customer_count=Count("id", distinct=True))
            .order_by("-customer_count", "preferred_channel")
        )

        return {
            "name": self._audience_name(user_input),
            "criteria": {
                "category": "Coffee" if "coffee" in user_input.lower() else None,
                "inactive_days": 60 if "inactive" in user_input.lower() or "win back" in user_input.lower() else None,
            },
            "audience_size": audience_size,
            "avg_spend": int(total_spend / audience_size) if audience_size else 0,
            "avg_orders": round(total_orders / audience_size, 1) if audience_size else 0,
            "top_city": top_city_row["city"] if top_city_row else None,
            "channel_mix": [
                {
                    "channel": row["preferred_channel"],
                    "customers": row["customer_count"],
                }
                for row in channel_mix
            ],
        }

    def recommend_channel(self, audience_queryset) -> str:
        row = (
            audience_queryset.values("preferred_channel")
            .annotate(customer_count=Count("id", distinct=True))
            .order_by("-customer_count", "preferred_channel")
            .first()
        )
        return row["preferred_channel"] if row else Channel.WHATSAPP

    def generate_personalized_campaign(
        self,
        user_input: str,
        audience_summary: dict[str, Any],
        recommended_channel: str,
    ) -> dict[str, Any]:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise CampaignCopilotConfigurationError("OPENAI_API_KEY is not configured.")

        try:
            from openai import OpenAI
        except ImportError as exc:
            raise CampaignCopilotConfigurationError(
                "The openai package is not installed. Install backend/requirements.txt."
            ) from exc

        client = OpenAI(api_key=api_key)
        model = os.environ.get("OPENAI_CAMPAIGN_MODEL", os.environ.get("OPENAI_AUDIENCE_MODEL", "gpt-4o-mini"))

        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": CAMPAIGN_COPILOT_SYSTEM_PROMPT,
                    },
                    {
                        "role": "user",
                        "content": build_campaign_copilot_user_prompt(
                            user_input=user_input,
                            audience_summary=audience_summary,
                            recommended_channel=recommended_channel,
                        ),
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
            )
        except AudienceBuilderConfigurationError as exc:
            raise CampaignCopilotConfigurationError(str(exc)) from exc
        except AudienceBuilderOpenAIError as exc:
            raise CampaignCopilotOpenAIError(str(exc)) from exc
        except Exception as exc:
            raise CampaignCopilotOpenAIError("OpenAI could not generate the campaign draft.") from exc

        try:
            raw = response.choices[0].message.content or "{}"
            draft = json.loads(raw)
        except (AttributeError, TypeError, json.JSONDecodeError) as exc:
            raise CampaignCopilotOpenAIError("OpenAI returned an invalid campaign draft payload.") from exc

        return self._validate_campaign_draft(draft, audience_summary)

    def _validate_campaign_draft(self, draft: dict[str, Any], audience_summary: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(draft, dict):
            raise CampaignCopilotOpenAIError("Campaign draft must be a JSON object.")

        required_fields = {"reasoning", "generated_message", "expected_outcome"}
        missing_fields = required_fields - set(draft)
        if missing_fields:
            raise CampaignCopilotOpenAIError(
                f"Campaign draft is missing: {', '.join(sorted(missing_fields))}."
            )

        expected_outcome = draft["expected_outcome"]
        if not isinstance(expected_outcome, dict):
            raise CampaignCopilotOpenAIError("expected_outcome must be a JSON object.")

        expected_outcome["estimated_reach"] = min(
            int(expected_outcome.get("estimated_reach", 0)),
            audience_summary["audience_size"],
        )
        expected_outcome["expected_engagement_rate"] = float(expected_outcome.get("expected_engagement_rate", 0))
        expected_outcome["expected_conversion_rate"] = float(expected_outcome.get("expected_conversion_rate", 0))
        expected_outcome["expected_revenue"] = float(expected_outcome.get("expected_revenue", 0))
        expected_outcome["summary"] = str(expected_outcome.get("summary", ""))

        return {
            "reasoning": str(draft["reasoning"]),
            "generated_message": str(draft["generated_message"]),
            "expected_outcome": expected_outcome,
        }

    def _infer_audience_filters(self, user_input: str) -> dict[str, Any]:
        normalized = user_input.lower()
        return {
            "category": "Coffee" if "coffee" in normalized else None,
            "inactive_days": 60 if "inactive" in normalized or "win back" in normalized else None,
        }

    def _audience_name(self, user_input: str) -> str:
        normalized = user_input.lower()
        if "inactive" in normalized and "coffee" in normalized:
            return "Inactive Coffee Buyers"
        if "coffee" in normalized:
            return "Coffee Buyers"
        if "inactive" in normalized or "win back" in normalized:
            return "Inactive Customers"
        return "Generated Audience"
