import os
import django
import time

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.crm.models import Campaign, CampaignStatus, Segment, Communication, CommunicationEvent
from apps.crm.services.campaign_dispatcher import CampaignDispatcherService
from django.db.models import Count

# Reset stuck active campaigns that have 0 communications
stuck = Campaign.objects.filter(status=CampaignStatus.ACTIVE)
print(f"Resetting {stuck.count()} stuck active campaigns to draft...")
stuck.update(status=CampaignStatus.DRAFT)

# Get prebuilt segments
seg_churn = Segment.objects.get(name="Churn Risk")
seg_hv = Segment.objects.get(name="High Value")
seg_freq = Segment.objects.get(name="Frequent Shoppers")

# Create 3 realistic campaigns (limit audience to 50 for fast dispatch)
campaigns_data = [
    {
        "name": "Win Back Inactive Customers",
        "goal": "Re-engage customers who have not ordered in 180+ days",
        "channel": "whatsapp",
        "segment": seg_churn,
        "message": "Hey! We miss you. Come back and enjoy 20% off your next order. Use code WINBACK20.",
    },
    {
        "name": "High Value VIP Offer",
        "goal": "Reward our best customers with an exclusive offer",
        "channel": "email",
        "segment": seg_hv,
        "message": "As one of our most valued customers, enjoy an exclusive 15% loyalty bonus on your next purchase.",
    },
    {
        "name": "Frequent Shoppers Loyalty Reward",
        "goal": "Deepen loyalty with frequent buyers",
        "channel": "sms",
        "segment": seg_freq,
        "message": "You are a VIP! Your loyalty points have doubled this week. Shop now and redeem instantly.",
    },
]

created = []
for d in campaigns_data:
    seg = d.pop("segment")
    c = Campaign.objects.create(
        status=CampaignStatus.ACTIVE,
        segment=seg,
        audience_size=seg.customers.count(),
        **d,
    )
    created.append(c)
    print(f"  Created campaign ID:{c.id} '{c.name}' -> {seg.name} ({seg.customers.count()} customers)")

print("\nDispatching campaigns (synchronous)...")
dispatcher = CampaignDispatcherService()
for campaign in created:
    print(f"  Dispatching campaign ID:{campaign.id}: {campaign.name}")
    dispatcher.dispatch_campaign(campaign.id)
    n = Communication.objects.filter(campaign=campaign).count()
    print(f"    -> {n} communications created")

print("\nWaiting 12s for simulator event callbacks...")
time.sleep(12)

total_comms = Communication.objects.count()
total_events = CommunicationEvent.objects.count()
status_counts = dict(Communication.objects.values_list("status").annotate(n=Count("id")))
event_counts = dict(CommunicationEvent.objects.values_list("event_type").annotate(n=Count("id")))

print(f"\n=== RESULTS ===")
print(f"Total communications: {total_comms}")
print(f"Total events: {total_events}")
print(f"Communication status breakdown: {status_counts}")
print(f"Event type breakdown: {event_counts}")
