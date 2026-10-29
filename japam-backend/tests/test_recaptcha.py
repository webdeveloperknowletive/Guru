import json
from unittest.mock import patch
import requests
from app.services.captcha_service import CaptchaService, GOOGLE_VERIFY_URL


def test_recaptcha_missing_token_rejected(client, app):
    """Test that requests without recaptcha_token are rejected across protected endpoints."""
    with app.app_context():
        # 1. Consultation form
        res = client.post(
            "/api/v1/services/request-consultation",
            data=json.dumps({
                "service_id": "general-consultation",
                "customer_name": "Devotee Test",
                "customer_phone": "9876543210",
                "amount": 101,
            }),
            content_type="application/json",
        )
        assert res.status_code == 400
        assert "CAPTCHA" in res.get_json()["error"]

        # 2. Puja booking form
        res_puja = client.post(
            "/api/v1/services/book-puja",
            data=json.dumps({
                "customer_name": "Devotee Test",
                "customer_phone": "9876543210",
                "date": "2026-11-01",
            }),
            content_type="application/json",
        )
        assert res_puja.status_code == 400
        assert "CAPTCHA" in res_puja.get_json()["error"]

        # 3. Contact enquiry form
        res_contact = client.post(
            "/api/v1/contact",
            data=json.dumps({
                "name": "Devotee Test",
                "email": "devotee@example.com",
                "message": "Testing enquiry",
            }),
            content_type="application/json",
        )
        assert res_contact.status_code == 400
        assert "CAPTCHA" in res_contact.get_json()["error"]


def test_recaptcha_invalid_token_rejected(client, app):
    """Test that requests with an invalid/fake token are rejected."""
    with app.app_context():
        # Mock Google API returning success: False
        with patch("requests.post") as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = {
                "success": False,
                "error-codes": ["invalid-input-response"]
            }

            res = client.post(
                "/api/v1/services/request-consultation",
                data=json.dumps({
                    "service_id": "general-consultation",
                    "customer_name": "Devotee Test",
                    "customer_phone": "9876543210",
                    "amount": 101,
                    "recaptcha_token": "fake-invalid-token-12345",
                }),
                content_type="application/json",
            )
            assert res.status_code == 400
            assert "CAPTCHA" in res.get_json()["error"]


def test_recaptcha_expired_or_duplicate_token_rejected(client, app):
    """Test that requests with expired/duplicate tokens are rejected with a clear message."""
    with app.app_context():
        with patch("requests.post") as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = {
                "success": False,
                "error-codes": ["timeout-or-duplicate"]
            }

            res = client.post(
                "/api/v1/contact",
                data=json.dumps({
                    "name": "Devotee Test",
                    "email": "devotee@example.com",
                    "message": "Testing expired token",
                    "recaptcha_token": "expired-token",
                }),
                content_type="application/json",
            )
            assert res.status_code == 400
            assert "expired or was already used" in res.get_json()["error"]


def test_recaptcha_google_service_timeout_fails_closed(client, app):
    """Test that Google verification network timeout fails closed securely."""
    with app.app_context():
        with patch("requests.post", side_effect=requests.exceptions.Timeout):
            res = client.post(
                "/api/v1/services/request-consultation",
                data=json.dumps({
                    "service_id": "general-consultation",
                    "customer_name": "Devotee Test",
                    "customer_phone": "9876543210",
                    "amount": 101,
                    "recaptcha_token": "valid-token-but-google-times-out",
                }),
                content_type="application/json",
            )
            assert res.status_code == 400
            assert "timed out" in res.get_json()["error"]


def test_recaptcha_valid_token_allows_submission(client, app):
    """Test that a valid verified token allows form submission to proceed."""
    with app.app_context():
        with patch("requests.post") as mock_post:
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = {
                "success": True,
                "challenge_ts": "2026-10-28T18:00:00Z",
                "hostname": "localhost"
            }

            res = client.post(
                "/api/v1/services/request-consultation",
                data=json.dumps({
                    "service_id": "general-consultation",
                    "customer_name": "Authentic Devotee",
                    "customer_phone": "9876543210",
                    "customer_email": "devotee@example.com",
                    "amount": 101,
                    "recaptcha_token": "valid-google-token-xyz",
                }),
                content_type="application/json",
            )
            assert res.status_code == 201
            assert "consultation_number" in res.get_json()
