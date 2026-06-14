"""
Seed demo campaigns with realistic communication events.

Creates 5 campaigns (linked to prebuilt segments) and generates
Communication + CommunicationEvent records with timestamps spread
over the last 7 days so that all analytics charts populate on first load.

Usage:
    python manage.py seed_campaigns
    python manage.py seed_campaigns --force   # delete existing and re-seed
"""

import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.crm.models import (
    Campaign,
    CampaignStatus,
    Channel,
    Communication,
    CommunicationEvent,
    CommunicationStatus,
    Segment,
)

# ---------------------------------------------------------------------------
# Campaign definitions — each links to one of the 5 prebuilt segments
# ---------------------------------------------------------------------------
DEMO_CAMPAIGNS = [
    {
        "name": "Win Back Churned Customers",
        "goal": "Re-engage customers who haven't purchased in 6+ months",
        "channel": Channel.EMAIL,
        "segment_name": "Churn Risk",
        "message": (
            "We miss you! It's been a while since your last order. "
            "Come back today and enjoy 20% off with code COMEBACK20. "
            "Your favourite products are waiting."
        ),
        "status": CampaignStatus.ACTIVE,
        "sample_size": 80,
        "days_ago": 6,
    },
    {
        "name": "VIP WhatsApp Exclusive",
        "goal": "Drive repeat purchases from high-value customers",
        "channel": Channel.WHATSAPP,
        "segment_name": "High Value",
        "message": (
            "Hi! As one of our most valued customers, you get exclusive early access "
            "to our premium collection. Shop now and enjoy free shipping on all orders above ₹999."
        ),
        "status": CampaignStatus.ACTIVE,
        "sample_size": 50,
        "days_ago": 5,
    },
    {
        "name": "Electronics New Arrivals",
        "goal": "Promote new electronics to interested buyers",
        "channel": Channel.SMS,
        "segment_name": "Electronics Buyers",
        "message": (
            "New arrivals just dropped! Latest smartphones & laptops in stock. "
            "Limited units. Shop now at our store."
        ),
        "status": CampaignStatus.COMPLETED,
        "sample_size": 60,
        "days_ago": 7,
    },
    {
        "name": "Beauty Bundle Offer",
        "goal": "Upsell beauty products with a limited-time bundle",
        "channel": Channel.PUSH,
        "segment_name": "Beauty Buyers",
        "message": (
            "Your beauty bundle is waiting! Buy 2 get 1 FREE on all skincare. Today only. "
            "Tap to claim your offer before it expires."
        ),
        "status": CampaignStatus.ACTIVE,
        "sample_size": 45,
        "days_ago": 4,
    },
    {
        "name": "Loyalty Rewards Notification",
        "goal": "Reward frequent shoppers with exclusive loyalty points",
        "channel": Channel.WHATSAPP,
        "segment_name": "Frequent Shoppers",
        "message": (
            "Great news! You've earned 500 bonus loyalty points on your account. "
            "Redeem them on your next order for extra savings. Points valid for 30 days."
        ),
        "status": CampaignStatus.COMPLETED,
        "sample_size": 70,
        "days_ago": 3,
    },
]

# Open / click / convert probabilities per channel (sequential)
CHANNEL_PROBS = {
    Channel.EMAIL:    {"open": 0.28, "click": 0.06, "convert": 0.15},
    Channel.WHATSAPP: {"open": 0.68, "click": 0.14, "convert": 0.20},
    Channel.SMS:      {"open": 0.42, "click": 0.07, "convert": 0.12},
    Channel.PUSH:     {"open": 0.27, "click": 0.04, "convert": 0.10},
}


