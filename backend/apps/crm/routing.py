from django.urls import re_path
from apps.crm.consumers import LiveAnalyticsConsumer

websocket_urlpatterns = [
    re_path(r'ws/live/$', LiveAnalyticsConsumer.as_asgi()),
]
