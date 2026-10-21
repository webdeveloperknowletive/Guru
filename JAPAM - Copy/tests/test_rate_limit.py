from app.services.rate_limit_service import RateLimitService
from app.extensions import redis_client


def test_rate_limit_service(app):
    with app.app_context():
        key = "test_limit_key"
        # Reset key
        redis_client.delete(f"rl:{key}")

        # Limit is 3 requests per 60s
        allowed1, rem1, _ = RateLimitService.check_rate_limit(key, 3, 60)
        assert allowed1 is True
        assert rem1 == 2

        allowed2, rem2, _ = RateLimitService.check_rate_limit(key, 3, 60)
        assert allowed2 is True
        assert rem2 == 1

        allowed3, rem3, _ = RateLimitService.check_rate_limit(key, 3, 60)
        assert allowed3 is True
        assert rem3 == 0

        # 4th request exceeds limit
        allowed4, rem4, retry = RateLimitService.check_rate_limit(key, 3, 60)
        assert allowed4 is False
        assert rem4 == 0
        assert retry > 0
