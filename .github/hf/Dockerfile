# HuggingFace Spaces Dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=7860

# Hugging Face Spaces require running as a non-root user with UID 1000
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=user . .

# Collect static files at build time (no DB needed for this step)
RUN python manage.py collectstatic --noinput

RUN chmod +x start.sh

EXPOSE 7860

# start.sh handles: migrate → seed if empty → daphne
CMD ["./start.sh"]
