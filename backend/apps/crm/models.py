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


class ChurnRisk(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"


class Customer(TimeStampedModel):
    # ── Identity ──────────────────────────────────────────────────────────────
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, blank=True)
    city = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=120, blank=True)
    preferred_channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        default=Channel.EMAIL,
    )

    # ── Olist source tracing ───────────────────────────────────────────────────
    olist_customer_id = models.CharField(max_length=64, blank=True, default="", db_index=True)

    # ── RFM scores (computed by RFMEngine) ────────────────────────────────────
    rfm_recency = models.PositiveIntegerField(
        default=0,
        help_text="Days since last order. Lower = more recent.",
    )
    rfm_frequency = models.PositiveIntegerField(
        default=0,
        help_text="Total number of orders placed.",
    )
    rfm_monetary = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        help_text="Average order value in INR.",
    )
    rfm_score = models.PositiveSmallIntegerField(
        default=0,
        help_text="Composite RFM quintile score 1-5 (5 = best).",
    )

    # ── Customer Lifetime Value ────────────────────────────────────────────────
    clv = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
        help_text="Customer Lifetime Value = total spend in INR.",
    )

    # ── Churn Risk ────────────────────────────────────────────────────────────
    churn_risk = models.CharField(
        max_length=10,
        choices=ChurnRisk.choices,
        default=ChurnRisk.LOW,
        help_text="Churn risk computed from recency: >180d=high, 90-180d=medium, <90d=low.",
    )

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"], name="crm_customer_name_idx"),
            models.Index(fields=["city"], name="crm_customer_city_idx"),
            models.Index(fields=["preferred_channel"], name="crm_customer_channel_idx"),
            models.Index(fields=["rfm_score"], name="crm_customer_rfm_idx"),
            models.Index(fields=["churn_risk"], name="crm_customer_churn_idx"),
            models.Index(fields=["clv"], name="crm_customer_clv_idx"),
        ]

    def __str__(self) -> str:
        return self.name


# ── Currency conversion constant ───────────────────────────────────────────────
# Rate sourced at project creation (2024). Fixed for reproducibility.
# All stored monetary values are in INR.
BRL_TO_INR_RATE = 15


class Order(TimeStampedModel):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="orders",
    )

    # ── Amount (INR — primary application field) ───────────────────────────────
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        help_text="Order amount in INR (= source_amount_brl × BRL_TO_INR_RATE for Olist data).",
    )

    # ── BRL source (preserved for Olist traceability, null for synthetic data) ─
    source_amount_brl = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Original amount in BRL from Olist dataset. NULL for non-Olist orders.",
    )

    category = models.CharField(max_length=120)
    order_date = models.DateTimeField(default=timezone.now)

    # ── Olist source tracing ───────────────────────────────────────────────────
    olist_order_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    payment_value = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Total payment captured from Olist payments CSV, stored in INR.",
    )
    review_score = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Customer review score 1–5 from Olist reviews CSV.",
    )

    class Meta:
        ordering = ["-order_date"]
        indexes = [
            models.Index(fields=["customer", "-order_date"], name="crm_order_customer_date_idx"),
            models.Index(fields=["category"], name="crm_order_category_idx"),
            models.Index(fields=["order_date"], name="crm_order_date_idx"),
            models.Index(fields=["olist_order_id"], name="crm_order_olist_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.customer.name} - {self.category} - ₹{self.amount}"


class Segment(TimeStampedModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    criteria = models.JSONField(default=dict, blank=True)
    is_prebuilt = models.BooleanField(
        default=False,
        help_text="True for the 5 Olist-derived prebuilt segments.",
    )
    customers = models.ManyToManyField(
        Customer,
        related_name="segments",
        blank=True,
    )

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"], name="crm_segment_name_idx"),
            models.Index(fields=["is_prebuilt"], name="crm_segment_prebuilt_idx"),
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
    message = models.TextField(blank=True, default="")

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
