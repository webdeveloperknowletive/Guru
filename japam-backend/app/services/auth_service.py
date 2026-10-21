import hmac
import hashlib
import secrets
import time
import logging
from datetime import datetime, timezone, timedelta
import jwt
from flask import request, current_app
from app.extensions import db, redis_client
from app.models.user import AdminUser
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class AuthService:
    # -------------------------------------------------------------
    # Password Verification & User Session
    # -------------------------------------------------------------
    @classmethod
    def authenticate_admin(cls, email: str, password: str, ip_address: str) -> tuple[AdminUser | None, str | None]:
        """
        Verify credentials, enforce account lockout, and update login stats.
        Returns (user, error_message).
        """
        user = AdminUser.query.filter_by(email=email.strip().lower()).first()
        now = datetime.now(timezone.utc)

        if not user:
            AuditService.log(
                action="FAILED_LOGIN",
                module="auth",
                actor_email=email,
                details={"reason": "User not found"},
                ip_address=ip_address,
            )
            return None, "Invalid email or password."

        # Check account lockout
        if user.locked_until and user.locked_until.replace(tzinfo=timezone.utc) > now:
            remaining_mins = int((user.locked_until.replace(tzinfo=timezone.utc) - now).total_seconds() / 60) + 1
            AuditService.log(
                action="LOCKED_LOGIN_ATTEMPT",
                module="auth",
                actor_email=email,
                actor_user_id=user.id,
                details={"locked_until": str(user.locked_until)},
                ip_address=ip_address,
            )
            return None, f"Account is temporarily locked due to multiple failed attempts. Try again in {remaining_mins} minutes."

        if not user.is_active:
            AuditService.log(
                action="INACTIVE_LOGIN_ATTEMPT",
                module="auth",
                actor_email=email,
                actor_user_id=user.id,
                details={"reason": "Account deactivated"},
                ip_address=ip_address,
            )
            return None, "This admin account has been deactivated. Contact Super Admin."

        if not user.check_password(password):
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = now + timedelta(minutes=15)
                msg = "Account locked for 15 minutes due to 5 consecutive failed attempts."
            else:
                msg = f"Invalid email or password. ({5 - user.failed_login_attempts} attempts remaining)"
            db.session.commit()

            AuditService.log(
                action="FAILED_LOGIN",
                module="auth",
                actor_email=email,
                actor_user_id=user.id,
                details={"failed_attempts": user.failed_login_attempts},
                ip_address=ip_address,
            )
            return None, msg

        # Success: reset failed attempts, generate session token
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = now
        user.last_login_ip = ip_address
        user.session_token = secrets.token_hex(32)
        db.session.commit()

        AuditService.log(
            action="LOGIN_SUCCESS",
            module="auth",
            actor_email=email,
            actor_user_id=user.id,
            details={"role": user.role.code if user.role else "none"},
            ip_address=ip_address,
        )
        return user, None

    @classmethod
    def get_current_user_from_session(cls, session_token: str | None) -> AdminUser | None:
        """Validate session token from cookie."""
        if not session_token:
            return None
        user = AdminUser.query.filter_by(session_token=session_token, is_active=True).first()
        return user

    @classmethod
    def logout_admin(cls, user: AdminUser, ip_address: str):
        """Invalidate session token and log out."""
        if user:
            old_token = user.session_token
            user.session_token = None
            db.session.commit()
            AuditService.log(
                action="LOGOUT",
                module="auth",
                actor_email=user.email,
                actor_user_id=user.id,
                details={"session_invalidated": bool(old_token)},
                ip_address=ip_address,
            )

    # -------------------------------------------------------------
    # CSRF Protection
    # -------------------------------------------------------------
    @classmethod
    def generate_csrf_token(cls, session_token: str) -> str:
        """Generate a deterministic HMAC CSRF token keyed to session token."""
        secret = current_app.config.get("CSRF_SECRET_KEY", "csrf-spiritual-default")
        mac = hmac.new(secret.encode("utf-8"), session_token.encode("utf-8"), hashlib.sha256).hexdigest()
        return f"{session_token[:12]}:{mac}"

    @classmethod
    def validate_csrf_token(cls, token: str, session_token: str) -> bool:
        """Verify CSRF token authenticity."""
        if not token or not session_token or ":" not in token:
            return False
        expected = cls.generate_csrf_token(session_token)
        return hmac.compare_digest(token, expected)

    # -------------------------------------------------------------
    # JWT Tokens for REST APIs
    # -------------------------------------------------------------
    @classmethod
    def generate_jwt_tokens(cls, user: AdminUser) -> dict:
        secret = current_app.config.get("JWT_SECRET_KEY", "jwt-spiritual-secret")
        now = datetime.now(timezone.utc)
        access_exp = now + current_app.config.get("JWT_ACCESS_TOKEN_EXPIRES", timedelta(minutes=60))
        refresh_exp = now + current_app.config.get("JWT_REFRESH_TOKEN_EXPIRES", timedelta(days=14))

        access_jti = secrets.token_hex(16)
        refresh_jti = secrets.token_hex(16)

        access_payload = {
            "sub": str(user.id),
            "uuid": user.uuid,
            "email": user.email,
            "role": user.role.code if user.role else "read_only",
            "type": "access",
            "jti": access_jti,
            "iat": int(now.timestamp()),
            "exp": int(access_exp.timestamp()),
        }

        refresh_payload = {
            "sub": str(user.id),
            "uuid": user.uuid,
            "type": "refresh",
            "jti": refresh_jti,
            "iat": int(now.timestamp()),
            "exp": int(refresh_exp.timestamp()),
        }

        access_token = jwt.encode(access_payload, secret, algorithm="HS256")
        refresh_token = jwt.encode(refresh_payload, secret, algorithm="HS256")

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "expires_in": int((access_exp - now).total_seconds()),
        }

    @classmethod
    def verify_jwt(cls, token: str, token_type: str = "access") -> dict | None:
        """Decode JWT and check revocation list."""
        secret = current_app.config.get("JWT_SECRET_KEY", "jwt-spiritual-secret")
        try:
            payload = jwt.decode(token, secret, algorithms=["HS256"])
            if payload.get("type") != token_type:
                return None
            jti = payload.get("jti")
            if jti and cls.is_token_revoked(jti):
                return None
            return payload
        except (jwt.PyJWTError, Exception):
            return None

    @classmethod
    def revoke_jwt(cls, jti: str, exp_timestamp: int):
        """Add JTI to Redis revocation blocklist until expiration."""
        prefix = current_app.config.get("REDIS_TOKEN_BLACKLIST_PREFIX", "bl:")
        remaining = max(1, exp_timestamp - int(time.time()))
        redis_client.setex(f"{prefix}{jti}", remaining, "1")

    @classmethod
    def is_token_revoked(cls, jti: str) -> bool:
        prefix = current_app.config.get("REDIS_TOKEN_BLACKLIST_PREFIX", "bl:")
        return redis_client.exists(f"{prefix}{jti}") == 1
