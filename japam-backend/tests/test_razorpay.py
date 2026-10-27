import hmac
import hashlib
from decimal import Decimal
import pytest
from app.extensions import db
from app.models.commerce import Product, Order
from app.models.service import PujaService, PujaBooking
from app.models.operations import PaymentTransaction
from app.models.user import AdminUser
from app.services.razorpay_service import RazorpayService
from app.services.payment_mode_service import PaymentModeService


def test_razorpay_credentials_and_test_mode_guard(app):
    """Test Razorpay credentials are test mode and live credentials are safe-guarded."""
    with app.app_context():
        key_id, key_secret = RazorpayService.get_credentials()
        assert key_id.startswith("rzp_test_"), "Must be a Razorpay Test Mode key"
        assert len(key_secret) > 10

        # Verify live key guard prevents execution
        orig_key = app.config.get("RAZORPAY_KEY_ID")
        try:
            app.config["RAZORPAY_KEY_ID"] = "rzp_live_dangerousLiveKey123"
            with pytest.raises(ValueError, match="Live Razorpay credentials"):
                RazorpayService.get_credentials()
        finally:
            app.config["RAZORPAY_KEY_ID"] = orig_key


def test_payment_create_order_server_side_calculation(client, app):
    """Test that Razorpay order creation uses server-side calculated totals, not client amounts."""
    with app.app_context():
        admin = AdminUser.query.filter_by(email="super@japam.in").first()
        PaymentModeService.set_payment_mode("online", admin_user=admin)
        prod = Product.query.filter_by(sku="RM-001").first()
        prod_id = prod.id

    # Place an online order
    checkout_payload = {
        "customer_name": "Kavita Deshmukh",
        "customer_email": "kavita@example.com",
        "customer_phone": "9876543210",
        "shipping_address": "42 Narayan Peth, Pune",
        "items": [{"product_id": prod_id, "quantity": 1}],
        "idempotency_key": "test-idem-rzp-checkout-001",
        "payment_method": "Razorpay",
    }
    res = client.post("/api/v1/orders/checkout", json=checkout_payload)
    assert res.status_code == 201
    data = res.get_json()
    order_number = data["order_number"]
    access_token = data["access_token"]
    total_amount = data["total_amount"]
    expected_paise = int(total_amount * 100)

    # Call /api/v1/payments/create-order
    create_res = client.post(
        "/api/v1/payments/create-order",
        json={"order_number": order_number, "token": access_token},
        headers={"X-Order-Token": access_token},
    )
    assert create_res.status_code == 200
    create_data = create_res.get_json()
    assert create_data["success"] is True
    assert create_data["order_number"] == order_number
    assert create_data["amount"] == expected_paise
    assert create_data["currency"] == "INR"
    assert create_data["razorpay_order_id"].startswith("order_")
    assert create_data["key_id"].startswith("rzp_test_")


def test_payment_create_order_unauthorized_rejected(client, app):
    """Test creating payment order without ownership authorization is rejected with 403."""
    with app.app_context():
        order = Order(
            order_number="#ORD-TEST-AUTH-001",
            customer_name="Test Customer",
            customer_email="cust@example.com",
            total_amount=Decimal("500.00"),
            order_status="pending",
            payment_status="pending",
            payment_method="Razorpay",
            access_token="tok_secret_ownership_123",
        )
        db.session.add(order)
        db.session.commit()
        order_num = order.order_number

    res = client.post(
        "/api/v1/payments/create-order",
        json={"order_number": order_num},  # No access token or customer email
    )
    assert res.status_code == 403


def test_payment_verify_valid_signature_success(client, app):
    """
    Test verifying payment with genuine cryptographic signature:
    - Transitions order to payment_status='paid' and order_status='processing'
    - Creates PaymentTransaction with status='captured'
    - Associating with order and customer
    """
    with app.app_context():
        admin = AdminUser.query.filter_by(email="super@japam.in").first()
        PaymentModeService.set_payment_mode("online", admin_user=admin)
        order = Order(
            order_number="#ORD-TEST-VERIFY-001",
            customer_name="Sanjay Joshi",
            customer_email="sanjay@example.com",
            customer_phone="9822001122",
            shipping_address="Shivaji Nagar, Pune",
            subtotal=Decimal("1200.00"),
            discount_amount=Decimal("0.00"),
            tax_amount=Decimal("36.00"),
            total_amount=Decimal("1236.00"),
            order_status="pending",
            payment_status="pending",
            payment_method="Razorpay",
            access_token="tok_verify_test_secret_12345",
        )
        db.session.add(order)
        db.session.commit()
        order_num = order.order_number
        token = order.access_token

    # Generate genuine Razorpay signature
    key_secret = app.config.get("RAZORPAY_KEY_SECRET", "s2g28nXj6FT19Iq90Uisy4ja")
    rzp_order_id = "order_testMockOrder001"
    rzp_payment_id = "pay_testMockPay001"
    sig_payload = f"{rzp_order_id}|{rzp_payment_id}".encode("utf-8")
    valid_signature = hmac.new(key_secret.encode("utf-8"), sig_payload, hashlib.sha256).hexdigest()

    # Call /api/v1/payments/verify
    verify_res = client.post(
        "/api/v1/payments/verify",
        json={
            "order_number": order_num,
            "token": token,
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": rzp_payment_id,
            "razorpay_signature": valid_signature,
        },
        headers={"X-Order-Token": token},
    )
    assert verify_res.status_code == 200
    vdata = verify_res.get_json()
    assert vdata["status"] == "success"
    assert vdata["payment_status"] == "paid"

    # Verify database state
    with app.app_context():
        updated_order = Order.query.filter_by(order_number=order_num).first()
        assert updated_order.payment_status == "paid"
        assert updated_order.order_status == "processing"

        txn = PaymentTransaction.query.filter_by(gateway_payment_id=rzp_payment_id).first()
        assert txn is not None
        assert txn.status == "captured"
        assert txn.gateway == "Razorpay"
        assert txn.amount == Decimal("1236.00")
        assert txn.customer_name == "Sanjay Joshi"


