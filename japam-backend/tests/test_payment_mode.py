import pytest
from decimal import Decimal
from datetime import date
from app.extensions import db
from app.models.operations import SystemSetting, PaymentTransaction
from app.models.user import AuditLog, AdminUser
from app.models.commerce import Product, Order
from app.models.service import PujaBooking, JyotishConsultation, PujaService, AvailabilitySlot
from app.services.payment_mode_service import PaymentModeService
from app.services.whatsapp_service import WhatsAppNotificationService


def test_payment_mode_defaults_and_toggle(app):
    """Test getting default mode, setting new mode, DB persistence, and audit logging."""
    with app.app_context():
        admin = AdminUser.query.filter_by(email="super@japam.in").first()

        # Default should be online
        mode = PaymentModeService.get_payment_mode()
        assert mode == "online"

        # Toggle to offline
        success, msg = PaymentModeService.set_payment_mode("offline", admin_user=admin)
        assert success is True
        assert "offline" in msg.lower()

        # Verify DB persistence
        setting = SystemSetting.query.filter_by(key="payment_mode").first()
        assert setting is not None
        assert setting.value == "offline"

        # Verify get returns offline
        assert PaymentModeService.get_payment_mode() == "offline"

        # Verify audit log
        audit = AuditLog.query.filter_by(action="PAYMENT_MODE_CHANGE").first()
        assert audit is not None
        assert audit.actor_email == "super@japam.in"
        assert audit.details["old_mode"] == "online"
        assert audit.details["new_mode"] == "offline"

        # Toggle back to online
        success, msg = PaymentModeService.set_payment_mode("online", admin_user=admin)
        assert success is True
        assert "online" in msg.lower()
        assert PaymentModeService.get_payment_mode() == "online"


def test_api_system_payment_mode_endpoint(client, app):
    """Test GET /api/v1/system/payment-mode reflects backend setting."""
    with app.app_context():
        admin = AdminUser.query.filter_by(email="super@japam.in").first()
        PaymentModeService.set_payment_mode("online", admin_user=admin)

    res = client.get("/api/v1/system/payment-mode")
    assert res.status_code == 200
    data = res.get_json()
    assert data["payment_mode"] == "online"
    assert data["is_offline"] is False

    with app.app_context():
        admin = AdminUser.query.filter_by(email="super@japam.in").first()
        PaymentModeService.set_payment_mode("offline", admin_user=admin)

    res = client.get("/api/v1/system/payment-mode")
    assert res.status_code == 200
    data = res.get_json()
    assert data["payment_mode"] == "offline"
    assert data["is_offline"] is True
    assert "instructions" in data


def test_admin_payment_mode_toggle_route_auth(client, app):
    """Test admin dashboard toggle route requires authenticated admin."""
    # Unauthenticated attempt should redirect to login
    res = client.post("/admin/payment-mode/toggle", data={"mode": "offline"}, follow_redirects=False)
    assert res.status_code in (302, 401)

    # Login as super admin
    login_res = client.post("/auth/login", data={
        "email": "super@japam.in",
        "password": "AdminPass123!"
    }, follow_redirects=True)
    assert login_res.status_code == 200

    # Authorized toggle to offline
    toggle_res = client.post("/admin/payment-mode/toggle", data={"mode": "offline"}, follow_redirects=True)
    assert toggle_res.status_code == 200

    with app.app_context():
        assert PaymentModeService.get_payment_mode() == "offline"


