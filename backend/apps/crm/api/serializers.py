from rest_framework import serializers


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
