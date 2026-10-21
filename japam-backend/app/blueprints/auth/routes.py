from flask import Blueprint, render_template, request, redirect, url_for, flash, make_response, current_app
from app.services.auth_service import AuthService
from app.services.rate_limit_service import RateLimitService
from app.services.rbac_service import get_current_admin
from app.models.user import AdminUser

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    current_user = get_current_admin()
    if current_user:
        return redirect(url_for("dashboard.overview"))

    error = None
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")
        remember = request.form.get("remember") == "on"

        # Rate Limiting check
        allowed, remaining, retry_after = RateLimitService.check_login_rate_limit(email)
        if not allowed:
            error = f"Too many login attempts. Please wait {retry_after} seconds before trying again."
            return render_template("auth/login.html", error=error, email=email), 429

        ip_addr = RateLimitService.get_client_ip()
        user, err_msg = AuthService.authenticate_admin(email, password, ip_addr)

        if user:
            # Login successful: set HttpOnly, Secure session cookie
            next_url = request.args.get("next") or url_for("dashboard.overview")
            resp = make_response(redirect(next_url))

            cookie_name = current_app.config.get("ADMIN_SESSION_COOKIE", "japam_admin_auth")
            is_secure = current_app.config.get("COOKIE_SECURE", False)
            samesite = current_app.config.get("COOKIE_SAMESITE", "Lax")
            max_age = 30 * 86400 if remember else 12 * 3600

            resp.set_cookie(
                cookie_name,
                user.session_token,
                max_age=max_age,
                httponly=True,
                secure=is_secure,
                samesite=samesite,
                path="/",
            )
            flash("Welcome back to Spiritual Commerce Admin.", "success")
            return resp
        else:
            error = err_msg

    oauth_enabled = bool(current_app.config.get("GOOGLE_CLIENT_ID"))
    return render_template("auth/login.html", error=error, oauth_enabled=oauth_enabled)


@auth_bp.route("/logout", methods=["GET", "POST"])
def logout():
    user = get_current_admin()
    ip_addr = RateLimitService.get_client_ip()
    if user:
        AuthService.logout_admin(user, ip_addr)

    cookie_name = current_app.config.get("ADMIN_SESSION_COOKIE", "japam_admin_auth")
    resp = make_response(redirect(url_for("auth.login")))
    resp.delete_cookie(cookie_name, path="/")
    flash("You have been securely signed out.", "info")
    return resp


@auth_bp.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    message = None
    error = None
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        allowed, _, retry_after = RateLimitService.check_password_reset_limit(email)
        if not allowed:
            error = f"Too many requests. Please wait {retry_after} seconds."
            return render_template("auth/forgot_password.html", error=error), 429

        user = AdminUser.query.filter_by(email=email.lower()).first()
        if user:
            # In production, dispatch reset email via worker
            message = f"If an active admin account exists for {email}, a secure password reset link has been dispatched."
        else:
            # Prevent email enumeration
            message = f"If an active admin account exists for {email}, a secure password reset link has been dispatched."

    return render_template("auth/forgot_password.html", message=message, error=error)


@auth_bp.route("/oauth/google")
def oauth_google_start():
    client_id = current_app.config.get("GOOGLE_CLIENT_ID")
    if not client_id:
        flash("Google OpenID Connect login is not configured on this server.", "warning")
        return redirect(url_for("auth.login"))

    redirect_uri = current_app.config.get("GOOGLE_REDIRECT_URI") or url_for("auth.oauth_google_callback", _external=True)
    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"response_type=code&"
        f"scope=openid%20email%20profile&"
        f"redirect_uri={redirect_uri}&"
        f"state=sec_state_japam&"
        f"nonce=sec_nonce_japam"
    )
    return redirect(google_auth_url)


@auth_bp.route("/oauth/google/callback")
def oauth_google_callback():
    flash("Google OAuth authentication simulated: please sign in with your authorized admin credentials.", "info")
    return redirect(url_for("auth.login"))
