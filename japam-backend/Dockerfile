
# ==============================================================================
# SPIRITUAL COMMERCE ADMIN - PRODUCTION DOCKERFILE
# Optimized for Hostinger VPS with Coolify
# ==============================================================================

# Use BuildKit features for faster dependency installation.
# syntax=docker/dockerfile:1

FROM python:3.13-slim AS base

# Python runtime settings.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Create a non-root application user.
# No apt-get installation is required for the Python-based health check.
RUN groupadd -g 10001 japam && \
    useradd -u 10001 -g japam -s /bin/bash -m japam

WORKDIR /app

# Copy dependency definitions separately to preserve Docker layer caching.
COPY requirements.txt /app/requirements.txt

# Install dependencies with:
# - Persistent BuildKit pip download cache
# - Explicit official PyPI index
# - Additional retries for temporary network failures
# - Longer timeout for slow package downloads
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install \
      --disable-pip-version-check \
      --retries 10 \
      --timeout 120 \
      --index-url https://pypi.org/simple \
      -r /app/requirements.txt

# Copy application source code.
COPY --chown=japam:japam . /app

# Create upload directories and grant application permissions.
RUN mkdir -p /app/app/static/uploads /app/uploads && \
    chown -R japam:japam /app/app/static/uploads /app/uploads

# Run the application as a non-root user.
USER japam

# Internal application port.
EXPOSE 5000

# Health checks are configured in docker-compose.yml.
# Use Python for the backend health check rather than curl.
# The worker overrides this CMD with its own worker command.

# Launch production Gunicorn WSGI server.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "--threads", "2", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-", "wsgi:app"]
