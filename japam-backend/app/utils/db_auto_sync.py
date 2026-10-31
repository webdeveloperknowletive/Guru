import os
import shutil
import logging
import uuid
from sqlalchemy import (
    inspect,
    text,
    Boolean,
    Integer,
    BigInteger,
    Numeric,
    DateTime,
    Date,
    Text as SAText,
    String,
    JSON,
)

logger = logging.getLogger("db_auto_sync")


def get_column_sql_type(col, dialect_name: str) -> str:
    col_type = col.type
    if isinstance(col_type, Boolean):
        default = "DEFAULT FALSE" if col.default is not None or not col.nullable else ""
        return f"BOOLEAN {default}".strip()
    elif isinstance(col_type, (BigInteger,)):
        return "BIGINT"
    elif isinstance(col_type, (Integer,)):
        return "INTEGER"
    elif isinstance(col_type, Numeric):
        precision = getattr(col_type, "precision", 12) or 12
        scale = getattr(col_type, "scale", 2) or 2
        return f"NUMERIC({precision}, {scale}) DEFAULT 0.00"
    elif isinstance(col_type, DateTime):
        return "TIMESTAMP"
    elif isinstance(col_type, Date):
        return "DATE"
    elif isinstance(col_type, JSON):
        return "JSONB" if dialect_name == "postgresql" else "JSON"
    elif isinstance(col_type, SAText):
        return "TEXT"
    elif isinstance(col_type, String):
        length = getattr(col_type, "length", 255) or 255
        return f"VARCHAR({length})"
    else:
        return "TEXT"


def auto_sync_schema_and_bootstrap(app, db):
    """
    Automatic Schema Synchronization & Self-Healing Database Bootstrap.
    1. Runs db.create_all() to ensure all tables exist.
    2. Inspects all registered models and dynamically adds any missing columns to existing tables.
    3. Bootstraps critical initial data (roles, admin users, default settings, catalog) if missing.
    Ensures zero-touch deployment on VPS/Coolify without requiring manual migrations.
    """
    with app.app_context():
        try:
            # 1. Ensure all tables exist
            db.create_all()

            # 2. Inspect and dynamically add missing columns across all tables
            inspector = inspect(db.engine)
            existing_tables = set(inspector.get_table_names())
            dialect_name = db.engine.dialect.name.lower()

            for table_name, table in db.Model.metadata.tables.items():
                if table_name not in existing_tables:
                    continue

                actual_cols = {c["name"] for c in inspector.get_columns(table_name)}
                model_cols = table.columns

                for col in model_cols:
                    if col.name not in actual_cols:
                        sql_type = get_column_sql_type(col, dialect_name)
                        alter_stmt = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {sql_type}"
                        try:
                            with db.engine.connect() as conn:
                                conn.execute(text(alter_stmt))
                                conn.commit()
                            app.logger.info(f"[DB AUTO-SYNC] Added missing column: {table_name}.{col.name} ({sql_type})")
                        except Exception as e:
                            app.logger.warning(f"[DB AUTO-SYNC] Could not alter table {table_name} for column {col.name}: {e}")

            # 3. Bootstrap essential foundation data if missing
            _bootstrap_foundation_data(app, db)

        except Exception as e:
            app.logger.error(f"[DB AUTO-SYNC] Critical error during auto-sync: {e}")


def _bootstrap_foundation_data(app, db):
    """
    Ensure baseline operational records exist so the store is always fully functional.
    """
    try:
        from app.models.user import Role, AdminUser
        from app.models.operations import SystemSetting
        from app.models.commerce import Product
        from app.services.rbac_service import seed_roles_and_permissions

        # A. Roles & Permissions
        if Role.query.count() == 0:
            app.logger.info("[DB BOOTSTRAP] Seeding roles and permissions...")
            seed_roles_and_permissions()

        # B. Default System Settings
        default_settings = [
            ("payment_mode", "online", "Global payment acceptance mode (online / offline)", "payment"),
            ("offline_instructions", "Scan UPI QR code or transfer to temple bank account. Send receipt screenshot via WhatsApp for instant confirmation.", "Instructions shown during offline checkout", "payment"),
            ("store_name", "Swami Guruji", "Store brand name", "general"),
        ]
        for key, val, desc, grp in default_settings:
            if not SystemSetting.query.filter_by(key=key).first():
                s = SystemSetting(key=key, value=val, description=desc, group_name=grp)
                db.session.add(s)
        db.session.commit()

        # C. Seed full initial catalog and admin users if database has 0 products and 0 categories
        from app.models.commerce import Category
        if Product.query.count() == 0 and Category.query.count() == 0:
            app.logger.info("[DB BOOTSTRAP] Fresh database detected. Running baseline seed...")
            try:
                from seed import seed_database
                seed_database()
                app.logger.info("[DB BOOTSTRAP] Baseline seed finished successfully.")
            except Exception as se:
                app.logger.warning(f"[DB BOOTSTRAP] Seed execution: {se}")
        elif AdminUser.query.count() == 0:
            app.logger.info("[DB BOOTSTRAP] No admin user detected. Creating default admin...")
            super_role = Role.query.filter_by(code="SUPER_ADMIN").first()
            if super_role:
                from app.services.auth_service import AuthService
                admin = AdminUser(
                    uuid=str(uuid.uuid4()) if 'uuid' in dir() else "admin-uuid-001",
                    email="admin@japam.in",
                    full_name="Admin",
                    role_id=super_role.id,
                    is_active=True,
                )
                admin.password_hash = AuthService.hash_password("Admin@1234")
                db.session.add(admin)
                db.session.commit()

        # D. Local SQLite mirror sync (keeps instance/japam_admin.db and japam-backend/japam_admin.db synchronized)
        if db.engine.dialect.name.lower() == "sqlite":
            try:
                import shutil
                base_dir = os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
                db_instance = os.path.join(base_dir, "instance", "japam_admin.db")
                db_root = os.path.join(base_dir, "japam_admin.db")
                if os.path.exists(db_instance) and os.path.exists(db_root):
                    t_inst = os.path.getmtime(db_instance)
                    t_root = os.path.getmtime(db_root)
                    if t_inst > t_root:
                        shutil.copy2(db_instance, db_root)
                    elif t_root > t_inst:
                        shutil.copy2(db_root, db_instance)
                elif os.path.exists(db_instance) and not os.path.exists(db_root):
                    shutil.copy2(db_instance, db_root)
                elif os.path.exists(db_root) and not os.path.exists(db_instance):
                    os.makedirs(os.path.dirname(db_instance), exist_ok=True)
                    shutil.copy2(db_root, db_instance)
            except Exception as se:
                app.logger.debug(f"[DB AUTO-SYNC] SQLite mirror notice: {se}")

    except Exception as e:
        app.logger.warning(f"[DB BOOTSTRAP] Foundation bootstrap warning: {e}")
