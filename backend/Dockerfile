FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collect static files (no DB required — WhiteNoise serves them)
RUN python manage.py collectstatic --noinput

RUN chmod +x start.sh

EXPOSE 8000

# start.sh handles: migrate → seed if empty → daphne
CMD ["./start.sh"]
