"""
Segment Builder Management Command
====================================
Creates (or refreshes) the 5 canonical prebuilt segments derived from
Olist data + RFM scoring.

Usage:
    py manage.py build_segments            # create or update
    py manage.py build_segments --refresh  # clear membership then rebuild

Prebuilt Segments:
    1. High Value         — rfm_score >= 4 OR CLV >= 75th percentile (in INR)
    2. Churn Risk         — churn_risk = 'high'
    3. Electronics Buyers — has at least one 'Electronics' order
    4. Beauty Buyers      — has at least one 'Beauty' order
    5. Frequent Shoppers  — rfm_frequency >= 5

Note:
    Run `py manage.py rfm_compute` before this command to ensure
    RFM fields are populated with up-to-date INR-based scores.
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Count

from apps.crm.models import ChurnRisk, Customer, Segment

# ── Prebuilt segment definitions ───────────────────────────────────────────────
PREBUILT_SEGMENTS = [
    {
        "name": "High Value",
        "description": (
            "Customers with an RFM score ≥ 4 or CLV in the top 25% of all customers. "
            "These are your most valuable, high-spending buyers (CLV in INR)."
        ),
        "criteria": {"rfm_score__gte": 4, "type": "high_value"},
    },
    {
        "name": "Churn Risk",
        "description": (
            "Customers who have not placed an order in over 180 days. "
            "Re-engage before they are permanently lost."
        ),
        "criteria": {"churn_risk": "high", "type": "churn_risk"},
    },
    {
        "name": "Electronics Buyers",
        "description": (
            "Customers who have purchased at least one product in the Electronics category. "
            "Ideal for tech launches and upgrade campaigns."
        ),
        "criteria": {"category": "Electronics", "type": "category"},
    },
    {
        "name": "Beauty Buyers",
        "description": (
            "Customers who have purchased at least one product in the Beauty category. "
            "Ideal for beauty, skincare, and fashion accessory campaigns."
        ),
        "criteria": {"category": "Beauty", "type": "category"},
    },
    {
        "name": "Frequent Shoppers",
        "description": (
            "Customers with 5 or more total orders. High-frequency buyers who respond well "
            "to loyalty rewards and VIP-tier messaging."
        ),
        "criteria": {"rfm_frequency__gte": 5, "type": "frequent"},
    },
]


def p75_clv() -> Decimal:
    """Return the 75th percentile CLV value across all customers."""
    clv_values = list(
        Customer.objects.exclude(clv=0).order_by("clv").values_list("clv", flat=True)
    )
    if not clv_values:
        return Decimal("0")
    idx = int(0.75 * (len(clv_values) - 1))
    return clv_values[idx]


def resolve_queryset(criteria: dict):
    """Build a Customer queryset from a segment criteria dict."""
    segment_type = criteria.get("type")

    if segment_type == "high_value":
        clv_threshold = p75_clv()
        return Customer.objects.filter(rfm_score__gte=4) | Customer.objects.filter(
            clv__gte=clv_threshold
        )

    if segment_type == "churn_risk":
        return Customer.objects.filter(churn_risk=ChurnRisk.HIGH)

    if segment_type == "category":
        category = criteria.get("category")
        return Customer.objects.filter(orders__category=category).distinct()

    if segment_type == "frequent":
        return Customer.objects.filter(rfm_frequency__gte=criteria.get("rfm_frequency__gte", 5))

    return Customer.objects.none()


class Command(BaseCommand):
    help = "Create or refresh the 5 canonical prebuilt CRM segments from Olist + RFM data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--refresh",
            action="store_true",
            help="Clear existing segment membership before rebuilding.",
        )

    def handle(self, *args, **options):
        refresh = options["refresh"]
        self.stdout.write("🏷  Building prebuilt segments…\n")

        for defn in PREBUILT_SEGMENTS:
            segment, created = Segment.objects.get_or_create(
                name=defn["name"],
                defaults={
                    "description": defn["description"],
                    "criteria": defn["criteria"],
                    "is_prebuilt": True,
                },
            )
            if not created:
                # Update description/criteria in case they changed
                segment.description = defn["description"]
                segment.criteria = defn["criteria"]
                segment.is_prebuilt = True
                segment.save(update_fields=["description", "criteria", "is_prebuilt"])

            if refresh or created:
                segment.customers.clear()

            qs = resolve_queryset(defn["criteria"])
            customer_ids = list(qs.values_list("id", flat=True))

            # Add in batches to avoid huge M2M inserts
            batch = 500
            for i in range(0, len(customer_ids), batch):
                segment.customers.add(*customer_ids[i : i + batch])

            count = segment.customers.count()
            action = "Created" if created else "Updated"
            self.stdout.write(
                self.style.SUCCESS(
                    f"  {'✅' if created else '🔄'}  [{action}] \"{segment.name}\" — {count} customers"
                )
            )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("All 5 prebuilt segments are ready."))
        self.stdout.write(
            "  → Visit the Audiences page or call GET /api/segments/?is_prebuilt=true"
        )
