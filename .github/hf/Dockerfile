# HuggingFace Spaces Dockerfile
# Used by GitHub Actions (.github/workflows/deploy-hf.yml) to deploy the backend.
# HF Spaces requires the app to listen on port 7860.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# HuggingFace Spaces injects PORT=7860; start.sh reads ${PORT:-7860}
ENV PORT=7860

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collect static files at build time (no DB needed for this step)
RUN python manage.py collectstatic --noinput

RUN chmod +x start.sh

EXPOSE 7860

# start.sh handles: migrate → seed if empty → daphne
CMD ["./start.sh"]
