# ==============================================================================
# SPIRITUAL COMMERCE ADMIN - PRODUCTION DOCKERFILE
# Optimized for Hostinger VPS with Coolify
# ==============================================================================

FROM python:3.13-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root application user
RUN groupadd -g 10001 japam && \
    useradd -u 10001 -g japam -s /bin/bash -m japam

WORKDIR /app

# Install Python requirements
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY --chown=japam:japam . /app

# Create upload directory and grant permissions
RUN mkdir -p /app/app/static/uploads /app/uploads && \
    chown -R japam:japam /app/app/static/uploads /app/uploads

# Switch to non-root user
USER japam

# Expose internal port
EXPOSE 5000

# Health check probe for Coolify
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:5000/health/live || exit 1

# Launch production Gunicorn WSGI server
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "--threads", "2", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-", "wsgi:app"]
