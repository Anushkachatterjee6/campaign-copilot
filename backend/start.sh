#!/bin/sh
# start.sh — Production startup script for Campaign Copilot backend
# Handles: migrate → idempotent seed → start server
set -e

echo "==> Running database migrations..."
python manage.py migrate --noinput

echo "==> Checking if database needs seeding..."
python manage.py shell -c "
from apps.crm.models import Customer, Campaign
customer_count = Customer.objects.count()
if customer_count == 0:
    print('Database is empty — seeding customers, orders, RFM, and segments...')
    from django.core.management import call_command
    call_command('seed_data', customers=1000, orders=5000, seed=42)
    call_command('rfm_compute')
    call_command('build_segments')
    print('Customer seed complete.')
else:
    print(f'Database already has {customer_count} customers — skipping customer seed.')

campaign_count = Campaign.objects.count()
if campaign_count == 0:
    print('No campaigns found — seeding demo campaigns with communication events...')
    from django.core.management import call_command
    call_command('seed_campaigns')
    print('Campaign seed complete.')
else:
    print(f'Database already has {campaign_count} campaigns — skipping campaign seed.')
"

echo "==> Starting daphne ASGI server on port ${PORT:-8000}..."
exec daphne -b 0.0.0.0 -p "${PORT:-8000}" config.asgi:application