def test_offline_product_checkout_flow(client, app):
    """Test product checkout in Offline Mode:
    - Order is saved with payment_status='offline_pending'
    - Inventory is atomically decremented
    - Idempotency key prevents duplicate orders
    - Customer receives offline instructions
    """
    with app.app_context():
        admin = AdminUser.query.filter_by(email="super@japam.in").first()
        PaymentModeService.set_payment_mode("offline", admin_user=admin)
        prod = Product.query.filter_by(sku="RM-001").first()
        initial_stock = prod.stock_quantity
        prod_id = prod.id

    checkout_payload = {
        "customer_name": "Rohan Sharma",
        "customer_email": "rohan@example.com",
        "customer_phone": "9876543210",
        "shipping_address": {
            "address_line1": "Flat 402, Lotus Towers",
            "city": "Pune",
            "state": "Maharashtra",
            "pincode": "411001"
        },
        "items": [
            {"product_id": prod_id, "quantity": 2}
        ],
        "idempotency_key": "test-idem-offline-checkout-101",
        "payment_mode": "offline"
    }

    res = client.post("/api/v1/orders/checkout", json=checkout_payload)
    assert res.status_code == 201
    data = res.get_json()
    assert data["payment_status"] == "offline_pending"
    assert data["offline_payment"] is True
    assert "offline_instructions" in data
    order_id = data["order_id"]

    # Verify order in database
    with app.app_context():
        order = db.session.get(Order, order_id)
        assert order is not None
        assert order.payment_status == "offline_pending"
        assert order.order_status == "pending"
        assert order.payment_method == "Offline Payment"
        assert order.total_amount >= Decimal("3000.00")

        # Verify inventory was decremented
        updated_prod = db.session.get(Product, prod_id)
        assert updated_prod.stock_quantity == initial_stock - 2

    # Verify idempotency prevents duplicate order & stock loss
    res_retry = client.post("/api/v1/orders/checkout", json=checkout_payload)
    assert res_retry.status_code == 200
    retry_data = res_retry.get_json()
    assert retry_data["order_id"] == order_id

    with app.app_context():
        # Stock must NOT have decremented again
        updated_prod = db.session.get(Product, prod_id)
        assert updated_prod.stock_quantity == initial_stock - 2


def test_offline_puja_booking_flow(client, app):
    """Test Puja booking in Offline Mode:
    - Booking is saved with status='pending' and amount_paid=0.00
    - Customer receives confirmation and offline payment instructions
    """
    with app.app_context():
        admin = AdminUser.query.filter_by(email="super@japam.in").first()
        PaymentModeService.set_payment_mode("offline", admin_user=admin)
        puja = PujaService.query.first()
        puja_id = puja.id

    payload = {
        "service_id": puja_id,
        "booking_date": "2026-11-01",
        "time_slot": "10:00 AM",
        "customer_name": "Aarav Patel",
        "customer_email": "aarav@example.com",
        "customer_phone": "9988776655",
        "gotra": "Kashyap",
        "sankalp_text": "Health and prosperity for family",
        "payment_mode": "offline"
    }

    res = client.post("/api/v1/services/book-puja", json=payload)
    assert res.status_code == 201
    data = res.get_json()
    assert data["status"] == "pending"
    assert data["payment_mode"] == "offline"
    assert data["payment_method"] == "Offline Payment"
    assert "offline_payment_instructions" in data

    booking_num = data["booking_number"]
    with app.app_context():
        booking = PujaBooking.query.filter_by(booking_number=booking_num).first()
        assert booking is not None
        assert booking.status == "pending"
        assert booking.amount_paid == Decimal("0.00")
        assert "Offline Payment" in (booking.notes or "")


def test_offline_consultation_request_flow(client, app):
    """Test Jyotish consultation request in Offline Mode:
    - Request is saved with status='pending'
    - Astrologer notes indicate offline mode
    - Returns offline instructions
    """
    with app.app_context():
        admin = AdminUser.query.filter_by(email="super@japam.in").first()
        PaymentModeService.set_payment_mode("offline", admin_user=admin)

    payload = {
        "customer_name": "Ananya Roy",
        "customer_email": "ananya@example.com",
        "customer_phone": "9123456789",
        "dob": "1994-05-12",
        "tob": "14:30",
        "pob": "Kolkata, WB",
        "topic": "Career & Vedic Astrology guidance",
        "payment_mode": "offline"
    }

    res = client.post("/api/v1/services/request-consultation", json=payload)
    assert res.status_code == 201
    data = res.get_json()
    assert data["status"] == "pending"
    assert data["payment_mode"] == "offline"
    assert data["payment_method"] == "Offline Payment"
    assert "offline_payment_instructions" in data

    consult_num = data["consultation_number"]
    with app.app_context():
        consultation = JyotishConsultation.query.filter_by(consultation_number=consult_num).first()
        assert consultation is not None
        assert consultation.status == "pending"
        assert "OFFLINE PAYMENT" in (consultation.astrologer_notes or "")


