import uuid
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db


class Role(db.Model):
    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    description = db.Column(db.String(255), nullable=True)

    permissions = db.relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")
    users = db.relationship("AdminUser", back_populates="role")

    def __repr__(self):
        return f"<Role {self.code}>"


class RolePermission(db.Model):
    __tablename__ = "role_permissions"

    id = db.Column(db.Integer, primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    module = db.Column(db.String(50), nullable=False)  # commerce, services, content, operations, system, etc.
    action = db.Column(db.String(50), nullable=False)  # view, create, edit, approve, refund, export, manage_users, manage_settings

    role = db.relationship("Role", back_populates="permissions")

    __table_args__ = (
        db.UniqueConstraint("role_id", "module", "action", name="uq_role_module_action"),
    )

    def __repr__(self):
        return f"<RolePermission {self.role_id}:{self.module}:{self.action}>"


class AdminUser(db.Model):
    __tablename__ = "admin_users"

    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True, default=lambda: str(uuid.uuid4()), index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(150), nullable=False)
    avatar_url = db.Column(db.String(500), nullable=True)

    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=False, index=True)
    role = db.relationship("Role", back_populates="users")

    is_active = db.Column(db.Boolean, default=True, nullable=False)
    mfa_enabled = db.Column(db.Boolean, default=False, nullable=False)
    mfa_secret = db.Column(db.String(64), nullable=True)

    # Session and security tracking
    session_token = db.Column(db.String(64), nullable=True, index=True)
    failed_login_attempts = db.Column(db.Integer, default=0, nullable=False)
    locked_until = db.Column(db.DateTime, nullable=True)
    last_login_at = db.Column(db.DateTime, nullable=True)
    last_login_ip = db.Column(db.String(45), nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password, method="scrypt")

    def check_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def has_permission(self, module: str, action: str) -> bool:
        if not self.is_active:
            return False
        if self.role and self.role.code == "super_admin":
            return True
        if not self.role:
            return False
        for p in self.role.permissions:
            if p.module == module and p.action in (action, "all"):
                return True
        return False

    def __repr__(self):
        return f"<AdminUser {self.email}>"


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    actor_user_id = db.Column(db.Integer, db.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_email = db.Column(db.String(255), nullable=False, index=True)
    action = db.Column(db.String(100), nullable=False, index=True)  # LOGIN, LOGOUT, PRICE_CHANGE, STOCK_ADJUST, etc.
    module = db.Column(db.String(50), nullable=False, index=True)
    entity_type = db.Column(db.String(50), nullable=True)
    entity_id = db.Column(db.String(100), nullable=True)
    details = db.Column(db.JSON, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    actor = db.relationship("AdminUser", foreign_keys=[actor_user_id])

    def __repr__(self):
        return f"<AuditLog {self.action} by {self.actor_email}>"
