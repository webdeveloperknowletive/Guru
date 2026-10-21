import time
import logging
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import redis

logger = logging.getLogger(__name__)

db = SQLAlchemy()
migrate = Migrate()


class InMemoryRedisFallback:
    """Thread-safe in-memory cache/store with TTL support for development/testing when Redis server is offline."""
    def __init__(self):
        self._store = {}
        self._expires = {}

    def _clean_expired(self):
        now = time.time()
        expired_keys = [k for k, exp in self._expires.items() if exp <= now]
        for k in expired_keys:
            self._store.pop(k, None)
            self._expires.pop(k, None)

    def get(self, key):
        self._clean_expired()
        val = self._store.get(str(key))
        if val is not None and isinstance(val, (int, str)):
            return str(val).encode("utf-8")
        return val

    def set(self, key, value, ex=None, px=None):
        self._clean_expired()
        self._store[str(key)] = value
        ttl = ex if ex is not None else (px / 1000.0 if px is not None else None)
        if ttl is not None:
            self._expires[str(key)] = time.time() + ttl
        else:
            self._expires.pop(str(key), None)
        return True

    def setex(self, key, time_secs, value):
        return self.set(key, value, ex=time_secs)

    def incr(self, key):
        self._clean_expired()
        current = self._store.get(str(key), 0)
        try:
            val = int(current) + 1
        except (ValueError, TypeError):
            val = 1
        self._store[str(key)] = val
        return val

    def expire(self, key, seconds):
        if str(key) in self._store:
            self._expires[str(key)] = time.time() + seconds
            return True
        return False

    def ttl(self, key):
        self._clean_expired()
        if str(key) not in self._store:
            return -2
        if str(key) not in self._expires:
            return -1
        remaining = int(self._expires[str(key)] - time.time())
        return max(0, remaining)

    def delete(self, *keys):
        count = 0
        for k in keys:
            if str(k) in self._store:
                self._store.pop(str(k), None)
                self._expires.pop(str(k), None)
                count += 1
        return count

    def exists(self, key):
        self._clean_expired()
        return 1 if str(key) in self._store else 0

    def ping(self):
        return True

    def flushdb(self):
        self._store.clear()
        self._expires.clear()
        return True

    def flushall(self):
        return self.flushdb()


class RedisClientWrapper:
    """Wrapper that tries Redis connection, falling back gracefully to memory store if unavailable."""
    def __init__(self):
        self._client = None
        self._fallback = InMemoryRedisFallback()
        self._is_connected = False

    def init_app(self, app):
        redis_url = app.config.get("REDIS_URL", "redis://localhost:6379/0")
        try:
            client = redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=1)
            client.ping()
            self._client = client
            self._is_connected = True
            logger.info("Connected to Redis server at %s", redis_url)
        except Exception as e:
            self._client = None
            self._is_connected = False
            logger.warning("Redis server unavailable (%s). Using thread-safe in-memory cache/rate-limiter.", e)

    @property
    def is_connected(self):
        return self._is_connected

    def __getattr__(self, name):
        if self._is_connected and self._client is not None:
            try:
                return getattr(self._client, name)
            except Exception as e:
                logger.error("Redis error on %s: %s. Using memory fallback.", name, e)
                return getattr(self._fallback, name)
        return getattr(self._fallback, name)


redis_client = RedisClientWrapper()
