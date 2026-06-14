from django.db.models import Avg, Count, DecimalField, Max, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.crm.models import (
    Campaign,
    CampaignStatus,
    Communication,
    CommunicationEvent,
    Customer,
    Order,
    Segment,
)
from apps.crm.serializers import (
    CampaignSerializer,
    CommunicationEventSerializer,
    CommunicationSerializer,
    CustomerSerializer,
    OrderSerializer,
    SegmentSerializer,
    SegmentSummarySerializer,
    AudienceBuilderRequestSerializer,
    AudienceBuilderResponseSerializer,
    CampaignCopilotRequestSerializer,
    CampaignCopilotResponseSerializer,
    CommunicationReceiptSerializer,
)
from apps.crm.services.audience_builder import (
    AudienceBuilderConfigurationError,
    AudienceBuilderError,
    AudienceBuilderService,
    AudienceFilterValidationError,
)
from apps.crm.services.campaign_copilot import (
    CampaignCopilotConfigurationError,
    CampaignCopilotError,
    CampaignCopilotOpenAIError,
    CampaignCopilotService,
    CampaignCopilotValidationError,
)


# ---------------------------------------------------------------------------
# CRUD ViewSets
# ---------------------------------------------------------------------------

class CustomerViewSet(viewsets.ModelViewSet):
    """CRUD for Customer records with search + ordering."""

    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "email", "city"]
    ordering_fields = [
        "name", "city", "preferred_channel", "created_at",
        "clv", "rfm_score", "rfm_recency", "churn_risk",
    ]
    ordering = ["name"]

    @action(detail=True, methods=["get"], url_path="orders")
    def orders(self, request, pk=None):
        customer = self.get_object()
        qs = customer.orders.all().order_by("-order_date")
        serializer = OrderSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="communications")
    def communications(self, request, pk=None):
        customer = self.get_object()
        qs = customer.communications.select_related("campaign").order_by("-created_at")
        serializer = CommunicationSerializer(qs, many=True)
        return Response(serializer.data)


class OrderViewSet(viewsets.ModelViewSet):
    """CRUD for Order records."""

    queryset = Order.objects.select_related("customer").all()
    serializer_class = OrderSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["customer__name", "category"]
    ordering_fields = ["order_date", "amount", "category"]
    ordering = ["-order_date"]


class SegmentViewSet(viewsets.ModelViewSet):
    """CRUD for Segment records."""

    queryset = Segment.objects.prefetch_related("customers").all()
    serializer_class = SegmentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at", "is_prebuilt"]
    ordering = ["name"]

    def get_queryset(self):
        qs = super().get_queryset()
        # Allow ?is_prebuilt=true filter
        is_prebuilt = self.request.query_params.get("is_prebuilt")
        if is_prebuilt is not None:
            qs = qs.filter(is_prebuilt=is_prebuilt.lower() in ("true", "1", "yes"))
        return qs

    @action(detail=False, methods=["get"], url_path="prebuilt")
    def prebuilt(self, request):
        """List the 5 Olist-derived prebuilt segments with their customer counts."""
        segments = Segment.objects.filter(is_prebuilt=True).prefetch_related("customers").order_by("name")
        serializer = SegmentSummarySerializer(segments, many=True)
        return Response(serializer.data)


