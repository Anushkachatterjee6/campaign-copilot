from rest_framework import serializers

from .models import (
    Campaign,
    Communication,
    CommunicationEvent,
    Customer,
    Order,
    Segment,
)


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "city",
            "state",
            "preferred_channel",
            # RFM intelligence — all monetary values in INR
            "clv",
            "rfm_score",
            "rfm_recency",
            "rfm_frequency",
            "rfm_monetary",
            "churn_risk",
            "health_score",
            "health_score_label",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "clv", "rfm_score", "rfm_recency",
            "rfm_frequency", "rfm_monetary", "churn_risk",
            "health_score", "health_score_label",
            "created_at", "updated_at",
        ]


class OrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "customer",
            "customer_name",
            # Primary amount field — always in INR
            "amount",
            # BRL source (Olist data only; null for synthetic orders)
            "source_amount_brl",
            "category",
            "order_date",
            "review_score",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "customer_name", "source_amount_brl",
            "review_score", "created_at", "updated_at",
        ]


class SegmentSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing prebuilt segments (no customer list)."""
    customer_count = serializers.SerializerMethodField()

    class Meta:
        model = Segment
        fields = [
            "id",
            "name",
            "description",
            "criteria",
            "is_prebuilt",
            "customer_count",
            "created_at",
        ]
        read_only_fields = ["id", "customer_count", "is_prebuilt", "created_at"]

    def get_customer_count(self, obj: Segment) -> int:
        return obj.customers.count()


class SegmentSerializer(serializers.ModelSerializer):
    customer_count = serializers.SerializerMethodField()

    class Meta:
        model = Segment
        fields = [
            "id",
            "name",
            "description",
            "criteria",
            "is_prebuilt",
            "customers",
            "customer_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "customer_count", "is_prebuilt", "created_at", "updated_at"]

    def get_customer_count(self, obj: Segment) -> int:
        return obj.customers.count()


class CampaignSerializer(serializers.ModelSerializer):
    segment_name = serializers.CharField(source="segment.name", read_only=True)

    class Meta:
        model = Campaign
        fields = [
            "id",
            "name",
            "goal",
            "channel",
            "status",
            "audience_size",
            "segment",
            "segment_name",
            "message",
            "expected_outcome",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "audience_size", "segment_name", "expected_outcome",
            "created_at", "updated_at",
        ]


class CommunicationEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunicationEvent
        fields = [
            "id",
            "communication",
            "event_type",
            "timestamp",
        ]
        read_only_fields = ["id"]


class CommunicationSerializer(serializers.ModelSerializer):
    campaign_name = serializers.CharField(source="campaign.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    events = CommunicationEventSerializer(many=True, read_only=True)

    class Meta:
        model = Communication
        fields = [
            "id",
            "campaign",
            "campaign_name",
            "customer",
            "customer_name",
            "personalized_message",
            "status",
            "events",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "campaign_name",
            "customer_name",
            "events",
            "created_at",
            "updated_at",
        ]


class AudienceBuilderRequestSerializer(serializers.Serializer):
    input = serializers.CharField(max_length=1000, trim_whitespace=True)


class AudienceBuilderResponseSerializer(serializers.Serializer):
    filters = serializers.DictField()
    audience_size = serializers.IntegerField()
    avg_spend = serializers.IntegerField()
    top_city = serializers.CharField(allow_null=True)


class CampaignCopilotRequestSerializer(serializers.Serializer):
    input = serializers.CharField(max_length=1000, trim_whitespace=True)


class CampaignCopilotResponseSerializer(serializers.Serializer):
    campaign_id = serializers.IntegerField(allow_null=True, required=False)
    audience_summary = serializers.DictField()
    reasoning = serializers.CharField()
    recommended_channel = serializers.CharField()
    generated_message = serializers.CharField()
    expected_outcome = serializers.DictField()


class CommunicationReceiptSerializer(serializers.Serializer):
    communication_id = serializers.IntegerField()
    event_type = serializers.ChoiceField(
        choices=[
            "delivered",
            "failed",
            "opened",
            "read",
            "clicked",
        ]
    )
    timestamp = serializers.DateTimeField(required=False)
    recipient = serializers.DictField(required=False)
    channel = serializers.CharField(required=False)
    provider_event_id = serializers.CharField(required=False, allow_blank=True)
    payload = serializers.DictField(required=False)
