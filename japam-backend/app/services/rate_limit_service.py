import time
from flask import request, current_app
from app.extensions import redis_client


class RateLimitService:
    @staticmethod
    def get_client_ip() -> str:
        # If Coolify / reverse proxy is used, check X-Forwarded-For carefully
        # In production with trusted reverse proxy (Traefik in Coolify), leftmost IP in X-Forwarded-For is client
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # First element is the client IP
            client_ip = forwarded_for.split(",")[0].strip()
            if client_ip:
                return client_ip
        return request.remote_addr or "127.0.0.1"

    @classmethod
    def check_rate_limit(cls, key: str, max_requests: int, window_seconds: int = 60) -> tuple[bool, int, int]:
        """
        Check rate limit using Redis / fallback memory store.
        Returns (is_allowed, remaining, retry_after_seconds)
        """
        prefix = current_app.config.get("REDIS_RATE_LIMIT_PREFIX", "rl:")
        full_key = f"{prefix}{key}"
        now = int(time.time())

        # Increment count
        count = redis_client.incr(full_key)
        if count == 1:
            # First hit, set window expiry
            redis_client.expire(full_key, window_seconds)
            return True, max_requests - 1, 0

        ttl = redis_client.ttl(full_key)
        if ttl <= 0:
            ttl = window_seconds
            redis_client.expire(full_key, window_seconds)

        if count > max_requests:
            return False, 0, ttl

        return True, max_requests - count, 0

    @classmethod
    def check_login_rate_limit(cls, identifier: str) -> tuple[bool, int, int]:
        """Check rate limit for admin login attempts by IP and email identifier"""
        ip = cls.get_client_ip()
        limit = current_app.config.get("LOGIN_RATE_LIMIT_PER_MINUTE", 5)

        # Check IP limit
        allowed_ip, remaining_ip, retry_ip = cls.check_rate_limit(f"login_ip:{ip}", limit, 60)
        if not allowed_ip:
            return False, 0, retry_ip

        # Check account identifier limit if provided
        if identifier:
            clean_id = identifier.strip().lower()
            allowed_id, remaining_id, retry_id = cls.check_rate_limit(f"login_acc:{clean_id}", limit, 60)
            if not allowed_id:
                return False, 0, retry_id
            return True, min(remaining_ip, remaining_id), 0

        return True, remaining_ip, 0

    @classmethod
    def check_password_reset_limit(cls, email: str) -> tuple[bool, int, int]:
        ip = cls.get_client_ip()
        limit = current_app.config.get("PASSWORD_RESET_RATE_LIMIT_PER_MINUTE", 3)
        return cls.check_rate_limit(f"pw_reset:{ip}:{email.strip().lower()}", limit, 300)
