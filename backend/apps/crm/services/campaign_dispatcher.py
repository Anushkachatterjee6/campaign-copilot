import logging
import threading
import requests
from django.conf import settings
from apps.crm.models import Campaign, Communication, CommunicationStatus

logger = logging.getLogger(__name__)

class CampaignDispatcherService:
    """
    Handles launching campaigns by creating Communications for the segment
    and dispatching them to the Channel Simulator.
    Runs synchronously or asynchronously via a background thread.
    """
    SIMULATOR_URL = "http://127.0.0.1:8001/simulate"
    
    def dispatch_in_background(self, campaign: Campaign):
        """Dispatches the campaign in a background thread to return HTTP response immediately."""
        thread = threading.Thread(
            target=self.dispatch_campaign,
            args=(campaign.id,),
            daemon=True
        )
        thread.start()
        
    def dispatch_campaign(self, campaign_id: int):
        """
        Creates communication records and posts to simulator.
        This runs in a background thread.
        """
        try:
            campaign = Campaign.objects.select_related("segment").get(id=campaign_id)
            customers = campaign.segment.customers.all()
            
            # Step 1: Create Communication records
            communications = []
            for customer in customers:
                comm = Communication(
                    campaign=campaign,
                    customer=customer,
                    status=CommunicationStatus.SENT,
                    personalized_message=campaign.message or "Hello, here is a message for you!"
                )
                communications.append(comm)
                
            # Bulk create
            Communication.objects.bulk_create(communications)
            created_comms = Communication.objects.filter(campaign=campaign)
            
            # Step 2: Simulate delivery pipeline locally
            import time
            import random
            from apps.crm.models import CommunicationEvent
            
            # Channel probabilities
            probs = {
                "email": {"open": 0.25, "click": 0.04},
                "whatsapp": {"open": 0.70, "click": 0.15},
                "sms": {"open": 0.40, "click": 0.05},
                "push": {"open": 0.30, "click": 0.03},
            }
            channel = campaign.channel.lower()
            p_open = probs.get(channel, {}).get("open", 0.30)
            p_click = probs.get(channel, {}).get("click", 0.05)
            
            for comm in created_comms:
                # 1. Sent immediately (implicitly done when Communication created)
                time.sleep(random.uniform(0.1, 0.5))
                
                # 2. Delivered
                CommunicationEvent.objects.create(communication=comm, event_type="delivered")
                
                # 3. Opened
                if random.random() < p_open:
                    time.sleep(random.uniform(1.0, 3.0))
                    CommunicationEvent.objects.create(communication=comm, event_type="opened")
                    
                    # 4. Clicked
                    if random.random() < p_click:
                        time.sleep(random.uniform(2.0, 5.0))
                        CommunicationEvent.objects.create(communication=comm, event_type="clicked")
                        
                        # 5. Converted (mock conversion based on click)
                        if random.random() < 0.15:
                            time.sleep(random.uniform(1.0, 4.0))
                            CommunicationEvent.objects.create(communication=comm, event_type="converted")
                            
            # Update campaign status
            campaign.status = "active"
            campaign.save(update_fields=["status"])
                
        except Exception as e:
            logger.error(f"Failed to dispatch campaign {campaign_id}: {e}", exc_info=True)