class Command(BaseCommand):
    help = "Seed 5 demo campaigns with communications and events for dashboard visualisation."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Delete all existing campaigns and re-seed.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["force"]:
            Campaign.objects.all().delete()
            self.stdout.write("Existing campaigns deleted.")

        if Campaign.objects.exists():
            self.stdout.write(
                self.style.WARNING(
                    f"Campaigns already exist ({Campaign.objects.count()} found) — skipping. "
                    "Use --force to re-seed."
                )
            )
            return

        now = timezone.now()
        random.seed(77)  # reproducible

        total_comms = 0
        total_events = 0

        for defn in DEMO_CAMPAIGNS:
            segment = Segment.objects.filter(name=defn["segment_name"], is_prebuilt=True).first()
            if segment is None:
                self.stdout.write(
                    self.style.WARNING(
                        f'  Segment "{defn["segment_name"]}" not found — skipping.'
                    )
                )
                continue

            all_customers = list(segment.customers.all())
            sample_size = min(defn["sample_size"], len(all_customers))
            if sample_size == 0:
                self.stdout.write(
                    self.style.WARNING(
                        f'  Segment "{defn["segment_name"]}" has no customers — skipping.'
                    )
                )
                continue

            customers = random.sample(all_customers, sample_size)
            probs = CHANNEL_PROBS[defn["channel"]]

            campaign = Campaign.objects.create(
                name=defn["name"],
                goal=defn["goal"],
                channel=defn["channel"],
                status=defn["status"],
                audience_size=sample_size,
                segment=segment,
                message=defn["message"],
                expected_outcome={
                    "estimated_reach": sample_size,
                    "expected_engagement_rate": round(probs["open"] * 100, 1),
                    "expected_conversion_rate": round(probs["convert"] * 100, 1),
                    "expected_revenue": sample_size * 4500,
                    "summary": (
                        f"Targeting {sample_size} customers via "
                        f"{defn['channel']} with projected "
                        f"{probs['open'] * 100:.0f}% open rate."
                    ),
                },
            )

            # Create Communication records
            comms = Communication.objects.bulk_create(
                [
                    Communication(
                        campaign=campaign,
                        customer=c,
                        status=CommunicationStatus.SENT,
                        personalized_message=defn["message"],
                    )
                    for c in customers
                ]
            )

            # Generate events spread across the last N days
            events_to_create = []
            comm_status_map = {}  # comm.pk → final status

            days_ago = defn["days_ago"]

            for comm in comms:
                # Each message has a base send time within the campaign's active window
                offset_hours = random.uniform(0, days_ago * 24)
                base_time = now - timedelta(hours=offset_hours)
                current_status = CommunicationStatus.SENT

                # Delivered (near-certain)
                events_to_create.append(
                    CommunicationEvent(
                        communication=comm,
                        event_type="delivered",
                        timestamp=base_time + timedelta(minutes=random.randint(1, 20)),
                    )
                )
                current_status = CommunicationStatus.DELIVERED

                # Opened
                if random.random() < probs["open"]:
                    events_to_create.append(
                        CommunicationEvent(
                            communication=comm,
                            event_type="opened",
                            timestamp=base_time + timedelta(minutes=random.randint(30, 180)),
                        )
                    )
                    current_status = CommunicationStatus.OPENED

                    # Clicked
                    if random.random() < probs["click"]:
                        events_to_create.append(
                            CommunicationEvent(
                                communication=comm,
                                event_type="clicked",
                                timestamp=base_time + timedelta(minutes=random.randint(200, 480)),
                            )
                        )
                        current_status = CommunicationStatus.CLICKED

                        # Converted
                        if random.random() < probs["convert"]:
                            events_to_create.append(
                                CommunicationEvent(
                                    communication=comm,
                                    event_type="converted",
                                    timestamp=base_time + timedelta(minutes=random.randint(500, 1200)),
                                )
                            )
                            current_status = CommunicationStatus.CONVERTED

                comm_status_map[comm.pk] = current_status

            CommunicationEvent.objects.bulk_create(events_to_create)

            # Update Communication.status to reflect the highest event reached
            for comm in comms:
                new_status = comm_status_map.get(comm.pk, CommunicationStatus.DELIVERED)
                Communication.objects.filter(pk=comm.pk).update(status=new_status)

            total_comms += len(comms)
            total_events += len(events_to_create)

            self.stdout.write(
                self.style.SUCCESS(
                    f'  Created "{campaign.name}" '
                    f"[{defn['channel']}] → {len(comms)} comms, {len(events_to_create)} events"
                )
            )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {Campaign.objects.count()} campaigns | "
                f"{total_comms} communications | {total_events} events."
            )
        )
