import os
from datetime import timedelta
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-spiritual-admin-secret-key-change-in-prod-2024")
    APP_NAME = os.getenv("APP_NAME", "Spiritual Commerce Admin")
    APP_SUBTITLE = os.getenv("APP_SUBTITLE", "Seva · Sanskriti · Samṛddhi")
    TIMEZONE = os.getenv("TIMEZONE", "Asia/Kolkata")

    # Database
    # Support both PostgreSQL and local SQLite fallback
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'japam_admin.db')}")
    # Normalize postgres:// to postgresql+psycopg:// if needed
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
    elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+psycopg://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
    }

    # Redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_RATE_LIMIT_PREFIX = os.getenv("REDIS_RATE_LIMIT_PREFIX", "rl:")
    REDIS_TOKEN_BLACKLIST_PREFIX = os.getenv("REDIS_TOKEN_BLACKLIST_PREFIX", "bl:")

    # Cookies and Sessions
    SESSION_COOKIE_NAME = "japam_fl_session"
    ADMIN_SESSION_COOKIE = os.getenv("ADMIN_SESSION_COOKIE", "japam_admin_auth")
    COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() in ("true", "1", "yes")
    COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "Lax")
    SESSION_EXPIRY_HOURS = int(os.getenv("SESSION_EXPIRY_HOURS", "12"))

    # CORS & Frontend Origins
    # Configurable allowed origins for external storefront integration
    FRONTEND_ORIGINS = [
        o.strip()
        for o in os.getenv("FRONTEND_ORIGINS", os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173")).split(",")
        if o.strip()
    ]

    # JWT
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-spiritual-secret-key-change-in-prod-2024")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "60")))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "14")))

    # CSRF
    CSRF_SECRET_KEY = os.getenv("CSRF_SECRET_KEY", "csrf-spiritual-protection-key-32chars")

    # Uploads
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", os.path.join(BASE_DIR, "app", "static", "uploads"))
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 10 * 1024 * 1024))  # 10 MB
    ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "svg", "pdf"}

    # Rate Limiting
    LOGIN_RATE_LIMIT_PER_MINUTE = int(os.getenv("LOGIN_RATE_LIMIT_PER_MINUTE", "5"))
    PASSWORD_RESET_RATE_LIMIT_PER_MINUTE = int(os.getenv("PASSWORD_RESET_RATE_LIMIT_PER_MINUTE", "3"))
    API_RATE_LIMIT_PER_MINUTE = int(os.getenv("API_RATE_LIMIT_PER_MINUTE", "120"))

    # Payment Gateway & Webhook
    PAYMENT_WEBHOOK_SECRET = os.getenv("PAYMENT_WEBHOOK_SECRET", "")
    RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

    # OAuth
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_DISCOVERY_URL = os.getenv("GOOGLE_DISCOVERY_URL", "https://accounts.google.com/.well-known/openid-configuration")
    GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")


class DevelopmentConfig(Config):
    DEBUG = True
    COOKIE_SECURE = False
    PAYMENT_WEBHOOK_SECRET = os.getenv("PAYMENT_WEBHOOK_SECRET", "whsec_dev_mode_webhook_secret_32chars")


class TestingConfig(Config):
    TESTING = True
    DEBUG = True
    DATABASE_URL = "sqlite:///:memory:"
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    COOKIE_SECURE = False
    WTF_CSRF_ENABLED = False
    PAYMENT_WEBHOOK_SECRET = "whsec_test_secret_32_chars_long_for_hmac"


class ProductionConfig(Config):
    DEBUG = False
    COOKIE_SECURE = True
    # In production, SQLAlchemy pool parameters can be tuned
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "20")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
        "pool_pre_ping": True,
        "pool_recycle": 1800,
    }


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}
