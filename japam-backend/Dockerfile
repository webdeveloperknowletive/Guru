
# ==============================================================================
# SPIRITUAL COMMERCE ADMIN - PRODUCTION DOCKERFILE
# Optimized for Hostinger VPS with Coolify
# ==============================================================================

FROM python:3.13-slim AS base

# Create a non-root application user.
# No apt-get installation is required for curl.
RUN groupadd -g 10001 japam && \
    useradd -u 10001 -g japam -s /bin/bash -m japam

WORKDIR /app

# Install dependencies separately to preserve Docker build cache.
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code.
COPY --chown=japam:japam . /app

# Create upload directories and grant application permissions.
RUN mkdir -p /app/app/static/uploads /app/uploads && \
    chown -R japam:japam /app/app/static/uploads /app/uploads

# Run the application as a non-root user.
USER japam

# Internal application port.
EXPOSE 5000

# Health checks are configured for the backend service in docker-compose.yml.
# Do not define an API health check here because this image is also used
# by the background worker.

# Launch production Gunicorn WSGI server.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "--threads", "2", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-", "wsgi:app"]
