import os
from app import create_app
from app.extensions import db

# Default to development if not set in environment
env = os.getenv("FLASK_ENV", "development" if __name__ == "__main__" else "production")
app = create_app(env)

# Automatic production database bootstrap for zero-touch Coolify/VPS deployment
with app.app_context():
    try:
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        if not inspector.has_table("products") or not inspector.has_table("admin_users"):
            app.logger.info("Fresh database detected. Initializing schema and seed data...")
            from seed import seed_database
            seed_database()
            app.logger.info("Database bootstrap completed successfully.")
    except Exception as e:
        app.logger.warning(f"Database auto-bootstrap check: {e}")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
