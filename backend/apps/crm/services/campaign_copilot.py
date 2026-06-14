"""
Campaign Copilot Service
=========================

Orchestrates the full Campaign Copilot AI workflow:

  1. Audience resolution (prebuilt segment match OR filter inference)
  2. Audience insight generation (size, CLV, RFM, churn risk) — all in INR
  3. Channel recommendation (by audience preference majority)
  4. AI campaign draft generation via OpenAI
  5. Segment + Campaign persistence

All monetary values passed to and returned from this service are in INR.
"""

import json
import os
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.db.models import Avg, Count, DecimalField, Max, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.crm.models import Campaign, CampaignStatus, Channel, Customer, Segment
from apps.crm.prompts.campaign_copilot import (
    CAMPAIGN_COPILOT_SYSTEM_PROMPT,
    build_campaign_copilot_user_prompt,
)


# ── Prebuilt segment keyword routing ──────────────────────────────────────────
# Maps natural language hints → canonical prebuilt segment names.
# Checked in order; first match wins.
PREBUILT_SEGMENT_KEYWORDS: list[tuple[list[str], str]] = [
    (["churn", "win back", "inactive", "lost", "lapsed"], "Churn Risk"),
    (["high value", "vip", "premium", "top spend", "best customer"], "High Value"),
    (["electronics", "tech", "gadget", "device", "computer", "phone"], "Electronics Buyers"),
    (["beauty", "skincare", "cosmetic", "makeup", "perfume", "fashion"], "Beauty Buyers"),
    (["frequent", "loyal", "repeat", "loyalty", "vip shopper"], "Frequent Shoppers"),
]


# ── Module-level Gemini client singleton ──────────────────────────────────────
# Reusing a single client avoids re-initialising the HTTP session on every request
_GEMINI_CLIENT: Any = None


def _get_gemini_client(api_key: str, genai_module: Any) -> Any:
    global _GEMINI_CLIENT
    if _GEMINI_CLIENT is None:
        _GEMINI_CLIENT = genai_module.Client(api_key=api_key)
    return _GEMINI_CLIENT


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
    campaign_id: int | None
    audience_summary: dict[str, Any]
    reasoning: str
    recommended_channel: str
    generated_message: str
    expected_outcome: dict[str, Any]


