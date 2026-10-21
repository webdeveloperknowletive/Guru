import logging
from datetime import datetime, timezone
from flask import request
from app.extensions import db
from app.models.user import AuditLog

logger = logging.getLogger(__name__)

# List of sensitive keys that should never be stored in audit logs
SENSITIVE_KEYS = {
    "password", "password_hash", "token", "access_token", "refresh_token",
    "secret", "jwt", "authorization", "csrf_token", "dob", "tob", "pob",
    "credit_card", "card_number", "cvv"
}


def sanitize_dict(data: dict) -> dict:
    if not isinstance(data, dict):
        return data
    sanitized = {}
    for k, v in data.items():
        if any(sens in k.lower() for sens in SENSITIVE_KEYS):
            sanitized[k] = "[REDACTED]"
        elif isinstance(v, dict):
            sanitized[k] = sanitize_dict(v)
        elif isinstance(v, list):
            sanitized[k] = [sanitize_dict(item) if isinstance(item, dict) else item for item in v]
        else:
            sanitized[k] = v
    return sanitized


class AuditService:
    @staticmethod
    def log(
        action: str,
        module: str,
        actor_email: str,
        actor_user_id: int | None = None,
        entity_type: str | None = None,
        entity_id: str | None = None,
        details: dict | None = None,
        ip_address: str | None = None,
    ) -> AuditLog:
        """Create an immutable audit log entry."""
        if details is None:
            details = {}

        sanitized_details = sanitize_dict(details)

        if not ip_address and request:
            forwarded = request.headers.get("X-Forwarded-For")
            ip_address = forwarded.split(",")[0].strip() if forwarded else request.remote_addr

        try:
            log_entry = AuditLog(
                actor_user_id=actor_user_id,
                actor_email=actor_email,
                action=action,
                module=module,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id else None,
                details=sanitized_details,
                ip_address=ip_address or "127.0.0.1",
                created_at=datetime.now(timezone.utc),
            )
            db.session.add(log_entry)
            db.session.commit()
            return log_entry
        except Exception as e:
            logger.error("Failed to write audit log: %s", e)
            db.session.rollback()
            return None
