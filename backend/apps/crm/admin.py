from django.contrib import admin

from .models import (
    Campaign,
    Communication,
    CommunicationEvent,
    Customer,
    Order,
    Segment,
)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "city", "preferred_channel", "created_at")
    list_filter = ("preferred_channel", "city", "created_at")
    search_fields = ("name", "email", "phone", "city")
    ordering = ("name",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("customer", "amount", "category", "order_date", "created_at")
    list_filter = ("category", "order_date")
    search_fields = ("customer__name", "customer__email", "category")
    autocomplete_fields = ("customer",)
    date_hierarchy = "order_date"


@admin.register(Segment)
class SegmentAdmin(admin.ModelAdmin):
    list_display = ("name", "customer_count", "created_at")
    search_fields = ("name", "description")
    filter_horizontal = ("customers",)

    @admin.display(description="Customers")
    def customer_count(self, obj: Segment) -> int:
        return obj.customers.count()


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ("name", "goal", "channel", "status", "audience_size", "segment", "created_at")
    list_filter = ("channel", "status", "created_at")
    search_fields = ("name", "goal", "segment__name")
    autocomplete_fields = ("segment",)


class CommunicationEventInline(admin.TabularInline):
    model = CommunicationEvent
    extra = 0
    fields = ("event_type", "timestamp")
    readonly_fields = ("timestamp",)


@admin.register(Communication)
class CommunicationAdmin(admin.ModelAdmin):
    list_display = ("campaign", "customer", "status", "created_at")
    list_filter = ("status", "campaign__channel", "created_at")
    search_fields = ("campaign__name", "customer__name", "customer__email", "personalized_message")
    autocomplete_fields = ("campaign", "customer")
    inlines = (CommunicationEventInline,)


@admin.register(CommunicationEvent)
class CommunicationEventAdmin(admin.ModelAdmin):
    list_display = ("communication", "event_type", "timestamp")
    list_filter = ("event_type", "timestamp")
    search_fields = ("communication__campaign__name", "communication__customer__name", "communication__customer__email")
    autocomplete_fields = ("communication",)
    date_hierarchy = "timestamp"