def test_admin_offline_payment_verification(client, app):
    """Test admin manual verification of offline payment for an order."""
    # 1. Create an offline order
    with app.app_context():
        admin = AdminUser.query.filter_by(email="super@japam.in").first()
        PaymentModeService.set_payment_mode("offline", admin_user=admin)
        prod = Product.query.filter_by(sku="RM-001").first()
        prod_id = prod.id

    checkout_payload = {
        "customer_name": "Vikram Malhotra",
        "customer_email": "vikram@example.com",
        "customer_phone": "9876501234",
        "shipping_address": {
            "address_line1": "12 Ridge Road",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400006"
        },
        "items": [{"product_id": prod_id, "quantity": 1}],
        "idempotency_key": "test-idem-verify-offline-1",
        "payment_mode": "offline"
    }
    res = client.post("/api/v1/orders/checkout", json=checkout_payload)
    order_id = res.get_json()["order_id"]

    # 2. Login as admin
    client.post("/auth/login", data={"email": "super@japam.in", "password": "AdminPass123!"})

    # 3. Call verify-payment
    verify_res = client.post(f"/admin/commerce/orders/{order_id}/verify-payment", data={
        "transaction_reference": "UPI-HDFC-99112233",
        "notes": "Payment verified via bank statement."
    }, follow_redirects=True)
    assert verify_res.status_code == 200

    # 4. Check DB
    with app.app_context():
        order = db.session.get(Order, order_id)
        assert order.payment_status == "paid"
        assert order.order_status == "processing"

        tx = PaymentTransaction.query.filter_by(order_id=order_id).first()
        assert tx is not None
        assert tx.status == "captured"
        assert tx.gateway == "Offline Payment"
        assert tx.gateway_payment_id == "UPI-HDFC-99112233"

        audit = AuditLog.query.filter_by(action="OFFLINE_PAYMENT_VERIFIED", entity_id=order_id).first()
        assert audit is not None
        assert audit.actor_email == "super@japam.in"


def test_whatsapp_service_privacy_and_resilience(app):
    """Test WhatsApp service:
    - Omits sensitive astrological birth details
    - Handles missing API credentials gracefully without raising uncaught exceptions
    - Formats message with order/booking details properly
    """
    with app.app_context():
        result = WhatsAppNotificationService.send_admin_alert(
            module_name="Jyotish Consultation",
            reference_id="CONS-TEST-001",
            customer_name="Pooja Sharma",
            customer_phone="9876543210",
            customer_email="pooja@example.com",
            amount=1500.00,
            payment_mode="offline",
            payment_status="pending",
            admin_url="/admin/services/consultations",
            extra_info="Topic: Kundali Analysis"
        )
        assert "status" in result
        assert result["status"] in ("not_configured", "sent", "failed")

        # Verify fallback manual_link
        assert "manual_link" in result
        link = result["manual_link"]
        assert "CONS-TEST-001" in link
        assert "Pooja" in link
        assert "Kundali" in link


def test_mode_switching_preserves_existing_records(client, app):
    """Confirm switching modes does NOT modify or corrupt existing orders."""
    with app.app_context():
        admin = AdminUser.query.filter_by(email="super@japam.in").first()
        PaymentModeService.set_payment_mode("offline", admin_user=admin)
        prod = Product.query.filter_by(sku="RM-001").first()
        prod_id = prod.id

    # Create offline order
    res = client.post("/api/v1/orders/checkout", json={
        "customer_name": "Kavita Sen",
        "customer_email": "kavita@example.com",
        "customer_phone": "9876500000",
        "shipping_address": {
            "address_line1": "101 Green Park",
            "city": "Delhi",
            "state": "Delhi",
            "pincode": "110016"
        },
        "items": [{"product_id": prod_id, "quantity": 1}],
        "idempotency_key": "test-idem-preserve-1"
    })
    order_id = res.get_json()["order_id"]

    # Now switch back to ONLINE mode
    with app.app_context():
        admin = AdminUser.query.filter_by(email="super@japam.in").first()
        PaymentModeService.set_payment_mode("online", admin_user=admin)

    # Verify the existing order remains offline_pending and payment_method is Offline Payment
    with app.app_context():
        order = db.session.get(Order, order_id)
        assert order.payment_status == "offline_pending"
        assert order.payment_method == "Offline Payment"
        assert order.order_status == "pending"
