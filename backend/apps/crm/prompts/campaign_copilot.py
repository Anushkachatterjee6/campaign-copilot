"""
Campaign Copilot Prompts
=========================

System and user prompts for the Campaign Copilot AI service.
All monetary context passed to the model is in INR (Indian Rupee, ₹).
"""

CAMPAIGN_COPILOT_SYSTEM_PROMPT = """
You are Campaign Copilot AI — an intelligent marketing assistant for a customer engagement CRM.

You receive structured audience intelligence (size, CLV, RFM, churn risk, channel mix)
and generate data-driven campaign drafts.

All monetary values are in INR (Indian Rupee, ₹). Use ₹ in copy when referencing amounts.

Rules:
- Return only valid JSON matching the requested schema.
- Ground your reasoning in the provided audience data and RFM/CLV metrics.
- The generated_message must be customer-facing and ready to send.
- Use {{first_name}} as the customer name personalisation token.
- Do not invent metrics not provided in the audience summary.
- Calibrate message tone to segment type:
    - Churn Risk: warm, urgent, single clear call-to-action.
    - High Value: exclusive, VIP tone, premium feel.
    - Electronics/Beauty: product-focused, benefit-led.
    - Frequent Shoppers: loyalty recognition, reward framing.
- Keep WhatsApp and SMS messages ≤160 characters; Email may include Subject + Body.
- expected_revenue must be expressed in INR (numeric, no currency symbol).
"""


def build_campaign_copilot_user_prompt(
    user_input: str,
    audience_summary: dict,
    recommended_channel: str,
) -> str:
    """Build the user-turn prompt for the Campaign Copilot AI."""

    # Format RFM/CLV context block
    rfm_block = ""
    if audience_summary.get("avg_clv_inr") is not None:
        rfm_block += f"  avg_clv_inr: ₹{audience_summary['avg_clv_inr']:,.0f}\n"
    if audience_summary.get("avg_recency_days") is not None:
        rfm_block += f"  avg_recency_days: {audience_summary['avg_recency_days']}\n"
    if audience_summary.get("avg_frequency") is not None:
        rfm_block += f"  avg_frequency_orders: {audience_summary['avg_frequency']:.1f}\n"
    if audience_summary.get("churn_risk_pct") is not None:
        rfm_block += f"  churn_risk_high_pct: {audience_summary['churn_risk_pct']:.0f}%\n"
    if audience_summary.get("avg_rfm_score") is not None:
        rfm_block += f"  avg_rfm_score: {audience_summary['avg_rfm_score']:.1f}/5\n"

    # Format channel mix
    channel_mix = audience_summary.get("channel_mix", [])
    channel_lines = ""
    for entry in channel_mix[:3]:
        channel_lines += f"  - {entry['channel']}: {entry['customers']} customers\n"

    prebuilt_label = ""
    if audience_summary.get("prebuilt_segment"):
        prebuilt_label = f"\nMatched prebuilt segment: {audience_summary['prebuilt_segment']}"

    return f"""Campaign request:
{user_input}{prebuilt_label}

Audience summary:
  audience_size: {audience_summary.get('audience_size', 0)}
  avg_spend_inr: ₹{audience_summary.get('avg_spend', 0):,}
  avg_orders: {audience_summary.get('avg_orders', 0)}
  top_city: {audience_summary.get('top_city', 'N/A')}
{rfm_block}
Channel mix:
{channel_lines or '  N/A'}

Recommended channel: {recommended_channel}

Generate a complete campaign draft:
1. reasoning — explain audience selection and strategy based on the data above.
2. generated_message — the actual customer-facing copy for {recommended_channel}.
3. expected_outcome — realistic projections given audience size and RFM quality.
   - estimated_reach: integer ≤ audience_size
   - expected_engagement_rate: float 0.0–1.0
   - expected_conversion_rate: float 0.0–1.0
   - expected_revenue: float in INR (numeric only)
   - summary: one-sentence human-readable outcome

Return only valid JSON.
"""
