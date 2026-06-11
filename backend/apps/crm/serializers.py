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
            "preferred_channel",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class OrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "customer",
            "customer_name",
            "amount",
            "category",
            "order_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "customer_name", "created_at", "updated_at"]


class SegmentSerializer(serializers.ModelSerializer):
    customer_count = serializers.SerializerMethodField()

    class Meta:
        model = Segment
        fields = [
            "id",
            "name",
            "description",
            "criteria",
            "customers",
            "customer_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "customer_count", "created_at", "updated_at"]

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
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "segment_name", "created_at", "updated_at"]


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
