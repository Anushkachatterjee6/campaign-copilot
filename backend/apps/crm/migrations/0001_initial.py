from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Customer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("phone", models.CharField(blank=True, max_length=32)),
                ("city", models.CharField(blank=True, max_length=120)),
                (
                    "preferred_channel",
                    models.CharField(
                        choices=[
                            ("email", "Email"),
                            ("whatsapp", "WhatsApp"),
                            ("sms", "SMS"),
                            ("push", "Push"),
                        ],
                        default="email",
                        max_length=20,
                    ),
                ),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="Campaign",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("goal", models.CharField(max_length=255)),
                (
                    "channel",
                    models.CharField(
                        choices=[
                            ("email", "Email"),
                            ("whatsapp", "WhatsApp"),
                            ("sms", "SMS"),
                            ("push", "Push"),
                        ],
                        default="email",
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("scheduled", "Scheduled"),
                            ("active", "Active"),
                            ("paused", "Paused"),
                            ("completed", "Completed"),
                        ],
                        default="draft",
                        max_length=20,
                    ),
                ),
                ("audience_size", models.PositiveIntegerField(default=0)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="Segment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("criteria", models.JSONField(blank=True, default=dict)),
                (
                    "customers",
                    models.ManyToManyField(blank=True, related_name="segments", to="crm.customer"),
                ),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="Order",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("category", models.CharField(max_length=120)),
                ("order_date", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "customer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="orders",
                        to="crm.customer",
                    ),
                ),
            ],
            options={
                "ordering": ["-order_date"],
            },
        ),
        migrations.AddField(
            model_name="campaign",
            name="segment",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="campaigns",
                to="crm.segment",
            ),
        ),
        migrations.CreateModel(
            name="Communication",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("personalized_message", models.TextField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("sent", "Sent"),
                            ("delivered", "Delivered"),
                            ("opened", "Opened"),
                            ("clicked", "Clicked"),
                            ("converted", "Converted"),
                            ("failed", "Failed"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "campaign",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="communications",
                        to="crm.campaign",
                    ),
                ),
                (
                    "customer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="communications",
                        to="crm.customer",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="CommunicationEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "event_type",
                    models.CharField(
                        choices=[
                            ("queued", "Queued"),
                            ("sent", "Sent"),
                            ("delivered", "Delivered"),
                            ("opened", "Opened"),
                            ("clicked", "Clicked"),
                            ("converted", "Converted"),
                            ("failed", "Failed"),
                        ],
                        max_length=20,
                    ),
                ),
                ("timestamp", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "communication",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="events",
                        to="crm.communication",
                    ),
                ),
            ],
            options={
                "ordering": ["-timestamp"],
            },
        ),
        migrations.AddIndex(
            model_name="customer",
            index=models.Index(fields=["name"], name="crm_customer_name_idx"),
        ),
        migrations.AddIndex(
            model_name="customer",
            index=models.Index(fields=["city"], name="crm_customer_city_idx"),
        ),
        migrations.AddIndex(
            model_name="customer",
            index=models.Index(fields=["preferred_channel"], name="crm_customer_channel_idx"),
        ),
        migrations.AddIndex(
            model_name="order",
            index=models.Index(fields=["customer", "-order_date"], name="crm_order_customer_date_idx"),
        ),
        migrations.AddIndex(
            model_name="order",
            index=models.Index(fields=["category"], name="crm_order_category_idx"),
        ),
        migrations.AddIndex(
            model_name="order",
            index=models.Index(fields=["order_date"], name="crm_order_date_idx"),
        ),
        migrations.AddIndex(
            model_name="segment",
            index=models.Index(fields=["name"], name="crm_segment_name_idx"),
        ),
        migrations.AddIndex(
            model_name="campaign",
            index=models.Index(fields=["status"], name="crm_campaign_status_idx"),
        ),
        migrations.AddIndex(
            model_name="campaign",
            index=models.Index(fields=["channel"], name="crm_campaign_channel_idx"),
        ),
        migrations.AddIndex(
            model_name="campaign",
            index=models.Index(fields=["-created_at"], name="crm_campaign_created_idx"),
        ),
        migrations.AddIndex(
            model_name="communication",
            index=models.Index(fields=["campaign", "status"], name="crm_comm_campaign_status_idx"),
        ),
        migrations.AddIndex(
            model_name="communication",
            index=models.Index(fields=["customer", "-created_at"], name="crm_comm_customer_created_idx"),
        ),
        migrations.AddConstraint(
            model_name="communication",
            constraint=models.UniqueConstraint(
                fields=("campaign", "customer"),
                name="unique_campaign_customer_communication",
            ),
        ),
        migrations.AddIndex(
            model_name="communicationevent",
            index=models.Index(fields=["communication", "-timestamp"], name="crm_event_comm_time_idx"),
        ),
        migrations.AddIndex(
            model_name="communicationevent",
            index=models.Index(fields=["event_type"], name="crm_event_type_idx"),
        ),
        migrations.AddIndex(
            model_name="communicationevent",
            index=models.Index(fields=["timestamp"], name="crm_event_time_idx"),
        ),
    ]
