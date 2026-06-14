"""
seed_campaigns.py — Seed sample campaigns, communications, and events.

Creates a realistic set of campaigns (active, completed, draft) with
Communication and CommunicationEvent records spread across the last 30 days.
This populates:
  - active_campaigns count on the dashboard
  - campaign_trend, channel_performance, engagement_trend on analytics
  - revenue_attribution on analytics

Run after seed_data + rfm_compute + build_segments.
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
    CommunicationEventType,
    CommunicationStatus,
    Customer,
    Segment,
)


SAMPLE_CAMPAIGNS = [
    {
        "name": "Diwali Win-Back Email",
        "goal": "Re-engage churned customers with a 20% Diwali discount.",
        "channel": Channel.EMAIL,
        "status": CampaignStatus.COMPLETED,
        "days_ago": 28,
        "audience_pct": 0.20,  # % of segment customers to sample for comms
        "segment_name": "Churn Risk",
        "open_rate": 0.35,
        "click_rate": 0.12,
    },
    {
        "name": "High-Value VIP WhatsApp",
        "goal": "Reward top customers with early access to new collection.",
        "channel": Channel.WHATSAPP,
        "status": CampaignStatus.COMPLETED,
        "days_ago": 21,
        "audience_pct": 0.50,
        "segment_name": "High Value",
        "open_rate": 0.58,
        "click_rate": 0.22,
    },
    {
        "name": "Electronics Launch SMS",
        "goal": "Announce the new smartphone lineup to electronics buyers.",
        "channel": Channel.SMS,
        "status": CampaignStatus.ACTIVE,
        "days_ago": 5,
        "audience_pct": 0.40,
        "segment_name": "Electronics Buyers",
        "open_rate": 0.42,
        "click_rate": 0.15,
    },
    {
        "name": "Beauty Buyers Push Notification",
        "goal": "Flash sale on skincare products for beauty segment.",
        "channel": Channel.PUSH,
        "status": CampaignStatus.ACTIVE,
        "days_ago": 3,
        "audience_pct": 0.35,
        "segment_name": "Beauty Buyers",
        "open_rate": 0.28,
        "click_rate": 0.09,
    },
    {
        "name": "Loyalty Reward WhatsApp",
        "goal": "Thank frequent shoppers with a loyalty bonus code.",
        "channel": Channel.WHATSAPP,
        "status": CampaignStatus.ACTIVE,
        "days_ago": 1,
        "audience_pct": 0.30,
        "segment_name": "Frequent Shoppers",
        "open_rate": 0.61,
        "click_rate": 0.25,
    },
    {
        "name": "Q3 Email Newsletter",
        "goal": "Monthly newsletter with product updates.",
        "channel": Channel.EMAIL,
        "status": CampaignStatus.COMPLETED,
        "days_ago": 14,
        "audience_pct": 0.15,
        "segment_name": "High Value",
        "open_rate": 0.30,
        "click_rate": 0.08,
    },
    {
        "name": "Churn Prevention SMS",
        "goal": "Last-chance offer for customers at churn risk.",
        "channel": Channel.SMS,
        "status": CampaignStatus.PAUSED,
        "days_ago": 10,
        "audience_pct": 0.10,
        "segment_name": "Churn Risk",
        "open_rate": 0.20,
        "click_rate": 0.05,
    },
    {
        "name": "New Year Flash Sale Email",
        "goal": "Promote year-end flash sale to frequent shoppers.",
        "channel": Channel.EMAIL,
        "status": CampaignStatus.DRAFT,
        "days_ago": 0,
        "audience_pct": 0,
        "segment_name": "Frequent Shoppers",
        "open_rate": 0,
        "click_rate": 0,
    },
]


def create_events_for_comm(comm, sent_at, open_rate, click_rate, rng):
    """Create a realistic event chain for a single Communication."""
    events = []

    # Always queued
    events.append(CommunicationEvent(
        communication=comm,
        event_type=CommunicationEventType.QUEUED,
        timestamp=sent_at - timedelta(minutes=rng.randint(1, 10)),
    ))

    # Always sent
    events.append(CommunicationEvent(
        communication=comm,
        event_type=CommunicationEventType.SENT,
        timestamp=sent_at,
    ))

    # Delivered (95% of sent)
    if rng.random() < 0.95:
        events.append(CommunicationEvent(
            communication=comm,
            event_type=CommunicationEventType.DELIVERED,
            timestamp=sent_at + timedelta(seconds=rng.randint(10, 120)),
        ))
        comm.status = CommunicationStatus.DELIVERED

        # Opened
        if rng.random() < open_rate:
            open_time = sent_at + timedelta(hours=rng.randint(1, 48))
            events.append(CommunicationEvent(
                communication=comm,
                event_type=CommunicationEventType.OPENED,
                timestamp=open_time,
            ))
            comm.status = CommunicationStatus.OPENED

            # Clicked
            if rng.random() < click_rate:
                events.append(CommunicationEvent(
                    communication=comm,
                    event_type=CommunicationEventType.CLICKED,
                    timestamp=open_time + timedelta(minutes=rng.randint(1, 30)),
                ))
                comm.status = CommunicationStatus.CLICKED

    return events


class Command(BaseCommand):
    help = "Seed sample campaigns, communications, and events for dashboard/analytics."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing campaigns and communications before seeding.",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=99,
            help="Random seed for reproducibility.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        rng = random.Random(options["seed"])
        now = timezone.now()

        if options["clear"]:
            CommunicationEvent.objects.all().delete()
            Communication.objects.all().delete()
            Campaign.objects.all().delete()
            self.stdout.write("Cleared existing campaign data.")

        # Skip if campaigns already exist (idempotent)
        if Campaign.objects.exists():
            self.stdout.write(self.style.WARNING(
                f"  Campaigns already exist ({Campaign.objects.count()} found) — skipping seed."
                " Use --clear to reseed."
            ))
            return

        segments = {seg.name: seg for seg in Segment.objects.all()}
        if not segments:
            self.stdout.write(self.style.ERROR(
                "No segments found. Run build_segments first."
            ))
            return

        all_customers = list(Customer.objects.values_list("id", flat=True))
        if not all_customers:
            self.stdout.write(self.style.ERROR(
                "No customers found. Run seed_data first."
            ))
            return

        total_campaigns = 0
        total_comms = 0
        total_events = 0

        for defn in SAMPLE_CAMPAIGNS:
            segment = segments.get(defn["segment_name"])
            segment_customers = (
                list(segment.customers.values_list("id", flat=True))
                if segment else all_customers
            )

            audience_size = max(1, int(len(segment_customers) * defn["audience_pct"])) if defn["audience_pct"] > 0 else len(segment_customers) // 4

            campaign = Campaign.objects.create(
                name=defn["name"],
                goal=defn["goal"],
                channel=defn["channel"],
                status=defn["status"],
                audience_size=audience_size,
                segment=segment,
                message=f"Sample message for {defn['name']}.",
            )
            total_campaigns += 1

            # Only create communications for non-draft campaigns
            if defn["status"] == CampaignStatus.DRAFT or defn["audience_pct"] == 0:
                self.stdout.write(f"  [DRAFT] {campaign.name}")
                continue

            # Pick a sample of customers
            sampled_ids = rng.sample(segment_customers, min(audience_size, len(segment_customers)))
            campaign_start = now - timedelta(days=defn["days_ago"])

            comms_to_create = []
            for cust_id in sampled_ids:
                comms_to_create.append(Communication(
                    campaign=campaign,
                    customer_id=cust_id,
                    personalized_message=f"Hi! {defn['goal']}",
                    status=CommunicationStatus.SENT,
                ))

            # Use ignore_conflicts=True to skip duplicate campaign+customer pairs
            created_comms = Communication.objects.bulk_create(
                comms_to_create,
                batch_size=500,
                ignore_conflicts=True,
            )
            # Re-fetch created comms so we have PKs
            created_comms = list(Communication.objects.filter(campaign=campaign))
            total_comms += len(created_comms)

            all_events = []
            for i, comm in enumerate(created_comms):
                # Spread sends across a window
                jitter_hours = rng.uniform(0, min(defn["days_ago"] * 0.5, 48))
                sent_at = campaign_start + timedelta(hours=jitter_hours)
                evts = create_events_for_comm(
                    comm,
                    sent_at,
                    defn["open_rate"],
                    defn["click_rate"],
                    rng,
                )
                all_events.extend(evts)

            # Bulk-save updated comm statuses
            Communication.objects.bulk_update(created_comms, ["status"], batch_size=500)

            CommunicationEvent.objects.bulk_create(all_events, batch_size=1000, ignore_conflicts=True)
            total_events += len(all_events)

            self.stdout.write(self.style.SUCCESS(
                f"  [{defn['status'].upper()}] {campaign.name} — "
                f"{len(created_comms)} comms, {len(all_events)} events"
            ))

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Campaign seed complete: {total_campaigns} campaigns, "
            f"{total_comms} communications, {total_events} events."
        ))
