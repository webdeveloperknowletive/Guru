from app.models.user import AdminUser
from app.services.auth_service import AuthService
from app.extensions import redis_client


def test_login_success(client):
    res = client.post("/auth/login", data={"email": "super@japam.in", "password": "AdminPass123!"})
    assert res.status_code == 302
    assert "japam_admin_auth" in res.headers.get("Set-Cookie", "")
    assert "HttpOnly" in res.headers.get("Set-Cookie", "")


def test_login_invalid_password(client):
    res = client.post("/auth/login", data={"email": "super@japam.in", "password": "WrongPassword"})
    assert res.status_code == 200
    assert b"Invalid email or password" in res.data


def test_account_lockout_after_failures(client, app):
    # Clear rate limit keys for test IP and account so password failures are tested directly
    redis_client.delete("rl:login_ip:127.0.0.1")
    redis_client.delete("rl:login_acc:super@japam.in")

    with app.app_context():
        user = AdminUser.query.filter_by(email="super@japam.in").first()
        user.failed_login_attempts = 0
        user.locked_until = None
        app.extensions["sqlalchemy"].session.commit()

    # Trigger password check failures via AuthService directly or client
    with app.app_context():
        for _ in range(5):
            AuthService.authenticate_admin("super@japam.in", "WrongPassword", "127.0.0.1")

        user = AdminUser.query.filter_by(email="super@japam.in").first()
        assert user.failed_login_attempts >= 5
        assert user.locked_until is not None

        # Verify locked account rejects login
        _, err = AuthService.authenticate_admin("super@japam.in", "AdminPass123!", "127.0.0.1")
        assert "temporarily locked" in err


def test_logout(client):
    # Log in
    client.post("/auth/login", data={"email": "comm@japam.in", "password": "CommPass123!"})
    # Log out
    res = client.get("/auth/logout")
    assert res.status_code == 302
    # Verify redirected to login
    assert "/auth/login" in res.headers.get("Location", "")
