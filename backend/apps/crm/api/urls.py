from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.crm.api.views import (
    AudienceBuilderView,
    CampaignCopilotView,
    CampaignViewSet,
    CommunicationEventViewSet,
    CommunicationReceiptView,
    CommunicationViewSet,
    CustomerViewSet,
    DashboardStatsView,
    OrderViewSet,
    SegmentViewSet,
)

router = DefaultRouter()
router.register(r"customers", CustomerViewSet, basename="customer")
router.register(r"orders", OrderViewSet, basename="order")
router.register(r"segments", SegmentViewSet, basename="segment")
router.register(r"campaigns", CampaignViewSet, basename="campaign")
router.register(r"communications", CommunicationViewSet, basename="communication")
router.register(r"events", CommunicationEventViewSet, basename="event")

urlpatterns = [
    path("", include(router.urls)),
    path("stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("ai/audience-builder/", AudienceBuilderView.as_view(), name="ai-audience-builder"),
    path("ai/campaign-copilot/", CampaignCopilotView.as_view(), name="ai-campaign-copilot"),
    path("communications/receipts/", CommunicationReceiptView.as_view(), name="communication-receipts"),
]
