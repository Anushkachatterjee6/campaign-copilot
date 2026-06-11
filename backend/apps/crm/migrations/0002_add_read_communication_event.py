from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="communication",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("sent", "Sent"),
                    ("delivered", "Delivered"),
                    ("opened", "Opened"),
                    ("read", "Read"),
                    ("clicked", "Clicked"),
                    ("converted", "Converted"),
                    ("failed", "Failed"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="communicationevent",
            name="event_type",
            field=models.CharField(
                choices=[
                    ("queued", "Queued"),
                    ("sent", "Sent"),
                    ("delivered", "Delivered"),
                    ("opened", "Opened"),
                    ("read", "Read"),
                    ("clicked", "Clicked"),
                    ("converted", "Converted"),
                    ("failed", "Failed"),
                ],
                max_length=20,
            ),
        ),
    ]
