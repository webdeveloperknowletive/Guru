import os
from app import create_app
from app.extensions import db

# Default to development if not set in environment
env = os.getenv("FLASK_ENV", "development" if __name__ == "__main__" else "production")
app = create_app(env)

# Automatic production database bootstrap and schema synchronization for zero-touch Coolify/VPS deployment
with app.app_context():
    try:
        from app.utils.db_auto_sync import auto_sync_schema_and_bootstrap
        auto_sync_schema_and_bootstrap(app, db)
    except Exception as e:
        app.logger.warning(f"Database auto-bootstrap check: {e}")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
