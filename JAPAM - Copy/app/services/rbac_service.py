from functools import wraps
from flask import request, redirect, url_for, flash, abort, jsonify, g
from app.extensions import db
from app.models.user import Role, RolePermission, AdminUser
from app.services.auth_service import AuthService
from app.services.rate_limit_service import RateLimitService

# Canonical Role Definitions
INITIAL_ROLES = {
    "super_admin": {
        "name": "Super Admin",
        "description": "Full access to all system modules, user management, and settings",
        "permissions": [
            ("*", "*")  # Universal access
        ]
    },
    "commerce_manager": {
        "name": "Commerce Manager",
        "description": "Manages catalog, inventory, orders, reviews, coupons, and fulfillment",
        "permissions": [
            ("dashboard", "view"),
            ("commerce", "view"),
            ("commerce", "create"),
            ("commerce", "edit"),
            ("commerce", "archive"),
            ("commerce", "unarchive"),
            ("inventory", "view"),
            ("inventory", "edit"),
            ("orders", "view"),
            ("orders", "edit"),
            ("reviews", "view"),
            ("reviews", "approve"),
            ("operations", "view"),
            ("operations", "create"),
            ("operations", "edit"),
            ("reports", "export"),
        ]
    },
    "services_manager": {
        "name": "Services Manager",
        "description": "Manages Puja services, priest assignments, Jyotish consultations, and calendar slots",
        "permissions": [
            ("dashboard", "view"),
            ("services", "view"),
            ("services", "create"),
            ("services", "edit"),
            ("consultations", "view"),
            ("consultations", "edit"),
            ("consultations", "notes"),
            ("availability", "view"),
            ("availability", "edit"),
            ("reports", "export"),
        ]
    },
    "content_editor": {
        "name": "Content Editor",
        "description": "Manages blog posts, testimonials, guruji profile, and media uploads",
        "permissions": [
            ("dashboard", "view"),
            ("content", "view"),
            ("content", "create"),
            ("content", "edit"),
            ("media", "view"),
            ("media", "upload"),
        ]
    },
    "support": {
        "name": "Support",
        "description": "Customer support: views orders, bookings, enquiries, responds to customers",
        "permissions": [
            ("dashboard", "view"),
            ("commerce", "view"),
            ("orders", "view"),
            ("services", "view"),
            ("consultations", "view"),
            ("enquiries", "view"),
            ("enquiries", "edit"),
        ]
    },
    "read_only": {
        "name": "Read Only",
        "description": "Audit and viewing access across modules with no modification permissions",
        "permissions": [
            ("dashboard", "view"),
            ("commerce", "view"),
            ("orders", "view"),
            ("services", "view"),
            ("consultations", "view"),
            ("content", "view"),
            ("reports", "view"),
        ]
    }
}


def get_current_admin() -> AdminUser | None:
    """Helper to retrieve current authenticated admin user from session cookie or API JWT."""
    # First check Flask g
    if hasattr(g, "current_user") and g.current_user:
        return g.current_user

    # Check session cookie
    from flask import current_app
    cookie_name = current_app.config.get("ADMIN_SESSION_COOKIE", "japam_admin_auth") if current_app else "japam_admin_auth"
    session_token = request.cookies.get(cookie_name)
    if session_token:
        user = AuthService.get_current_user_from_session(session_token)
        if user:
            g.current_user = user
            return user

    # Check Authorization header (Bearer JWT)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        payload = AuthService.verify_jwt(token, "access")
        if payload:
            user = AdminUser.query.filter_by(id=payload.get("sub"), is_active=True).first()
            if user:
                g.current_user = user
                return user

    return None


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_admin()
        if not user:
            if request.path.startswith("/api/"):
                return jsonify({"error": "Unauthorized", "message": "Authentication required"}), 401
            return redirect(url_for("auth.login", next=request.url))
        return f(*args, **kwargs)
    return decorated_function


def permission_required(module: str, action: str):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_admin()
            if not user:
                if request.path.startswith("/api/"):
                    return jsonify({"error": "Unauthorized", "message": "Authentication required"}), 401
                return redirect(url_for("auth.login", next=request.url))

            # Super admin bypass
            if user.role and user.role.code == "super_admin":
                return f(*args, **kwargs)

            # Check explicit permission
            allowed = False
            if user.role:
                for p in user.role.permissions:
                    if (p.module in (module, "*")) and (p.action in (action, "*", "all")):
                        allowed = True
                        break

            if not allowed:
                if request.path.startswith("/api/"):
                    return jsonify({
                        "error": "Forbidden",
                        "message": f"You lack permission to {action} on {module}."
                    }), 403
                abort(403)

            return f(*args, **kwargs)
        return decorated_function
    return decorator


def seed_roles_and_permissions():
    """Ensure all default roles and permissions exist in database."""
    for code, info in INITIAL_ROLES.items():
        role = Role.query.filter_by(code=code).first()
        if not role:
            role = Role(name=info["name"], code=code, description=info["description"])
            db.session.add(role)
            db.session.flush()

        # Sync permissions
        existing = {(p.module, p.action) for p in role.permissions}
        for mod, act in info["permissions"]:
            if (mod, act) not in existing:
                rp = RolePermission(role_id=role.id, module=mod, action=act)
                db.session.add(rp)
    db.session.commit()
