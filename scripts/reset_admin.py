import sys
sys.path.insert(0, 'japam-backend')
from app import create_app
from app.extensions import db
from app.models import AdminUser

app = create_app()
with app.app_context():
    u = AdminUser.query.filter_by(email='admin@japam.in').first()
    print('User found:', u.email, 'locked_until:', u.locked_until, 'failed_attempts:', getattr(u, 'failed_login_attempts', None))
    u.locked_until = None
    u.failed_login_attempts = 0
    db.session.commit()
    print('Admin lockout cleared!')
