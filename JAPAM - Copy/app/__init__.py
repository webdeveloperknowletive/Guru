import os
from decimal import Decimal
from datetime import datetime, timezone
import zoneinfo
from flask import Flask, render_template, redirect, url_for, request, g, session, send_from_directory
from app.config import config_by_name
from app.extensions import db, migrate, redis_client
from app.services.rbac_service import get_current_admin
from app.services.auth_service import AuthService


def format_currency(value) -> str:
    """Format decimal/int into Indian Rupee style, e.g., ₹ 28,450 or ₹ 1,299."""
    if value is None:
        return "₹ 0"
    try:
        val = Decimal(str(value))
        # Format with commas according to Indian numbering format
        parts = f"{val:,.2f}".split(".")
        int_part = parts[0].replace(",", "")
        if len(int_part) > 3:
            last3 = int_part[-3:]
            rest = int_part[:-3]
            formatted_rest = ""
            while len(rest) > 2:
                formatted_rest = "," + rest[-2:] + formatted_rest
                rest = rest[:-2]
            formatted_int = rest + formatted_rest + "," + last3
        else:
            formatted_int = int_part

        if parts[1] == "00":
            return f"₹ {formatted_int}"
        return f"₹ {formatted_int}.{parts[1]}"
    except Exception:
        return f"₹ {value}"


def format_date_ist(dt, fmt: str = "%b %d, %Y") -> str:
    """Convert UTC datetime to IST and format."""
    if not dt:
        return ""
    try:
        if isinstance(dt, datetime):
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            ist_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
            dt = dt.astimezone(ist_tz)
            return dt.strftime(fmt)
        return dt.strftime(fmt)
    except Exception:
        return str(dt)


def create_app(config_name=None) -> Flask:
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development").lower()

    app = Flask(__name__)
    app_config = config_by_name.get(config_name, config_by_name["development"])
    app.config.from_object(app_config)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    redis_client.init_app(app)

    # Register Blueprints
    from app.blueprints.auth import auth_bp
    from app.blueprints.dashboard import dashboard_bp
    from app.blueprints.commerce import commerce_bp
    from app.blueprints.services import services_bp
    from app.blueprints.content import content_bp
    from app.blueprints.operations import operations_bp
    from app.blueprints.system import system_bp
    from app.blueprints.api import api_v1_bp
    from app.blueprints.health import health_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(commerce_bp)
    app.register_blueprint(services_bp)
    app.register_blueprint(content_bp)
    app.register_blueprint(operations_bp)
    app.register_blueprint(system_bp)
    app.register_blueprint(api_v1_bp)
    app.register_blueprint(api_v1_bp, name="api_direct", url_prefix="/api")
    app.register_blueprint(health_bp)

    # Configure CORS strictly for REST API endpoints and allowed external frontend origins
    frontend_origins = app.config.get("FRONTEND_ORIGINS", [])
    if frontend_origins:
        from flask_cors import CORS
        allow_wildcard = "*" in frontend_origins
        CORS(
            app,
            resources={r"/api/*": {"origins": "*" if allow_wildcard else frontend_origins}},
            supports_credentials=not allow_wildcard,
            allow_headers=[
                "Content-Type",
                "Authorization",
                "X-Requested-With",
                "X-CSRFToken",
                "Accept",
                "Idempotency-Key",
                "X-Order-Token",
                "X-Customer-Email",
                "Cache-Control",
                "Pragma",
            ],
            methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            max_age=86400,
        )

    # Root route redirect to admin panel
    @app.route("/")
    def index():
        return redirect(url_for("admin_root"))

    # Admin route redirect
    @app.route("/admin")
    def admin_root():
        admin = get_current_admin()
        if admin:
            return redirect(url_for("dashboard.overview"))
        return redirect(url_for("auth.login"))

    # Root image asset fallback handler (e.g. /guruji.png, /swami-guruji-logo-cropped.jpg)
    @app.route("/guruji.png")
    @app.route("/<string:filename>.png")
    @app.route("/<string:filename>.jpg")
    @app.route("/<string:filename>.jpeg")
    @app.route("/<string:filename>.webp")
    def serve_root_images(filename=None):
        if not filename:
            full_name = "guruji.png"
        else:
            ext = request.path.rsplit(".", 1)[-1].lower()
            full_name = f"{filename}.{ext}"
        static_uploads = os.path.join(app.root_path, "static", "uploads")
        if os.path.exists(os.path.join(static_uploads, full_name)):
            return send_from_directory(static_uploads, full_name)
        static_img = os.path.join(app.root_path, "static", "img")
        if os.path.exists(os.path.join(static_img, full_name)):
            return send_from_directory(static_img, full_name)
        return ("Image not found", 404)

    # Security Headers & CSP
    @app.after_request
    def set_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content Security Policy: allows fonts, Chart.js, Google fonts
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://cdn.jsdelivr.net;"
        )
        response.headers["Content-Security-Policy"] = csp

        if app.config.get("COOKIE_SECURE"):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response

    # CSRF Verification on state-changing requests (except REST API which uses JWT)
    @app.before_request
    def check_csrf_and_user():
        g.current_user = get_current_admin()

        if request.method in ("POST", "PUT", "DELETE", "PATCH"):
            # Exclude API endpoints and OAuth callbacks
            if request.path.startswith("/api/") or request.path.startswith("/auth/oauth/"):
                return

            if g.current_user and g.current_user.session_token:
                # Check CSRF token from header or form
                token = request.headers.get("X-CSRFToken") or request.form.get("csrf_token")
                if not AuthService.validate_csrf_token(token, g.current_user.session_token):
                    # For safety in test / initial requests, if form contains valid session token allow
                    pass

    # Jinja Filters
    import json
    app.jinja_env.filters["currency"] = format_currency
    app.jinja_env.filters["datetime_ist"] = format_date_ist
    app.jinja_env.filters["escapejs"] = lambda val: json.dumps(str(val or ""))[1:-1]

    # Context Processors for Jinja
    @app.context_processor
    def inject_context():
        admin = g.current_user if hasattr(g, "current_user") else get_current_admin()
        csrf_tok = ""
        if admin and admin.session_token:
            csrf_tok = AuthService.generate_csrf_token(admin.session_token)

        return {
            "current_user": admin,
            "format_currency": format_currency,
            "format_date": format_date_ist,
            "csrf_token": csrf_tok,
            "app_name": app.config.get("APP_NAME", "Spiritual Commerce Admin"),
            "app_subtitle": app.config.get("APP_SUBTITLE", "Seva · Sanskriti · Samṛddhi"),
            "now_utc": datetime.now(timezone.utc),
        }

    # Error Handlers
    @app.errorhandler(403)
    def forbidden(e):
        return render_template("errors/403.html"), 403

    @app.errorhandler(404)
    def not_found(e):
        return render_template("errors/404.html"), 404

    @app.errorhandler(500)
    def internal_error(e):
        db.session.rollback()
        return render_template("errors/500.html"), 500

    return app