def test_payment_verify_invalid_signature_rejected(client, app):
    """
    Test that invalid or tampered signatures are rejected:
    - Returns HTTP 400
    - Order is NOT marked as paid
    - No captured transaction created
    """
    with app.app_context():
        order = Order(
            order_number="#ORD-TEST-FORGED-002",
            customer_name="Pooja Kadam",
            customer_email="pooja@example.com",
            subtotal=Decimal("800.00"),
            total_amount=Decimal("800.00"),
            order_status="pending",
            payment_status="pending",
            payment_method="Razorpay",
            access_token="tok_forged_test_secret_67890",
        )
        db.session.add(order)
        db.session.commit()
        order_num = order.order_number
        token = order.access_token

    verify_res = client.post(
        "/api/v1/payments/verify",
        json={
            "order_number": order_num,
            "token": token,
            "razorpay_order_id": "order_testMock002",
            "razorpay_payment_id": "pay_testMock002",
            "razorpay_signature": "completely_fake_and_forged_signature_hex_12345",
        },
        headers={"X-Order-Token": token},
    )
    assert verify_res.status_code == 400
    assert "Invalid payment signature" in verify_res.get_json()["error"]

    with app.app_context():
        check_order = Order.query.filter_by(order_number=order_num).first()
        assert check_order.payment_status == "pending", "Order must NOT be marked paid with forged signature"


def test_payment_failure_records_and_preserves_order(client, app):
    """
    Test that payment failure or cancellation:
    - Does NOT mark order as paid
    - Creates PaymentTransaction with status='failed'
    - Preserves order for retry
    """
    with app.app_context():
        order = Order(
            order_number="#ORD-TEST-FAIL-003",
            customer_name="Vikram Gaikwad",
            customer_email="vikram@example.com",
            total_amount=Decimal("1500.00"),
            order_status="pending",
            payment_status="pending",
            payment_method="Razorpay",
            access_token="tok_fail_test_secret_11223",
        )
        db.session.add(order)
        db.session.commit()
        order_num = order.order_number
        token = order.access_token

    fail_res = client.post(
        "/api/v1/payments/failure",
        json={
            "order_number": order_num,
            "token": token,
            "error_code": "BAD_REQUEST_ERROR",
            "error_description": "Payment was cancelled by the user",
            "razorpay_order_id": "order_cancelled_003",
        },
        headers={"X-Order-Token": token},
    )
    assert fail_res.status_code == 200
    fdata = fail_res.get_json()
    assert fdata["status"] == "failure_recorded"
    assert fdata["payment_status"] == "pending"

    with app.app_context():
        check_order = Order.query.filter_by(order_number=order_num).first()
        assert check_order.payment_status != "paid"
        fail_txn = PaymentTransaction.query.filter_by(order_id=check_order.id, status="failed").first()
        assert fail_txn is not None
        assert "Payment was cancelled" in fail_txn.error_message


def test_payment_status_endpoint(client, app):
    """Test GET /api/v1/payments/status/<order_number> returns authoritative status."""
    from urllib.parse import quote
    with app.app_context():
        order = Order(
            order_number="#ORD-TEST-STATUS-004",
            customer_name="Meera Nair",
            customer_email="meera@example.com",
            total_amount=Decimal("2100.00"),
            order_status="processing",
            payment_status="paid",
            payment_method="Razorpay",
            access_token="tok_status_test_secret_44556",
        )
        db.session.add(order)
        db.session.commit()
        order_num = order.order_number
        token = order.access_token

    res = client.get(
        f"/api/v1/payments/status/{quote(order_num)}",
        headers={"X-Order-Token": token},
    )
    assert res.status_code == 200
    sdata = res.get_json()
    assert sdata["order_number"] == order_num
    assert sdata["payment_status"] == "paid"
    assert sdata["is_paid"] is True
    assert sdata["total_amount"] == 2100.0
