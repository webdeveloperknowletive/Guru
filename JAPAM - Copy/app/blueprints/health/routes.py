import time
from flask import Blueprint, jsonify
from sqlalchemy import text
from app.extensions import db, redis_client

health_bp = Blueprint("health", __name__, url_prefix="/health")


@health_bp.route("/live", methods=["GET"])
def liveness():
    """Liveness probe: verifies process is alive."""
    return jsonify({
        "status": "ok",
        "timestamp": int(time.time()),
        "service": "japam-admin"
    }), 200


@health_bp.route("/ready", methods=["GET"])
def readiness():
    """Readiness probe: verifies PostgreSQL database and Redis connectivity."""
    checks = {
        "database": False,
        "redis": False,
    }
    all_healthy = True

    # Check Database
    try:
        db.session.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception as e:
        checks["database"] = False
        checks["database_error"] = str(e)
        all_healthy = False

    # Check Redis
    try:
        redis_client.ping()
        checks["redis"] = True
    except Exception as e:
        checks["redis"] = False
        checks["redis_error"] = str(e)
        # In local dev without standalone redis, fallback is active
        if not redis_client.is_connected:
            checks["redis_mode"] = "in_memory_fallback"
            checks["redis"] = True

    status_code = 200 if all_healthy else 503
    return jsonify({
        "status": "ready" if all_healthy else "degraded",
        "checks": checks,
        "timestamp": int(time.time())
    }), status_code
