"""
Olist Brazilian E-Commerce → Campaign Copilot CRM Ingestion Pipeline
======================================================================

Usage:
    py manage.py ingest_olist --data-dir /path/to/olist/csvs/

Expected CSV files (standard Kaggle Olist dataset filenames):
    olist_customers_dataset.csv
    olist_orders_dataset.csv
    olist_order_items_dataset.csv
    olist_order_payments_dataset.csv
    olist_order_reviews_dataset.csv
    olist_products_dataset.csv

Currency Conversion:
    All monetary amounts from the Olist dataset are denominated in BRL (Brazilian Real).
    They are converted to INR using a fixed rate of 1 BRL = 15 INR at ingestion time.
    The original BRL value is preserved in Order.source_amount_brl for full traceability.
    The converted INR value is stored in Order.amount (the primary application field).

    Conversion constant: apps.crm.models.BRL_TO_INR_RATE = 15
"""

import csv
import os
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime
from django.utils import timezone

from apps.crm.models import BRL_TO_INR_RATE, Channel, Customer, Order


# ── Category mapping ───────────────────────────────────────────────────────────
# Maps Olist Portuguese product category names → CRM category buckets.
# Unmapped categories → "General".
CATEGORY_MAP: dict[str, str] = {
    # Electronics
    "electronics": "Electronics",
    "computers": "Electronics",
    "computers_accessories": "Electronics",
    "telephony": "Electronics",
    "audio": "Electronics",
    "consoles_games": "Electronics",
    "small_appliances": "Electronics",
    "small_appliances_home_oven_and_coffee": "Electronics",
    "tablets_printing_image": "Electronics",
    "watches_gifts": "Electronics",
    "air_conditioning": "Electronics",
    "signaling_and_security": "Electronics",
    "fixed_telephony": "Electronics",
    "dvds_blu_ray": "Electronics",
    "cds_dvds_musicals": "Electronics",
    "portable_kitchen_food_processors": "Electronics",
    # Beauty
    "health_beauty": "Beauty",
    "perfumery": "Beauty",
    "fashion_bags_accessories": "Beauty",
    "fashion_womens_clothing": "Beauty",
    "fashion_underwear_beach": "Beauty",
    "fashion_sport": "Beauty",
    "fashion_childrens_clothes": "Beauty",
    # Fashion
    "fashion_mens_clothing": "Fashion",
    "fashion_shoes": "Fashion",
    "luggage_accessories": "Fashion",
    "costumes_accessories": "Fashion",
    # Coffee / Food & Drink
    "food": "Coffee",
    "food_drink": "Coffee",
    "drinks": "Coffee",
    "la_cuisine": "Coffee",
}

# ── Channel inference from state ───────────────────────────────────────────────
# Brazilian states mapped to a preferred channel heuristic.
# Coastal/metro states → email; interior → whatsapp; south → sms; default → push
STATE_CHANNEL_MAP: dict[str, str] = {
    "SP": Channel.EMAIL,
    "RJ": Channel.EMAIL,
    "MG": Channel.WHATSAPP,
    "RS": Channel.SMS,
    "PR": Channel.SMS,
    "SC": Channel.SMS,
    "BA": Channel.WHATSAPP,
    "GO": Channel.WHATSAPP,
    "PE": Channel.WHATSAPP,
    "CE": Channel.WHATSAPP,
    "PA": Channel.PUSH,
    "AM": Channel.PUSH,
}

EXPECTED_FILES = [
    "olist_customers_dataset.csv",
    "olist_orders_dataset.csv",
    "olist_order_items_dataset.csv",
    "olist_order_payments_dataset.csv",
    "olist_order_reviews_dataset.csv",
    "olist_products_dataset.csv",
]


def brl_to_inr(brl_value: str | float | Decimal | None) -> tuple[Decimal, Decimal]:
    """Convert a BRL amount to INR.

    Returns:
        (amount_inr, source_amount_brl) — both as Decimal.
        Returns (Decimal("0"), Decimal("0")) for blank/invalid input.
    """
    if brl_value is None or str(brl_value).strip() == "":
        return Decimal("0"), Decimal("0")
    try:
        brl = Decimal(str(brl_value)).quantize(Decimal("0.01"))
        inr = (brl * BRL_TO_INR_RATE).quantize(Decimal("0.01"))
        return inr, brl
    except (InvalidOperation, ValueError):
        return Decimal("0"), Decimal("0")


def map_category(olist_category: str) -> str:
    """Map an Olist category string to a CRM category bucket."""
    return CATEGORY_MAP.get(str(olist_category).strip().lower(), "General")


def infer_channel(state: str) -> str:
    """Infer preferred channel from Brazilian state code."""
    return STATE_CHANNEL_MAP.get(str(state).strip().upper(), Channel.PUSH)


