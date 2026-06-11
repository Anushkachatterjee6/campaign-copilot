from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Channel(models.TextChoices):
    EMAIL = "email", "Email"
    WHATSAPP = "whatsapp", "WhatsApp"
    SMS = "sms", "SMS"
    PUSH = "push", "Push"


class Customer(TimeStampedModel):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, blank=True)
    city = models.CharField(max_length=120, blank=True)
    preferred_channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        default=Channel.EMAIL,
    )

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"], name="crm_customer_name_idx"),
            models.Index(fields=["city"], name="crm_customer_city_idx"),
            models.Index(fields=["preferred_channel"], name="crm_customer_channel_idx"),
        ]

    def __str__(self) -> str:
        return self.name


class Order(TimeStampedModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="orders",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(max_length=120)
    order_date = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-order_date"]
        indexes = [
            models.Index(fields=["customer", "-order_date"], name="crm_order_customer_date_idx"),
            models.Index(fields=["category"], name="crm_order_category_idx"),
            models.Index(fields=["order_date"], name="crm_order_date_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.customer.name} - {self.category} - {self.amount}"


class Segment(TimeStampedModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    criteria = models.JSONField(default=dict, blank=True)
    customers = models.ManyToManyField(
        Customer,
        related_name="segments",
        blank=True,
    )

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"], name="crm_segment_name_idx"),
        ]

    def __str__(self) -> str:
        return self.name


class CampaignStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SCHEDULED = "scheduled", "Scheduled"
    ACTIVE = "active", "Active"
    PAUSED = "paused", "Paused"
    COMPLETED = "completed", "Completed"


class Campaign(TimeStampedModel):
    name = models.CharField(max_length=255)
    goal = models.CharField(max_length=255)
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        default=Channel.EMAIL,
    )
    status = models.CharField(
        max_length=20,
        choices=CampaignStatus.choices,
        default=CampaignStatus.DRAFT,
    )
    audience_size = models.PositiveIntegerField(default=0)
    segment = models.ForeignKey(
        Segment,
        on_delete=models.SET_NULL,
        related_name="campaigns",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"], name="crm_campaign_status_idx"),
            models.Index(fields=["channel"], name="crm_campaign_channel_idx"),
            models.Index(fields=["-created_at"], name="crm_campaign_created_idx"),
        ]

    def __str__(self) -> str:
        return self.name


class CommunicationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SENT = "sent", "Sent"
    DELIVERED = "delivered", "Delivered"
    OPENED = "opened", "Opened"
    READ = "read", "Read"
    CLICKED = "clicked", "Clicked"
    CONVERTED = "converted", "Converted"
    FAILED = "failed", "Failed"


class Communication(TimeStampedModel):
    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="communications",
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="communications",
    )
    personalized_message = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=CommunicationStatus.choices,
        default=CommunicationStatus.PENDING,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["campaign", "status"], name="crm_comm_campaign_status_idx"),
            models.Index(fields=["customer", "-created_at"], name="crm_comm_customer_created_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["campaign", "customer"],
                name="unique_campaign_customer_communication",
            )
        ]

    def __str__(self) -> str:
        return f"{self.campaign.name} -> {self.customer.name}"


class CommunicationEventType(models.TextChoices):
    QUEUED = "queued", "Queued"
    SENT = "sent", "Sent"
    DELIVERED = "delivered", "Delivered"
    OPENED = "opened", "Opened"
    READ = "read", "Read"
    CLICKED = "clicked", "Clicked"
    CONVERTED = "converted", "Converted"
    FAILED = "failed", "Failed"


class CommunicationEvent(models.Model):
    communication = models.ForeignKey(
        Communication,
        on_delete=models.CASCADE,
        related_name="events",
    )
    event_type = models.CharField(
        max_length=20,
        choices=CommunicationEventType.choices,
    )
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["communication", "-timestamp"], name="crm_event_comm_time_idx"),
            models.Index(fields=["event_type"], name="crm_event_type_idx"),
            models.Index(fields=["timestamp"], name="crm_event_time_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.communication_id} - {self.event_type} at {self.timestamp:%Y-%m-%d %H:%M}"
