import json
from decimal import Decimal
from app.models.service import JyotishConsultation

def test_janma_kundali_hard_copy_pricing(client, app):
    """Test Janma Kundali Hard Copy package submits at ₹1,001 with correct details."""
    with app.app_context():
        payload = {
            "service_id": "janma-kundali",
            "topic": "Janma Kundali Preparation",
            "customer_name": "Rohan Deshmukh",
            "customer_phone": "9876543210",
            "customer_email": "rohan@example.com",
            "dob": "1992-04-10",
            "tob": "06:45 AM",
            "pob": "Pune, Maharashtra, India",
            "package_type": "hard-copy",
            "package_name": "Hard Copy — Printed Hard Copy with Kundali Consultation",
            "amount": 1001,
            "recaptcha_token": "test-valid-recaptcha-token",
        }
        res = client.post(
            "/api/v1/services/request-consultation",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert res.status_code == 201
        data = res.get_json()
        assert data["amount_paid"] == 1001.0
        assert data["package_type"] == "hard-copy"
        assert "Hard Copy" in data["package_name"]

        consult = JyotishConsultation.query.filter_by(consultation_number=data["consultation_number"]).first()
        assert consult is not None
        assert consult.amount_paid == Decimal("1001.00")
        assert "Package: Hard Copy" in consult.astrologer_notes
        assert "Fee: ₹1,001" in consult.astrologer_notes


def test_janma_kundali_soft_copy_pricing(client, app):
    """Test Janma Kundali Soft Copy package submits at ₹101 with digital inclusions."""
    with app.app_context():
        payload = {
            "service_id": "janma-kundali",
            "topic": "Janma Kundali Preparation",
            "customer_name": "Priya Kulkarni",
            "customer_phone": "9823456789",
            "customer_email": "priya@example.com",
            "dob": "1996-08-22",
            "tob": "09:30 AM",
            "pob": "Nashik, Maharashtra",
            "package_type": "soft-copy",
            "package_name": "Soft Copy — Digital Kundali Report",
            "amount": 101,
            "recaptcha_token": "test-valid-recaptcha-token",
        }
        res = client.post(
            "/api/v1/services/request-consultation",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert res.status_code == 201
        data = res.get_json()
        assert data["amount_paid"] == 101.0
        assert data["package_type"] == "soft-copy"
        assert "Soft Copy" in data["package_name"]

        consult = JyotishConsultation.query.filter_by(consultation_number=data["consultation_number"]).first()
        assert consult is not None
        assert consult.amount_paid == Decimal("101.00")
        assert "Package: Soft Copy" in consult.astrologer_notes
        assert "Fee: ₹101" in consult.astrologer_notes


def test_all_seven_other_services_diwali_offer(client, app):
    """Verify each of the 7 other services submits at ₹101 with Diwali Special Offer."""
    services = [
        ("kundali-analysis", "Kundali Analysis & Guidance"),
        ("marriage-matching", "Marriage Kundali Matching"),
        ("career-business", "Career & Business Guidance"),
        ("finance-wealth", "Finance & Wealth Guidance"),
        ("muhurat-selection", "Muhurat Selection"),
        ("gemstone-rudraksha", "Gemstone & Rudraksha Guidance"),
        ("general-consultation", "General Jyotish Consultation"),
    ]

    with app.app_context():
        for sid, topic in services:
            payload = {
                "service_id": sid,
                "topic": topic,
                "customer_name": f"Devotee for {sid}",
                "customer_phone": "9876500000",
                "customer_email": "devotee@example.com",
                "dob": "1990-01-01",
                "tob": "10:00 AM",
                "pob": "Mumbai",
                "amount": 101,
            "recaptcha_token": "test-valid-recaptcha-token",
            }
            if sid == "marriage-matching":
                payload["person1"] = {"name": "Groom A", "dob": "1990-01-01", "tob": "10:00 AM", "pob": "Mumbai"}
                payload["person2"] = {"name": "Bride B", "dob": "1992-02-02", "tob": "11:00 AM", "pob": "Pune"}

            res = client.post(
                "/api/v1/services/request-consultation",
                data=json.dumps(payload),
                content_type="application/json",
            )
            assert res.status_code == 201, f"Failed for {sid}: {res.get_json()}"
            data = res.get_json()
            assert data["amount_paid"] == 101.0
            assert data["package_type"] is None

            consult = JyotishConsultation.query.filter_by(consultation_number=data["consultation_number"]).first()
            assert consult is not None
            assert consult.amount_paid == Decimal("101.00")
            assert "Diwali Special Offer (₹201 -> ₹101) | Fee: ₹101" in consult.astrologer_notes


def test_backend_rejects_price_tampering(client, app):
    """Verify backend rejects client-submitted manipulated price."""
    with app.app_context():
        # Attempt to pay ₹1 for Hard Copy (should be ₹1001)
        payload = {
            "service_id": "janma-kundali",
            "topic": "Janma Kundali Preparation",
            "customer_name": "Tamper Test",
            "customer_phone": "9999999999",
            "customer_email": "tamper@example.com",
            "dob": "1995-01-01",
            "pob": "Delhi",
            "package_type": "hard-copy",
            "amount": 1,  # Manipulated!
            "recaptcha_token": "test-valid-recaptcha-token",
        }
        res = client.post(
            "/api/v1/services/request-consultation",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert res.status_code == 400
        assert "Invalid consultation fee" in res.get_json()["error"]


def test_backend_rejects_invalid_janma_package(client, app):
    """Verify backend rejects invalid package_type for Janma Kundali."""
    with app.app_context():
        payload = {
            "service_id": "janma-kundali",
            "topic": "Janma Kundali Preparation",
            "customer_name": "Invalid Pkg Test",
            "customer_phone": "9999999999",
            "customer_email": "invalid@example.com",
            "dob": "1995-01-01",
            "pob": "Delhi",
            "package_type": "super-vip-copy",
            "recaptcha_token": "test-valid-recaptcha-token",
        }
        res = client.post(
            "/api/v1/services/request-consultation",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert res.status_code == 400
        assert "Invalid package" in res.get_json()["error"]
