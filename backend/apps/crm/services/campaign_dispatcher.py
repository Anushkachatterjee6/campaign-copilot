import logging
import threading
import random
import time

from django.db import transaction
from apps.crm.models import Campaign, Communication, CommunicationStatus, CommunicationEvent

logger = logging.getLogger(__name__)

# Open/click probabilities per channel
CHANNEL_PROBS = {
    "email":    {"open": 0.25, "click": 0.04, "convert": 0.15},
    "whatsapp": {"open": 0.70, "click": 0.15, "convert": 0.20},
    "sms":      {"open": 0.40, "click": 0.05, "convert": 0.12},
    "push":     {"open": 0.30, "click": 0.03, "convert": 0.10},
}

# Maps event_type → Communication status precedence
STATUS_ORDER = ["pending", "sent", "delivered", "opened", "read", "clicked", "converted", "failed"]


def _advance_status(current: str, new_event: str) -> str:
    """Return the higher-ranked status between current and the incoming event."""
    try:
        if STATUS_ORDER.index(new_event) > STATUS_ORDER.index(current):
            return new_event
    except ValueError:
        pass
    return current


class CampaignDispatcherService:
    """Launches campaigns by creating Communications and simulating delivery events."""

    def dispatch_in_background(self, campaign: Campaign):
        thread = threading.Thread(
            target=self._dispatch_safe,
            args=(campaign.id,),
            daemon=True,
        )
        thread.start()

    def _dispatch_safe(self, campaign_id: int):
        try:
            self.dispatch_campaign(campaign_id)
        except Exception as exc:
            logger.error("Failed to dispatch campaign %s: %s", campaign_id, exc, exc_info=True)

    def dispatch_campaign(self, campaign_id: int):
        campaign = Campaign.objects.select_related("segment").get(id=campaign_id)

        if campaign.segment is None:
            logger.warning(
                "Campaign %s has no segment — cannot dispatch communications.", campaign_id
            )
            return

        customers = list(campaign.segment.customers.all())
        if not customers:
            logger.warning("Campaign %s segment has 0 customers.", campaign_id)
            return

        probs = CHANNEL_PROBS.get(campaign.channel.lower(), CHANNEL_PROBS["email"])

        # Bulk-create one Communication per customer
        comms = Communication.objects.bulk_create(
            [
                Communication(
                    campaign=campaign,
                    customer=customer,
                    status=CommunicationStatus.SENT,
                    personalized_message=campaign.message or "Hello! Here is a message for you.",
                )
                for customer in customers
            ],
            ignore_conflicts=True,
        )

        # Simulate the delivery pipeline for each communication
        events_to_create = []
        status_updates = []  # (comm, new_status)

        for comm in comms:
            current_status = CommunicationStatus.SENT

            # Delivered (always)
            events_to_create.append(
                CommunicationEvent(communication=comm, event_type="delivered")
            )
            current_status = _advance_status(current_status, "delivered")

            # Opened
            if random.random() < probs["open"]:
                events_to_create.append(
                    CommunicationEvent(communication=comm, event_type="opened")
                )
                current_status = _advance_status(current_status, "opened")

                # Clicked
                if random.random() < probs["click"]:
                    events_to_create.append(
                        CommunicationEvent(communication=comm, event_type="clicked")
                    )
                    current_status = _advance_status(current_status, "clicked")

                    # Converted
                    if random.random() < probs["convert"]:
                        events_to_create.append(
                            CommunicationEvent(communication=comm, event_type="converted")
                        )
                        current_status = _advance_status(current_status, "converted")

            status_updates.append((comm, current_status))

        # Bulk-create all events in one shot
        CommunicationEvent.objects.bulk_create(events_to_create)

        # Update Communication statuses
        for comm, new_status in status_updates:
            Communication.objects.filter(pk=comm.pk).update(status=new_status)

        logger.info(
            "Dispatched campaign %s: %d comms, %d events",
            campaign_id,
            len(comms),
            len(events_to_create),
        )