def read_csv(filepath: Path) -> list[dict]:
    """Read a CSV file into a list of dicts, handling BOM encoding."""
    with open(filepath, encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


@dataclass
class IngestStats:
    customers_created: int = 0
    customers_skipped: int = 0
    orders_created: int = 0
    orders_skipped: int = 0
    payments_updated: int = 0
    reviews_updated: int = 0
    errors: list[str] = field(default_factory=list)


class Command(BaseCommand):
    help = (
        "Ingest the Olist Brazilian E-Commerce dataset CSVs into the CRM data model. "
        "All BRL monetary values are converted to INR at 1 BRL = 15 INR."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--data-dir",
            required=True,
            help="Path to the directory containing the Olist CSV files.",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete all existing Olist-sourced customers and orders before ingesting.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and validate CSVs without writing to the database.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=500,
            help="Bulk-create batch size (default 500).",
        )

    def handle(self, *args, **options):
        data_dir = Path(options["data_dir"])
        if not data_dir.is_dir():
            raise CommandError(f"--data-dir '{data_dir}' is not a directory.")

        missing = [f for f in EXPECTED_FILES if not (data_dir / f).exists()]
        if missing:
            raise CommandError(
                f"Missing expected Olist CSV files in '{data_dir}':\n"
                + "\n".join(f"  • {f}" for f in missing)
            )

        dry_run = options["dry_run"]
        batch_size = options["batch_size"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no database writes will occur.\n"))

        stats = IngestStats()

        self.stdout.write("📦  Loading CSV files…")
        customers_csv = read_csv(data_dir / "olist_customers_dataset.csv")
        orders_csv = read_csv(data_dir / "olist_orders_dataset.csv")
        items_csv = read_csv(data_dir / "olist_order_items_dataset.csv")
        payments_csv = read_csv(data_dir / "olist_order_payments_dataset.csv")
        reviews_csv = read_csv(data_dir / "olist_order_reviews_dataset.csv")
        products_csv = read_csv(data_dir / "olist_products_dataset.csv")
        self.stdout.write(self.style.SUCCESS("✅  CSVs loaded.\n"))

        # ── Build lookup maps ──────────────────────────────────────────────────
        self.stdout.write("🔨  Building lookup maps…")
        product_category: dict[str, str] = {}  # product_id → CRM category
        for row in products_csv:
            pid = row.get("product_id", "").strip()
            raw_cat = row.get("product_category_name", "")
            if pid:
                product_category[pid] = map_category(raw_cat)

        # order_id → CRM category (from first item per order)
        order_category: dict[str, str] = {}
        # order_id → total payment in BRL (sum across installments)
        order_payment_brl: dict[str, Decimal] = {}

        for row in items_csv:
            oid = row.get("order_id", "").strip()
            pid = row.get("product_id", "").strip()
            if oid and pid and oid not in order_category:
                order_category[oid] = product_category.get(pid, "General")

        for row in payments_csv:
            oid = row.get("order_id", "").strip()
            val_str = row.get("payment_value", "0")
            try:
                val = Decimal(str(val_str).strip() or "0")
            except (InvalidOperation, ValueError):
                val = Decimal("0")
            if oid:
                order_payment_brl[oid] = order_payment_brl.get(oid, Decimal("0")) + val

        # order_id → review score (first non-null per order)
        order_review: dict[str, int] = {}
        for row in reviews_csv:
            oid = row.get("order_id", "").strip()
            score_str = row.get("review_score", "").strip()
            if oid and score_str and oid not in order_review:
                try:
                    order_review[oid] = int(float(score_str))
                except (ValueError, TypeError):
                    pass

        self.stdout.write(self.style.SUCCESS("✅  Lookup maps built.\n"))

        # ── Step 1: Customers ─────────────────────────────────────────────────
        self.stdout.write(f"👥  Processing {len(customers_csv)} customer rows…")
        if options["clear"] and not dry_run:
            deleted_orders, _ = Order.objects.filter(olist_order_id__gt="").delete()
            deleted_customers, _ = Customer.objects.filter(olist_customer_id__gt="").delete()
            self.stdout.write(
                f"   Cleared {deleted_customers} Olist customers, {deleted_orders} orders."
            )

        existing_olist_ids: set[str] = set(
            Customer.objects.filter(olist_customer_id__gt="").values_list(
                "olist_customer_id", flat=True
            )
        )

        # unique_customer_id → (customer_id row data) deduplication
        seen_unique: dict[str, dict] = {}
        for row in customers_csv:
            unique_id = row.get("customer_unique_id", "").strip()
            if unique_id and unique_id not in seen_unique:
                seen_unique[unique_id] = row

        new_customers: list[Customer] = []
        # olist_customer_id → Customer object (for order FK lookup later)
        olist_id_to_customer: dict[str, Customer] = {}

        for unique_id, row in seen_unique.items():
            olist_cid = row.get("customer_id", "").strip()
            if unique_id in existing_olist_ids or olist_cid in existing_olist_ids:
                stats.customers_skipped += 1
                continue

            city = (row.get("customer_city") or "").strip().title()
            state = (row.get("customer_state") or "").strip().upper()
            email = f"{unique_id}@olist.example"  # synthesised — Olist has no real emails
            channel = infer_channel(state)

            customer = Customer(
                name=f"Customer {unique_id[:8]}",
                email=email,
                phone="",
                city=city,
                state=state,
                preferred_channel=channel,
                olist_customer_id=unique_id,
            )
            new_customers.append(customer)
            olist_id_to_customer[olist_cid] = customer  # temporary ref

        if not dry_run:
            created = Customer.objects.bulk_create(new_customers, batch_size=batch_size, ignore_conflicts=True)
            stats.customers_created = len(created)
        else:
            stats.customers_created = len(new_customers)

        self.stdout.write(
            self.style.SUCCESS(
                f"   ✅  Customers: {stats.customers_created} created, {stats.customers_skipped} skipped.\n"
            )
        )

        # ── Step 2: Orders ────────────────────────────────────────────────────
        self.stdout.write(f"📦  Processing {len(orders_csv)} order rows…")

        # Re-fetch customers from DB to get real PKs after bulk_create
        if not dry_run:
            # Map olist_customer_id → DB Customer PK
            customer_map: dict[str, int] = dict(
                Customer.objects.filter(olist_customer_id__gt="").values_list(
                    "olist_customer_id", "id"
                )
            )
            # We also need olist_customer_id of each order_id (from the customers CSV)
            # The orders CSV uses customer_id (not unique_id); map it via seen_unique
            order_customer_id: dict[str, str] = {}
            for row in customers_csv:
                cid = row.get("customer_id", "").strip()
                uid = row.get("customer_unique_id", "").strip()
                if cid and uid:
                    order_customer_id[cid] = uid  # customer_id → unique_id

        existing_olist_order_ids: set[str] = set(
            Order.objects.filter(olist_order_id__gt="").values_list("olist_order_id", flat=True)
        ) if not dry_run else set()

        new_orders: list[Order] = []
        for row in orders_csv:
            oid = row.get("order_id", "").strip()
            cid = row.get("customer_id", "").strip()

            if not oid or not cid:
                stats.orders_skipped += 1
                continue
            if oid in existing_olist_order_ids:
                stats.orders_skipped += 1
                continue

            # Only import delivered/invoiced/shipped orders
            status = (row.get("order_status") or "").strip()
            if status not in ("delivered", "invoiced", "shipped", "processing", "approved"):
                stats.orders_skipped += 1
                continue

            # Resolve customer PK
            if not dry_run:
                uid = order_customer_id.get(cid, "")
                customer_pk = customer_map.get(uid)
                if not customer_pk:
                    stats.orders_skipped += 1
                    continue
            else:
                customer_pk = None

            # Parse order date
            raw_date = row.get("order_purchase_timestamp", "").strip()
            order_date = None
            if raw_date:
                try:
                    order_date = parse_datetime(raw_date.replace(" ", "T"))
                except (ValueError, TypeError):
                    pass
            if not order_date:
                order_date = timezone.now()

            # Monetary conversion (BRL → INR)
            payment_brl = order_payment_brl.get(oid, Decimal("0"))
            amount_inr, source_brl = brl_to_inr(payment_brl)

            category = order_category.get(oid, "General")
            review = order_review.get(oid)

            order_kwargs = dict(
                olist_order_id=oid,
                amount=amount_inr,
                source_amount_brl=source_brl,
                payment_value=amount_inr,
                category=category,
                order_date=order_date,
                review_score=review,
            )
            if not dry_run:
                order_kwargs["customer_id"] = customer_pk

            new_orders.append(Order(**order_kwargs))

        if not dry_run:
            with transaction.atomic():
                Order.objects.bulk_create(new_orders, batch_size=batch_size, ignore_conflicts=True)
            stats.orders_created = len(new_orders)
        else:
            stats.orders_created = len(new_orders)

        self.stdout.write(
            self.style.SUCCESS(
                f"   ✅  Orders: {stats.orders_created} created, {stats.orders_skipped} skipped.\n"
            )
        )

        # ── Summary ────────────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS("=" * 58))
        self.stdout.write(self.style.SUCCESS("  Olist Ingestion Complete"))
        self.stdout.write(self.style.SUCCESS("=" * 58))
        self.stdout.write(f"  Currency:          1 BRL = {BRL_TO_INR_RATE} INR (fixed rate)")
        self.stdout.write(f"  Customers created: {stats.customers_created}")
        self.stdout.write(f"  Customers skipped: {stats.customers_skipped}")
        self.stdout.write(f"  Orders created:    {stats.orders_created}")
        self.stdout.write(f"  Orders skipped:    {stats.orders_skipped}")
        if dry_run:
            self.stdout.write(self.style.WARNING("\n  ⚠  DRY RUN — no data was written."))
        self.stdout.write(self.style.SUCCESS("=" * 58))
        self.stdout.write("")
        self.stdout.write("Next steps:")
        self.stdout.write("  py manage.py rfm_compute   — compute RFM + CLV scores")
        self.stdout.write("  py manage.py build_segments — create 5 prebuilt segments")
