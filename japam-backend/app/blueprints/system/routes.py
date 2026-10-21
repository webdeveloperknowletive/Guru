from flask import Blueprint, render_template, request, redirect, url_for, flash, Response, abort
from app.extensions import db
from app.models.user import AdminUser, Role, AuditLog
from app.models.operations import SystemSetting
from app.services.rbac_service import login_required, permission_required, get_current_admin
from app.services.report_service import ReportService
from app.services.audit_service import AuditService

system_bp = Blueprint("system", __name__, url_prefix="/admin/system")


# -------------------------------------------------------------
# Admin Users & Roles
# -------------------------------------------------------------
@system_bp.route("/users")
@login_required
@permission_required("system", "manage_users")
def users_list():
    user = get_current_admin()
    users = AdminUser.query.order_by(AdminUser.id.asc()).all()
    roles = Role.query.all()
    return render_template("system/users.html", current_user=user, users=users, roles=roles, active_page="users")


@system_bp.route("/users/create", methods=["POST"])
@login_required
@permission_required("system", "manage_users")
def user_create():
    admin = get_current_admin()
    email = request.form.get("email", "").strip().lower()
    full_name = request.form.get("full_name", "").strip()
    password = request.form.get("password", "")
    role_id = request.form.get("role_id", type=int)

    if not email or not full_name or not password or not role_id:
        flash("All fields are required.", "danger")
        return redirect(url_for("system.users_list"))

    existing = AdminUser.query.filter_by(email=email).first()
    if existing:
        flash(f"User with email '{email}' already exists.", "danger")
        return redirect(url_for("system.users_list"))

    role = Role.query.get(role_id)
    new_user = AdminUser(
        email=email,
        full_name=full_name,
        role_id=role_id,
        is_active=True,
    )
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()

    AuditService.log(
        action="ADMIN_USER_CREATED",
        module="system",
        actor_email=admin.email,
        actor_user_id=admin.id,
        entity_type="AdminUser",
        entity_id=str(new_user.id),
        details={"email": email, "role": role.code if role else "none"},
    )
    flash(f"Admin user '{full_name}' created.", "success")
    return redirect(url_for("system.users_list"))


@system_bp.route("/users/<int:user_id>/role", methods=["POST"])
@login_required
@permission_required("system", "manage_users")
def user_update_role(user_id):
    admin = get_current_admin()
    target_user = AdminUser.query.get_or_404(user_id)
    role_id = request.form.get("role_id", type=int)
    is_active = request.form.get("is_active") == "1"

    role = Role.query.get_or_404(role_id)
    old_role_code = target_user.role.code if target_user.role else "none"

    target_user.role_id = role.id
    target_user.is_active = is_active
    # Invalidate session if deactivated or role modified so changes take immediate effect
    target_user.session_token = None
    db.session.commit()

    AuditService.log(
        action="ADMIN_ROLE_CHANGE",
        module="system",
        actor_email=admin.email,
        actor_user_id=admin.id,
        entity_type="AdminUser",
        entity_id=str(target_user.id),
        details={
            "target_email": target_user.email,
            "old_role": old_role_code,
            "new_role": role.code,
            "is_active": is_active,
        },
    )
    flash(f"Role updated for {target_user.full_name}.", "success")
    return redirect(url_for("system.users_list"))


# -------------------------------------------------------------
# Reports & Exports
# -------------------------------------------------------------
@system_bp.route("/reports")
@login_required
@permission_required("reports", "view")
def reports_page():
    user = get_current_admin()
    metrics = ReportService.get_dashboard_metrics()
    return render_template("system/reports.html", current_user=user, metrics=metrics, active_page="reports")


@system_bp.route("/reports/export/orders.csv")
@login_required
@permission_required("reports", "export")
def export_orders():
    user = get_current_admin()
    csv_data = ReportService.export_orders_csv()

    AuditService.log(
        action="EXPORT_ORDERS_CSV",
        module="system",
        actor_email=user.email,
        actor_user_id=user.id,
        details={"type": "orders_csv"},
    )

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=spiritual_orders_export.csv"}
    )


# -------------------------------------------------------------
# Audit Logs
# -------------------------------------------------------------
@system_bp.route("/audit-logs")
@login_required
@permission_required("system", "view")
def audit_logs_list():
    user = get_current_admin()
    action = request.args.get("action")
    module = request.args.get("module")

    q = AuditLog.query
    if action:
        q = q.filter_by(action=action)
    if module:
        q = q.filter_by(module=module)

    logs = q.order_by(AuditLog.created_at.desc()).limit(100).all()
    return render_template("system/audit_logs.html", current_user=user, logs=logs, selected_action=action, selected_module=module, active_page="audit_logs")


# -------------------------------------------------------------
# System Settings
# -------------------------------------------------------------
@system_bp.route("/settings", methods=["GET", "POST"])
@login_required
@permission_required("system", "manage_settings")
def settings_page():
    user = get_current_admin()

    if request.method == "POST":
        settings_keys = [
            "store_name", "store_tagline", "support_email", "support_phone",
            "default_currency", "business_timezone", "tax_percentage",
            "low_stock_default_threshold", "maintenance_mode"
        ]
        for key in settings_keys:
            val = request.form.get(key, "")
            setting = SystemSetting.query.filter_by(key=key).first()
            if not setting:
                setting = SystemSetting(key=key, value=val)
                db.session.add(setting)
            else:
                setting.value = val

        db.session.commit()
        AuditService.log(
            action="SETTINGS_UPDATE",
            module="system",
            actor_email=user.email,
            actor_user_id=user.id,
            details={"updated_keys": settings_keys},
        )
        flash("System settings saved successfully.", "success")

    # Load all settings
    all_settings = {s.key: s.value for s in SystemSetting.query.all()}
    return render_template("system/settings.html", current_user=user, settings=all_settings, active_page="settings")
