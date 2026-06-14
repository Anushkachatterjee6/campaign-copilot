import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.crm.models import Communication, CommunicationEvent, Campaign, CampaignStatus
from django.db.models import Count

print("=== ANALYTICS VERIFICATION ===\n")

# 1. Funnel counts (mirrors analytics_views.py logic)
total_comms = Communication.objects.count()
delivered = CommunicationEvent.objects.filter(event_type="delivered").values("communication_id").distinct().count()
opened = CommunicationEvent.objects.filter(event_type="opened").values("communication_id").distinct().count()
clicked = CommunicationEvent.objects.filter(event_type="clicked").values("communication_id").distinct().count()
converted = int(clicked * 0.15) if clicked > 0 else 0

print("--- Funnel ---")
print(f"  Sent:      {total_comms}")
print(f"  Delivered: {delivered}")
print(f"  Opened:    {opened}")
print(f"  Clicked:   {clicked}")
print(f"  Converted: {converted} (est. 15% of clicked)")

# 2. Communication status breakdown
print("\n--- Communication Status Breakdown ---")
status_rows = Communication.objects.values("status").annotate(n=Count("id")).order_by("-n")
for row in status_rows:
    print(f"  {row['status']}: {row['n']}")

# 3. Event type breakdown
print("\n--- Event Type Breakdown ---")
event_rows = CommunicationEvent.objects.values("event_type").annotate(n=Count("id")).order_by("-n")
for row in event_rows:
    print(f"  {row['event_type']}: {row['n']}")

# 4. Per-campaign summary
print("\n--- Per-Campaign Summary ---")
for c in Campaign.objects.filter(status=CampaignStatus.ACTIVE).select_related("segment").order_by("-created_at"):
    n_comms = c.communications.count()
    n_events = CommunicationEvent.objects.filter(communication__campaign=c).count()
    print(f"  ID:{c.id} '{c.name[:45]}' | comms:{n_comms} events:{n_events} channel:{c.channel}")

# 5. Channel performance
print("\n--- Channel Performance (real data) ---")
for ch in ["email", "whatsapp", "sms", "push"]:
    sent = Communication.objects.filter(campaign__channel=ch).count()
    opens = CommunicationEvent.objects.filter(communication__campaign__channel=ch, event_type="opened").count()
    clicks = CommunicationEvent.objects.filter(communication__campaign__channel=ch, event_type="clicked").count()
    eng = round((opens / sent * 100), 1) if sent else 0
    conv = round((clicks / sent * 100), 1) if sent else 0
    print(f"  {ch:10s} | sent:{sent:5d} opens:{opens:5d} clicks:{clicks:5d} | eng:{eng}% conv:{conv}%")
