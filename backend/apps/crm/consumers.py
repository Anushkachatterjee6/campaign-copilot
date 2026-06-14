import json
from channels.generic.websocket import AsyncWebsocketConsumer

class LiveAnalyticsConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = "live_crm_updates"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def crm_event(self, event):
        # Called when a message with type="crm.event" is sent to the group
        await self.send(text_data=json.dumps(event["data"]))