class CampaignViewSet(viewsets.ModelViewSet):
    """CRUD for Campaign records with launch action."""

    queryset = Campaign.objects.select_related("segment").all()
    serializer_class = CampaignSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "goal"]
    ordering_fields = ["name", "status", "channel", "created_at", "audience_size"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=["post"], url_path="launch")
    def launch(self, request, pk=None):
        """Transition a Draft/Scheduled campaign to Active and dispatch communications."""
        campaign = self.get_object()
        if campaign.status not in (CampaignStatus.DRAFT, CampaignStatus.SCHEDULED):
            return Response(
                {"error": {"code": "INVALID_STATUS", "message": "Only Draft or Scheduled campaigns can be launched."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        campaign.status = CampaignStatus.ACTIVE
        campaign.save(update_fields=["status", "updated_at"])
        
        # Dispatch in background
        from apps.crm.services.campaign_dispatcher import CampaignDispatcherService
        dispatcher = CampaignDispatcherService()
        dispatcher.dispatch_in_background(campaign)
        
        return Response(CampaignSerializer(campaign).data)

    @action(detail=True, methods=["get"], url_path="communications")
    def communications(self, request, pk=None):
        campaign = self.get_object()
        qs = campaign.communications.select_related("customer").order_by("-created_at")
        serializer = CommunicationSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="stats")
    def stats(self, request, pk=None):
        """Per-campaign funnel stats."""
        campaign = self.get_object()
        comms = campaign.communications.all()
        total = comms.count()
        by_status = {
            row["status"]: row["n"]
            for row in comms.values("status").annotate(n=Count("id"))
        }
        return Response(
            {
                "campaign_id": campaign.id,
                "total_communications": total,
                "by_status": by_status,
            }
        )


class CommunicationViewSet(viewsets.ModelViewSet):
    """CRUD for Communication records."""

    queryset = Communication.objects.select_related("campaign", "customer").prefetch_related("events").all()
    serializer_class = CommunicationSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["campaign__name", "customer__name"]
    ordering_fields = ["status", "created_at"]
    ordering = ["-created_at"]


class CommunicationEventViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only events log."""

    queryset = CommunicationEvent.objects.select_related("communication").all()
    serializer_class = CommunicationEventSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["timestamp", "event_type"]
    ordering = ["-timestamp"]


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

class DashboardStatsView(APIView):
    def get(self, request):
        total_customers = Customer.objects.count()
        total_orders = Order.objects.count()
        active_campaigns = Campaign.objects.filter(status=CampaignStatus.ACTIVE).count()

        # Revenue influenced — all in INR (Order.amount is always INR)
        revenue_influenced = (
            Order.objects.filter(
                customer__communications__isnull=False
            )
            .aggregate(
                total=Coalesce(
                    Sum("amount"),
                    Value(0, output_field=DecimalField(max_digits=14, decimal_places=2)),
                )
            )["total"]
        )

        recent_campaigns = Campaign.objects.select_related("segment").order_by("-created_at")[:5]

        # RFM segment summaries (prebuilt segments only)
        prebuilt_segments = (
            Segment.objects.filter(is_prebuilt=True)
            .prefetch_related("customers")
            .order_by("name")
        )
        segment_summaries = [
            {
                "id": seg.id,
                "name": seg.name,
                "customer_count": seg.customers.count(),
            }
            for seg in prebuilt_segments
        ]

        # Top RFM insights (INR-based CLV)
        rfm_summary = Customer.objects.aggregate(
            avg_clv_inr=Avg("clv"),
            avg_rfm_score=Avg("rfm_score"),
        )

        return Response(
            {
                "total_customers": total_customers,
                "total_orders": total_orders,
                "active_campaigns": active_campaigns,
                "revenue_influenced_inr": float(revenue_influenced or 0),
                # Legacy key for backwards compat
                "revenue_influenced": float(revenue_influenced or 0),
                "recent_campaigns": CampaignSerializer(recent_campaigns, many=True).data,
                "prebuilt_segments": segment_summaries,
                "rfm_summary": {
                    "avg_clv_inr": round(float(rfm_summary.get("avg_clv_inr") or 0), 2),
                    "avg_rfm_score": round(float(rfm_summary.get("avg_rfm_score") or 0), 1),
                },
            }
        )


# ---------------------------------------------------------------------------
# Status-progress map used by receipt view
# ---------------------------------------------------------------------------

STATUS_PROGRESS = {
    "delivered": 1,
    "opened": 2,
    "read": 3,
    "clicked": 4,
    "failed": 99,
}


# ---------------------------------------------------------------------------
# AI Views
# ---------------------------------------------------------------------------

class AudienceBuilderView(APIView):
    service_class = AudienceBuilderService

    def post(self, request):
        request_serializer = AudienceBuilderRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)

        service = self.service_class()
        try:
            result = service.build_audience(request_serializer.validated_data["input"])
        except AudienceBuilderConfigurationError as exc:
            return self._error_response(exc, status.HTTP_503_SERVICE_UNAVAILABLE)
        except AudienceFilterValidationError as exc:
            return self._error_response(exc, status.HTTP_400_BAD_REQUEST)
        except AudienceBuilderError as exc:
            return self._error_response(exc, status.HTTP_502_BAD_GATEWAY)

        response_serializer = AudienceBuilderResponseSerializer(
            {
                "filters": result.filters,
                "audience_size": result.audience_size,
                "avg_spend": result.avg_spend,
                "top_city": result.top_city,
            }
        )
        return Response(response_serializer.data)

    def _error_response(self, exc: AudienceBuilderError, status_code: int) -> Response:
        return Response(
            {
                "error": {
                    "code": exc.default_code,
                    "message": str(exc),
                }
            },
            status=status_code,
        )


class CampaignCopilotView(APIView):
    service_class = CampaignCopilotService

    def post(self, request):
        request_serializer = CampaignCopilotRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)

        service = self.service_class()
        try:
            draft = service.build_campaign_draft(request_serializer.validated_data["input"])
        except CampaignCopilotConfigurationError as exc:
            return self._error_response(exc, status.HTTP_503_SERVICE_UNAVAILABLE)
        except CampaignCopilotValidationError as exc:
            return self._error_response(exc, status.HTTP_400_BAD_REQUEST)
        except CampaignCopilotOpenAIError as exc:
            return self._error_response(exc, status.HTTP_502_BAD_GATEWAY)
        except CampaignCopilotError as exc:
            return self._error_response(exc, status.HTTP_500_INTERNAL_SERVER_ERROR)

        response_serializer = CampaignCopilotResponseSerializer(
            {
                "campaign_id": draft.campaign_id,
                "audience_summary": draft.audience_summary,
                "reasoning": draft.reasoning,
                "recommended_channel": draft.recommended_channel,
                "generated_message": draft.generated_message,
                "expected_outcome": draft.expected_outcome,
            }
        )
        return Response(response_serializer.data)

    def _error_response(self, exc: CampaignCopilotError, status_code: int) -> Response:
        return Response(
            {
                "error": {
                    "code": exc.default_code,
                    "message": str(exc),
                }
            },
            status=status_code,
        )


# ---------------------------------------------------------------------------
# Channel simulator receipt
# ---------------------------------------------------------------------------

class CommunicationReceiptView(APIView):
    def post(self, request):
        serializer = CommunicationReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            communication = Communication.objects.get(id=data["communication_id"])
        except Communication.DoesNotExist:
            return Response(
                {
                    "error": {
                        "code": "COMMUNICATION_NOT_FOUND",
                        "message": "Communication not found for simulator receipt.",
                    }
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        event = CommunicationEvent.objects.create(
            communication=communication,
            event_type=data["event_type"],
            timestamp=data.get("timestamp") or timezone.now(),
        )

        current_rank = STATUS_PROGRESS.get(communication.status, 0)
        incoming_rank = STATUS_PROGRESS[data["event_type"]]
        if data["event_type"] == "failed" or incoming_rank >= current_rank:
            communication.status = data["event_type"]
            communication.save(update_fields=["status", "updated_at"])

        return Response(
            {
                "receipt_id": event.id,
                "communication_id": communication.id,
                "event_type": event.event_type,
                "status": communication.status,
            },
            status=status.HTTP_201_CREATED,
        )
