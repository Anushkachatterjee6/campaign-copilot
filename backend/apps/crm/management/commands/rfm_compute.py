"""
RFM Compute Management Command
================================
Computes RFM scores, CLV, and Churn Risk for all customers.

Usage:
    py manage.py rfm_compute
"""

from django.core.management.base import BaseCommand

from apps.crm.services.rfm_engine import RFMEngine


class Command(BaseCommand):
    help = "Compute RFM scores, CLV, and Churn Risk for all customers. All values in INR."

    def handle(self, *args, **options):
        self.stdout.write("🧮  Computing RFM scores, CLV, and Churn Risk…")
        engine = RFMEngine()
        updated = engine.compute_all()
        self.stdout.write(
            self.style.SUCCESS(f"✅  Updated {updated} customers with RFM data (all amounts in INR).")
        )
