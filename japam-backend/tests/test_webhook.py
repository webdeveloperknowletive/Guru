import json
import hmac
import hashlib
from decimal import Decimal
from datetime import datetime, timezone
from app.extensions import db
from app.models.commerce import Order
from app.models.operations import PaymentTransaction


def generate_signature(secret: str, payload_bytes: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()


def test_payment_webhook_valid_signature_success(client, app):
    """Test valid payment webhook transitions order to paid and creates transaction."""
    # Create test pending order
    order = Order(
        order_number="#ORD9901",
        customer_name="Test Devotee",
        customer_email="webhook_devotee@japam.org",
        shipping_address="108 Vedic Enclave, Varanasi",
        subtotal=Decimal("1500.00"),
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("45.00"),
        total_amount=Decimal("1545.00"),  # in paise: 154500
        order_status="pending",
        payment_status="pending",
        payment_method="Razorpay",
        placed_at=datetime.now(timezone.utc),
    )
    db.session.add(order)
    db.session.commit()

    payload = {
        "event_id": "evt_test_success_001",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_test_001",
                    "amount": 154500,  # 1545.00 INR
                    "currency": "INR",
                    "notes": {
                        "order_number": "#ORD9901"
                    }
                }
            }
        }
    }
    raw_payload = json.dumps(payload).encode("utf-8")
    secret = app.config.get("PAYMENT_WEBHOOK_SECRET", "whsec_japam_spiritual_live_secret")
    signature = generate_signature(secret, raw_payload)

    res = client.post(
        "/api/v1/payments/webhook",
        data=raw_payload,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": signature
        }
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "payment_processed"

    # Verify order status in DB
    db.session.refresh(order)
    assert order.payment_status == "paid"
    assert order.order_status == "processing"

    # Verify payment transaction record created
    txn = PaymentTransaction.query.filter_by(order_id=order.id).first()
    assert txn is not None
    assert txn.status == "captured"
    assert txn.gateway_payment_id == "pay_test_001"


def test_payment_webhook_invalid_signature_rejected(client, app):
    """Test webhook with forged signature is rejected with HTTP 401."""
    payload = {
        "event_id": "evt_forged_001",
        "event": "payment.captured",
        "order_number": "#ORD9901",
        "amount": 154500
    }
    raw_payload = json.dumps(payload).encode("utf-8")
    invalid_signature = "bad_forged_hmac_hex_string_1234567890abcdef"

    res = client.post(
        "/api/v1/payments/webhook",
        data=raw_payload,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": invalid_signature
        }
    )
    assert res.status_code == 401
    assert b"Invalid webhook signature" in res.data


def test_payment_webhook_missing_signature_rejected(client, app):
    """Test webhook missing signature header is rejected with HTTP 401."""
    payload = {"event": "payment.captured"}
    res = client.post(
        "/api/v1/payments/webhook",
        json=payload
    )
    assert res.status_code == 401
    assert b"Missing webhook signature header" in res.data


def test_payment_webhook_amount_mismatch_rejected(client, app):
    """Test webhook with tampered/mismatched amount is rejected with HTTP 400."""
    order = Order(
        order_number="#ORD9902",
        customer_name="Mismatched Devotee",
        customer_email="mismatch@japam.org",
        shipping_address="Kashi",
        subtotal=Decimal("2000.00"),
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("60.00"),
        total_amount=Decimal("2060.00"),  # Expected: 206000 paise
        order_status="pending",
        payment_status="pending",
        payment_method="Razorpay",
    )
    db.session.add(order)
    db.session.commit()

    # Client / attacker reports paying only 100 paise (₹1.00) instead of ₹2060.00
    payload = {
        "event_id": "evt_tampered_amt_001",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_tampered_001",
                    "amount": 100,  # 1.00 INR
                    "notes": {"order_number": "#ORD9902"}
                }
            }
        }
    }
    raw_payload = json.dumps(payload).encode("utf-8")
    secret = app.config.get("PAYMENT_WEBHOOK_SECRET", "whsec_japam_spiritual_live_secret")
    signature = generate_signature(secret, raw_payload)

    res = client.post(
        "/api/v1/payments/webhook",
        data=raw_payload,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": signature
        }
    )
    assert res.status_code == 400
    assert b"Payment amount mismatch" in res.data

    # Verify order was NOT marked as paid
    db.session.refresh(order)
    assert order.payment_status == "pending"


def test_payment_webhook_idempotency(client, app):
    """Test that duplicate webhook events are recognized and return 200 without duplicate side effects."""
    order = Order(
        order_number="#ORD9903",
        customer_name="Idempotent Devotee",
        customer_email="idempotent@japam.org",
        shipping_address="Varanasi",
        subtotal=Decimal("500.00"),
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("15.00"),
        total_amount=Decimal("515.00"),  # 51500 paise
        order_status="pending",
        payment_status="pending",
        payment_method="Razorpay",
    )
    db.session.add(order)
    db.session.commit()

    payload = {
        "event_id": "evt_idempotent_unique_101",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_idem_001",
                    "amount": 51500,
                    "notes": {"order_number": "#ORD9903"}
                }
            }
        }
    }
    raw_payload = json.dumps(payload).encode("utf-8")
    secret = app.config.get("PAYMENT_WEBHOOK_SECRET", "whsec_japam_spiritual_live_secret")
    signature = generate_signature(secret, raw_payload)

    # First delivery
    res1 = client.post(
        "/api/v1/payments/webhook",
        data=raw_payload,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": signature}
    )
    assert res1.status_code == 200
    assert res1.get_json()["status"] == "payment_processed"

    # Second delivery of identical event
    res2 = client.post(
        "/api/v1/payments/webhook",
        data=raw_payload,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": signature}
    )
    assert res2.status_code == 200
    assert res2.get_json()["status"] == "duplicate_event_ignored"

    # Only one transaction record created
    txns = PaymentTransaction.query.filter_by(order_id=order.id).all()
    assert len(txns) == 1