class CampaignCopilotService:
    def build_campaign_draft(self, user_input: str) -> CampaignDraft:
        if not user_input.strip():
            raise CampaignCopilotValidationError("Campaign input is required.")

        # 1. Resolve audience (prebuilt segment or filter-based)
        prebuilt_name, audience_queryset = self.resolve_audience(user_input)

        # 2. Generate audience insights (all INR)
        audience_summary = self.generate_audience_insights(
            audience_queryset, user_input, prebuilt_segment=prebuilt_name
        )

        # 3. Channel recommendation
        recommended_channel = self.recommend_channel(audience_queryset)

        # 4. AI campaign generation
        generated = self.generate_personalized_campaign(
            user_input=user_input,
            audience_summary=audience_summary,
            recommended_channel=recommended_channel,
        )

        # 5. Persist segment + campaign
        segment_name = prebuilt_name or audience_summary.get("name") or "AI Segment"

        if prebuilt_name:
            # Link to existing prebuilt segment instead of creating a new one
            segment = Segment.objects.filter(name=prebuilt_name, is_prebuilt=True).first()
            if not segment:
                segment = Segment.objects.create(
                    name=segment_name,
                    description=f"AI segment for: {user_input[:100]}",
                    criteria=audience_summary.get("criteria") or {},
                )
                segment.customers.set(audience_queryset)
        else:
            segment = Segment.objects.create(
                name=segment_name,
                description=f"AI segment for: {user_input[:100]}",
                criteria=audience_summary.get("criteria") or {},
            )
            segment.customers.set(audience_queryset)

        campaign = Campaign.objects.create(
            name=user_input[:255],
            goal=user_input[:255],
            channel=recommended_channel,
            status=CampaignStatus.DRAFT,
            audience_size=audience_summary.get("audience_size", 0),
            segment=segment,
            message=generated["generated_message"],
            expected_outcome=generated["expected_outcome"],
        )

        return CampaignDraft(
            campaign_id=campaign.id,
            audience_summary=audience_summary,
            reasoning=generated["reasoning"],
            recommended_channel=recommended_channel,
            generated_message=generated["generated_message"],
            expected_outcome=generated["expected_outcome"],
        )

    # ── Audience resolution ────────────────────────────────────────────────────

    def resolve_audience(self, user_input: str) -> tuple[str | None, Any]:
        """
        Attempt to match user input to a prebuilt segment first.
        Falls back to filter-based audience creation.

        Returns (prebuilt_segment_name_or_None, queryset).
        """
        matched_name = self._match_prebuilt_segment(user_input)
        if matched_name:
            segment = Segment.objects.filter(name=matched_name, is_prebuilt=True).first()
            if segment and segment.customers.exists():
                return matched_name, segment.customers.all()

        # Fall back to rule-based filter inference
        return None, self._filter_based_audience(user_input)

    def _match_prebuilt_segment(self, user_input: str) -> str | None:
        """Return the first prebuilt segment name whose keywords match user input."""
        normalized = user_input.lower()
        for keywords, segment_name in PREBUILT_SEGMENT_KEYWORDS:
            if any(kw in normalized for kw in keywords):
                return segment_name
        return None

    def _filter_based_audience(self, user_input: str):
        """Build a queryset using simple keyword-inferred filters."""
        normalized = user_input.lower()

        queryset = Customer.objects.annotate(
            total_spend=Coalesce(
                Sum("orders__amount"),
                Value(Decimal("0"), output_field=DecimalField(max_digits=14, decimal_places=2)),
            ),
            last_order_date=Max("orders__order_date"),
            order_count=Count("orders"),
        )

        # Category filter
        if "coffee" in normalized:
            queryset = queryset.filter(orders__category="Coffee")
        elif "beauty" in normalized:
            queryset = queryset.filter(orders__category="Beauty")
        elif "electronics" in normalized:
            queryset = queryset.filter(orders__category="Electronics")
        elif "fashion" in normalized:
            queryset = queryset.filter(orders__category="Fashion")

        # Recency filter
        if "inactive" in normalized or "win back" in normalized or "lapsed" in normalized:
            cutoff = timezone.now() - timedelta(days=60)
            queryset = queryset.filter(last_order_date__lt=cutoff)

        # Churn risk filter
        if "churn" in normalized or "lost" in normalized:
            queryset = queryset.filter(churn_risk="high")

        return queryset.distinct()

    # ── Audience insights ──────────────────────────────────────────────────────

    def generate_audience_insights(
        self,
        audience_queryset,
        user_input: str,
        prebuilt_segment: str | None = None,
    ) -> dict[str, Any]:
        """
        Compute rich audience intelligence for AI prompt context.
        All monetary metrics are in INR (stored in Customer.clv / Order.amount).
        """
        # Core metrics
        customers = list(
            audience_queryset.values(
                "id", "city", "preferred_channel",
                "clv", "rfm_score", "rfm_recency", "rfm_frequency", "churn_risk",
            )
        )
        audience_size = len(customers)

        if audience_size == 0:
            return {
                "name": prebuilt_segment or self._audience_name(user_input),
                "prebuilt_segment": prebuilt_segment,
                "criteria": {},
                "audience_size": 0,
                "avg_spend": 0,
                "avg_orders": 0,
                "avg_clv_inr": 0,
                "avg_recency_days": 0,
                "avg_frequency": 0,
                "avg_rfm_score": 0,
                "churn_risk_pct": 0,
                "top_city": None,
                "channel_mix": [],
            }

        # Aggregate spend from orders (INR)
        spend_agg = audience_queryset.aggregate(
            total_spend=Coalesce(
                Sum("orders__amount"),
                Value(Decimal("0"), output_field=DecimalField(max_digits=14, decimal_places=2)),
            ),
            total_orders=Count("orders"),
        )
        total_spend = spend_agg["total_spend"] or Decimal("0")
        total_orders = spend_agg["total_orders"] or 0

        # RFM aggregates from Customer fields (computed by RFMEngine)
        rfm_agg = audience_queryset.aggregate(
            avg_clv=Avg("clv"),
            avg_recency=Avg("rfm_recency"),
            avg_freq=Avg("rfm_frequency"),
            avg_rfm=Avg("rfm_score"),
        )
        avg_clv = float(rfm_agg["avg_clv"] or 0)
        avg_recency = float(rfm_agg["avg_recency"] or 0)
        avg_freq = float(rfm_agg["avg_freq"] or 0)
        avg_rfm = float(rfm_agg["avg_rfm"] or 0)

        # Churn risk percentage (high risk customers)
        high_churn_count = sum(1 for c in customers if c.get("churn_risk") == "high")
        churn_risk_pct = (high_churn_count / audience_size * 100) if audience_size else 0

        # Top city
        top_city_row = (
            audience_queryset.exclude(city="")
            .values("city")
            .annotate(customer_count=Count("id", distinct=True))
            .order_by("-customer_count", "city")
            .first()
        )

        # Channel mix
        channel_mix = list(
            audience_queryset.values("preferred_channel")
            .annotate(customer_count=Count("id", distinct=True))
            .order_by("-customer_count", "preferred_channel")
        )

        return {
            "name": prebuilt_segment or self._audience_name(user_input),
            "prebuilt_segment": prebuilt_segment,
            "criteria": self._build_criteria(user_input),
            "audience_size": audience_size,
            "avg_spend": int(total_spend / audience_size) if audience_size else 0,
            "avg_orders": round(total_orders / audience_size, 1) if audience_size else 0,
            # INR-denominated RFM context
            "avg_clv_inr": round(avg_clv, 2),
            "avg_recency_days": round(avg_recency),
            "avg_frequency": round(avg_freq, 1),
            "avg_rfm_score": round(avg_rfm, 1),
            "churn_risk_pct": round(churn_risk_pct, 1),
            "top_city": top_city_row["city"] if top_city_row else None,
            "channel_mix": [
                {"channel": row["preferred_channel"], "customers": row["customer_count"]}
                for row in channel_mix
            ],
        }

    # ── Channel recommendation ─────────────────────────────────────────────────

    def recommend_channel(self, audience_queryset) -> str:
        row = (
            audience_queryset.values("preferred_channel")
            .annotate(customer_count=Count("id", distinct=True))
            .order_by("-customer_count", "preferred_channel")
            .first()
        )
        return row["preferred_channel"] if row else Channel.WHATSAPP

    # ── Gemini generation ──────────────────────────────────────────────────────

    def generate_personalized_campaign(
        self,
        user_input: str,
        audience_summary: dict[str, Any],
        recommended_channel: str,
    ) -> dict[str, Any]:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return self._fallback_campaign(audience_summary, recommended_channel)

        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            raise CampaignCopilotConfigurationError(
                "The google-genai package is not installed. Install backend/requirements.txt."
            ) from exc

        client = _get_gemini_client(api_key, genai)
        # Default to gemini-2.0-flash: no thinking overhead, 3-5x faster than 2.5-flash
        model = os.environ.get("GEMINI_CAMPAIGN_MODEL", "gemini-2.0-flash")

        prompt = (
            f"System Instructions:\n{CAMPAIGN_COPILOT_SYSTEM_PROMPT}\n\n"
            f"User Request:\n{build_campaign_copilot_user_prompt(user_input, audience_summary, recommended_channel)}"
        )
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.4,  # Lower temp → more consistent JSON output
        )

        last_exc: Exception | None = None
        for attempt in range(2):  # 1 retry on transient failure
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                )
                break
            except Exception as exc:
                exc_str = str(exc).lower()
                # Quota exhausted or rate-limited → graceful fallback (no 502)
                if "429" in exc_str or "resource_exhausted" in exc_str or "quota" in exc_str:
                    return self._smart_fallback_campaign(
                        user_input, audience_summary, recommended_channel
                    )
                last_exc = exc
                if attempt == 0:
                    continue  # retry once on transient errors
                raise CampaignCopilotOpenAIError(
                    "Gemini could not generate the campaign draft."
                ) from last_exc

        try:
            raw = response.text or "{}"
            draft = json.loads(raw)
        except (AttributeError, TypeError, json.JSONDecodeError) as exc:
            raise CampaignCopilotOpenAIError("Gemini returned an invalid campaign draft payload.") from exc

        return self._validate_campaign_draft(draft, audience_summary)

    # ── Validation + helpers ───────────────────────────────────────────────────

    def _validate_campaign_draft(
        self, draft: dict[str, Any], audience_summary: dict[str, Any]
    ) -> dict[str, Any]:
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
        expected_outcome["expected_engagement_rate"] = float(
            expected_outcome.get("expected_engagement_rate", 0)
        )
        expected_outcome["expected_conversion_rate"] = float(
            expected_outcome.get("expected_conversion_rate", 0)
        )
        # expected_revenue is in INR
        expected_outcome["expected_revenue"] = float(expected_outcome.get("expected_revenue", 0))
        expected_outcome["summary"] = str(expected_outcome.get("summary", ""))

        return {
            "reasoning": str(draft["reasoning"]),
            "generated_message": str(draft["generated_message"]),
            "expected_outcome": expected_outcome,
        }

    def _build_criteria(self, user_input: str) -> dict[str, Any]:
        normalized = user_input.lower()
        criteria: dict[str, Any] = {}
        for cat in ("coffee", "beauty", "electronics", "fashion"):
            if cat in normalized:
                criteria["category"] = cat.capitalize()
                break
        if "inactive" in normalized or "win back" in normalized:
            criteria["inactive_days"] = 60
        if "churn" in normalized or "lost" in normalized:
            criteria["churn_risk"] = "high"
        return criteria

    def _fallback_campaign(self, audience_summary: dict[str, Any], channel: str) -> dict[str, Any]:
        """Return a sensible fallback when the Gemini API key is missing or unavailable."""
        return self._smart_fallback_campaign("", audience_summary, channel)

    def _smart_fallback_campaign(
        self,
        user_input: str,
        audience_summary: dict[str, Any],
        channel: str,
    ) -> dict[str, Any]:
        """
        Template-based campaign draft using real audience data.
        Used when Gemini API quota is exhausted or key is missing.
        Produces realistic, segment-aware output so the UI remains fully functional.
        """
        name = audience_summary.get("name", "valued customers")
        size = audience_summary.get("audience_size", 0)
        avg_clv = audience_summary.get("avg_clv_inr", 0)
        churn_pct = audience_summary.get("churn_risk_pct", 0)
        avg_recency = audience_summary.get("avg_recency_days", 0)
        top_city = audience_summary.get("top_city", "")
        prebuilt = audience_summary.get("prebuilt_segment", "")

        # Channel-specific engagement benchmarks
        engagement_by_channel = {
            "whatsapp": (0.45, 0.08),
            "email": (0.22, 0.04),
            "sms": (0.35, 0.06),
            "push": (0.15, 0.03),
        }
        eng_rate, conv_rate = engagement_by_channel.get(channel.lower(), (0.20, 0.05))

        estimated_reach = int(size * eng_rate)
        expected_revenue = estimated_reach * conv_rate * (avg_clv or 1500)

        # Segment-specific messaging templates
        if churn_pct >= 60 or "churn" in (prebuilt or "").lower() or "win back" in user_input.lower():
            message = (
                f"Hi {{{{first_name}}}}, we miss you! It's been a while since your last order.\n\n"
                f"Come back today and get 20% off your next purchase — just for you.\n\n"
                f"🛒 Shop now: [Link]\n\n"
                f"Offer valid for 48 hours only."
            )
            reasoning = (
                f"Targeting {size} high-churn-risk customers (avg {avg_recency:.0f} days inactive, "
                f"{churn_pct:.0f}% churn risk). A time-limited win-back discount via {channel} "
                f"leverages urgency to re-engage lapsed buyers with avg CLV of ₹{avg_clv:,.0f}."
            )
        elif "vip" in (prebuilt or "").lower() or "high value" in (prebuilt or "").lower():
            message = (
                f"Hi {{{{first_name}}}}, you're one of our most valued customers 🌟\n\n"
                f"As a VIP member, you get exclusive early access to our newest collection "
                f"plus complimentary priority shipping on your next order.\n\n"
                f"🎁 Claim your VIP reward: [Link]"
            )
            reasoning = (
                f"Targeting {size} high-value customers with avg CLV of ₹{avg_clv:,.0f}. "
                f"Exclusive VIP messaging reinforces loyalty and drives premium repeat purchases "
                f"via {channel} — the most preferred channel for this segment."
            )
        elif "electronics" in (prebuilt or "").lower():
            message = (
                f"Hi {{{{first_name}}}}, exciting news! 📱\n\n"
                f"Our latest electronics are here — and as someone who loves tech, "
                f"you get first access plus ₹500 off orders above ₹2,999.\n\n"
                f"⚡ Shop new arrivals: [Link]"
            )
            reasoning = (
                f"Targeting {size} electronics buyers. New product launch campaigns "
                f"drive higher engagement ({eng_rate*100:.0f}%) for tech-savvy audiences. "
                f"Channel: {channel}. Top city: {top_city or 'mixed'}."
            )
        elif "beauty" in (prebuilt or "").lower():
            message = (
                f"Hi {{{{first_name}}}}, your skin will thank you ✨\n\n"
                f"Our bestselling skincare & beauty collection is now live with "
                f"15% off for returning customers.\n\n"
                f"💄 Shop beauty: [Link]\n\nUse code: BEAUTY15"
            )
            reasoning = (
                f"Targeting {size} beauty & skincare buyers. Category-specific campaigns "
                f"with discount codes see {conv_rate*100:.0f}% higher conversion. "
                f"Channel: {channel}."
            )
        else:
            message = (
                f"Hi {{{{first_name}}}}, we have something special for you 🎉\n\n"
                f"Get 10% off your next order as our way of saying thank you "
                f"for being a loyal customer.\n\n"
                f"🛍️ Shop now: [Link]\n\nOffer expires in 72 hours."
            )
            reasoning = (
                f"Targeting {size} customers via {channel}. "
                f"General loyalty reward campaigns build retention and drive repeat purchases. "
                f"Avg customer CLV: ₹{avg_clv:,.0f}."
            )

        summary = (
            f"Expected to reach ~{estimated_reach:,} customers via {channel.capitalize()}, "
            f"with {conv_rate*100:.0f}% conversion and ₹{expected_revenue:,.0f} projected revenue."
        )

        return {
            "reasoning": reasoning,
            "generated_message": message,
            "expected_outcome": {
                "estimated_reach": estimated_reach,
                "expected_engagement_rate": eng_rate,
                "expected_conversion_rate": conv_rate,
                "expected_revenue": round(expected_revenue, 2),
                "summary": summary,
            },
        }

    def _audience_name(self, user_input: str) -> str:
        normalized = user_input.lower()
        if "inactive" in normalized and "coffee" in normalized:
            return "Inactive Coffee Buyers"
        if "coffee" in normalized:
            return "Coffee Buyers"
        if "churn" in normalized or "inactive" in normalized or "win back" in normalized:
            return "Inactive Customers"
        if "electronics" in normalized:
            return "Electronics Buyers"
        if "beauty" in normalized:
            return "Beauty Buyers"
        return "Generated Audience"
