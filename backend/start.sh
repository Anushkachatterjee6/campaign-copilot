#!/bin/sh
# start.sh — Production startup script for Campaign Copilot backend
# Handles: migrate → idempotent seed → start server
set -e

echo "==> Running database migrations..."
python manage.py migrate --noinput

echo "==> Checking if database needs seeding..."
python manage.py shell -c "
from apps.crm.models import Customer
count = Customer.objects.count()
if count == 0:
    print('Database is empty — seeding now...')
    from django.core.management import call_command
    call_command('seed_data', customers=1000, orders=5000, seed=42)
    call_command('rfm_compute')
    call_command('build_segments')
    print('Seed complete.')
else:
    print(f'Database already has {count} customers — skipping seed.')
"

echo "==> Starting daphne ASGI server on port ${PORT:-8000}..."
exec daphne -b 0.0.0.0 -p "${PORT:-8000}" config.asgi:application
