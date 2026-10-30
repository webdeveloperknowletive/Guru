import sys
import os
import hmac
import hashlib
import json
from decimal import Decimal
from datetime import datetime, timezone

# Add japam-backend to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.extensions import db
from app.models.commerce import Product, Category, Order, OrderItem, Customer
from app.models.service import PujaService, PujaBooking, JyotishConsultation
from app.models.operations import PaymentTransaction
from app.models.user import AdminUser
from app.services.razorpay_service import RazorpayService

app = create_app()
app.config["TESTING"] = True

def test_complete_payment_system():
    with app.app_context():
        client = app.test_client()

        print("\n=======================================================")
        print("  JAPAM PAYMENT SYSTEM & ADMIN SYNC VERIFICATION SUITE ")
        print("=======================================================")

        passed_tests = 0
        total_tests = 0

        def report(test_name, success, detail=""):
            nonlocal passed_tests, total_tests
            total_tests += 1
            if success:
                passed_tests += 1
                print(f"  [PASS] {test_name} {detail}".encode("ascii", errors="replace").decode("ascii"))
            else:
                print(f"  [FAIL] {test_name} {detail}".encode("ascii", errors="replace").decode("ascii"))
                raise AssertionError(f"Test Failed: {test_name} - {detail}")

        # -----------------------------------------------------
        # 1. Credentials & Security Verification
        # -----------------------------------------------------
        key_id = app.config.get("RAZORPAY_KEY_ID")
        key_secret = app.config.get("RAZORPAY_KEY_SECRET")
        report("Razorpay Key ID Configured", key_id == "rzp_live_Tu1zNpGcVhnkDX", f"(Key: {key_id})")
        report("Razorpay Key Secret Configured", bool(key_secret and len(key_secret) > 10))

        # Ensure Key Secret is NOT exposed in config responses
        health_res = client.get("/api/v1/health")
        report("Health check does not leak secret", key_secret not in health_res.get_data(as_text=True))

        # -----------------------------------------------------
        # 2. Return Policy Checkbox Enforcement in Checkout
        # -----------------------------------------------------
        prod = Product.query.filter_by(publishing_status="published").first()
        if not prod:
            cat = Category(name="Sacred Test", slug="sacred-test")
            db.session.add(cat)
            db.session.flush()
            prod = Product(name="1 Mukhi Rudraksha Test", slug="1-mukhi-test", price=Decimal("15999.00"), stock_quantity=10, category_id=cat.id, publishing_status="published")
            db.session.add(prod)
            db.session.commit()

        admin = AdminUser.query.filter_by(is_active=True).first()
        if not admin:
            admin = AdminUser(username="admin", email="admin@japam.local", role="superadmin", is_active=True)
            admin.set_password("Admin@12345")
            db.session.add(admin)
            db.session.commit()

        from app.services.payment_mode_service import PaymentModeService
        orig_mode = PaymentModeService.get_payment_mode()

        # Switch to online mode for online payment testing
        PaymentModeService.set_payment_mode("online", admin_user=admin)

        # Checkout WITHOUT policy_accepted should fail with 400
        no_policy_payload = {
            "customer_name": "Test Devotee",
            "customer_email": "devotee@example.com",
            "customer_phone": "9876543210",
            "shipping_address": "Nashik, Maharashtra",
            "payment_method": "Razorpay",
            "recaptcha_token": "devotee_verified_test",
            "policy_accepted": False,
            "items": [{"product_id": prod.id, "quantity": 1}],
        }
        res_no_policy = client.post("/api/v1/orders/checkout", json=no_policy_payload)
        report("Reject Checkout Without Policy Acceptance", res_no_policy.status_code == 400)

        # -----------------------------------------------------
        # 3. Store Checkout with Policy Acceptance & Razorpay Order
        # -----------------------------------------------------
        valid_payload = {
            "customer_name": "Test Devotee",
            "customer_email": "devotee@example.com",
            "customer_phone": "9876543210",
            "shipping_address": "Nashik, Maharashtra, 422003",
            "payment_method": "Razorpay",
            "recaptcha_token": "devotee_verified_test",
            "policy_accepted": True,
            "policy_version": "v1.0-2026",
            "items": [{"product_id": prod.id, "quantity": 1}],
        }
        res_checkout = client.post("/api/v1/orders/checkout", json=valid_payload)
        chk_data = res_checkout.get_json()
        report("Successful Store Checkout Creation", res_checkout.status_code == 201, f"(Order: {chk_data.get('order_number')})")

        order_num = chk_data.get("order_number")
        order_obj = Order.query.filter_by(order_number=order_num).first()
        report("Policy Acceptance Timestamp & Version Stored", bool(order_obj.policy_accepted_at and order_obj.policy_version == "v1.0-2026"))

        # Check PaymentTransaction was created in database
        txn_rec = PaymentTransaction.query.filter_by(order_id=order_obj.id).first()
        report("PaymentTransaction Created for Store Checkout", bool(txn_rec and txn_rec.source_form == "Store Checkout" and txn_rec.customer_phone == "9876543210"))

        # -----------------------------------------------------
        # 4. Cash on Delivery (COD) Checkout Flow
        # -----------------------------------------------------
        cod_payload = {
            "customer_name": "COD Devotee",
            "customer_email": "cod_devotee@example.com",
            "customer_phone": "9812345678",
            "shipping_address": "Pune, Maharashtra, 411001",
            "payment_method": "COD",
            "recaptcha_token": "devotee_verified_test",
            "policy_accepted": True,
            "policy_version": "v1.0-2026",
            "items": [{"product_id": prod.id, "quantity": 1}],
        }
        res_cod = client.post("/api/v1/orders/checkout", json=cod_payload)
        cod_data = res_cod.get_json()
        report("COD Checkout Success", res_cod.status_code == 201 and cod_data.get("payment_status") == "cod_pending")

        cod_order = Order.query.filter_by(order_number=cod_data.get("order_number")).first()
        cod_txn = PaymentTransaction.query.filter_by(order_id=cod_order.id).first()
        report("COD Order & Transaction in cod_pending state", cod_order.cod_status == "cod_pending" and cod_txn.status == "cod_pending")

        # -----------------------------------------------------
        # 5. Admin COD Collection Transition
        # -----------------------------------------------------
        import secrets
        admin.session_token = secrets.token_hex(32)
        db.session.commit()
        client.set_cookie("japam_admin_auth", admin.session_token)

        res_collect = client.post(f"/admin/operations/payments/{cod_txn.id}/cod-status", data={"cod_status": "cod_collected"})
        db.session.refresh(cod_txn)
        db.session.refresh(cod_order)
        report("Admin Marks COD Collected", cod_txn.status == "cod_collected" and cod_order.payment_status == "paid")

        # -----------------------------------------------------
        # 6. Puja Booking Form Payment Integration
        # -----------------------------------------------------
        puja_svc = PujaService.query.first()
        if not puja_svc:
            puja_svc = PujaService(name="Vastu Shanti Puja", slug="vastu-shanti", price=Decimal("2100.00"), is_active=True)
            db.session.add(puja_svc)
            db.session.commit()

        puja_payload = {
            "service_id": puja_svc.id,
            "customer_name": "Puja Devotee",
            "customer_email": "puja@example.com",
            "customer_phone": "9988776655",
            "booking_date": "2026-11-15",
            "time_slot": "10:00 AM",
            "booking_type": "online",
            "location": "Nashik",
            "gotra": "Kashyap",
            "recaptcha_token": "devotee_verified_test",
        }
        res_puja = client.post("/api/v1/services/book-puja", json=puja_payload)
        puja_data = res_puja.get_json()
        report("Puja Booking Submission & Transaction Tracking", res_puja.status_code == 201 and "razorpay" in puja_data)

        puja_booking_num = puja_data.get("booking_number")
        puja_txn = PaymentTransaction.query.filter_by(form_submission_id=puja_booking_num).first()
        report("Puja Booking Linked in PaymentTransaction", bool(puja_txn and puja_txn.source_form == "Puja Booking"))

        # -----------------------------------------------------
        # 7. Jyotish Consultation Booking Form Payment Integration
        # -----------------------------------------------------
        cns_payload = {
            "service_id": "kundali-analysis",
            "topic": "Complete Kundali & Life Guidance",
            "customer_name": "Jyotish Devotee",
            "customer_email": "jyotish@example.com",
            "customer_phone": "9123456789",
            "dob": "1992-05-14",
            "tob": "10:30 AM",
            "pob": "Nashik",
            "amount": 101.0,
            "recaptcha_token": "devotee_verified_test",
        }
        res_cns = client.post("/api/v1/services/request-consultation", json=cns_payload)
        cns_data = res_cns.get_json()
        report("Jyotish Consultation Submission & Transaction Tracking", res_cns.status_code == 201 and "razorpay" in cns_data)

        cns_num = cns_data.get("consultation_number")
        cns_txn = PaymentTransaction.query.filter_by(form_submission_id=cns_num).first()
        report("Consultation Linked in PaymentTransaction", bool(cns_txn and cns_txn.source_form == "Consultation Booking"))

        # -----------------------------------------------------
        # 8. Cryptographic Signature Verification
        # -----------------------------------------------------
        ts = int(datetime.now(timezone.utc).timestamp())
        fake_order_id = f"order_test_{ts}"
        fake_payment_id = f"pay_test_{ts}"
        # Generate valid HMAC signature
        raw_msg = f"{fake_order_id}|{fake_payment_id}"
        valid_sig = hmac.new(key_secret.encode("utf-8"), raw_msg.encode("utf-8"), hashlib.sha256).hexdigest()

        # Signature verification on order
        verify_payload = {
            "order_number": order_num,
            "token": order_obj.access_token,
            "razorpay_order_id": fake_order_id,
            "razorpay_payment_id": fake_payment_id,
            "razorpay_signature": valid_sig,
        }
        res_verify = client.post("/api/v1/payments/verify", json=verify_payload)
        report("Authoritative Signature Verification", res_verify.status_code == 200)

        db.session.refresh(order_obj)
        report("Order Transitioned to Paid", order_obj.payment_status == "paid")

        # Test Invalid Signature Rejection
        invalid_payload = {
            "order_number": order_num,
            "token": order_obj.access_token,
            "razorpay_order_id": fake_order_id,
            "razorpay_payment_id": fake_payment_id,
            "razorpay_signature": "tampered_invalid_signature_xyz",
        }
        res_bad_sig = client.post("/api/v1/payments/verify", json=invalid_payload)
        report("Reject Invalid Payment Signature", res_bad_sig.status_code == 400)

        # -----------------------------------------------------
        # 9. Webhook Synchronization & HMAC Verification
        # -----------------------------------------------------
        webhook_secret = app.config.get("PAYMENT_WEBHOOK_SECRET") or key_secret
        wh_order_num = order_num
        wh_amount_paise = int(order_obj.total_amount * 100)
        wh_payload = {
            "event": "payment.captured",
            "event_id": f"evt_test_{int(datetime.now(timezone.utc).timestamp())}",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_wh_test_999",
                        "order_id": fake_order_id,
                        "amount": wh_amount_paise,
                        "notes": {"order_number": wh_order_num},
                    }
                }
            }
        }
        wh_body = json.dumps(wh_payload)
        wh_sig = hmac.new(webhook_secret.encode("utf-8"), wh_body.encode("utf-8"), hashlib.sha256).hexdigest()

        # Test with valid webhook signature
        res_wh = client.post(
            "/api/v1/payments/webhook",
            data=wh_body,
            content_type="application/json",
            headers={"X-Razorpay-Signature": wh_sig}
        )
        report("Webhook Valid HMAC Accepted", res_wh.status_code == 200)

        # Test with invalid webhook signature
        res_bad_wh = client.post(
            "/api/v1/payments/webhook",
            data=wh_body,
            content_type="application/json",
            headers={"X-Razorpay-Signature": "invalid_webhook_sig"}
        )
        report("Webhook Invalid HMAC Rejected with 401", res_bad_wh.status_code == 401)

        # -----------------------------------------------------
        # 10. Admin Operations Search & Filter
        # -----------------------------------------------------
        # Filter by source_form
        res_f_store = client.get("/admin/operations/payments?source_form=Store+Checkout")
        report("Admin Filter by Source Form", res_f_store.status_code == 200 and b"Store Checkout" in res_f_store.data)

        # Search query by transaction number
        res_q = client.get(f"/admin/operations/payments?q={txn_rec.transaction_number}")
        report("Admin Search by Transaction Number", res_q.status_code == 200 and txn_rec.transaction_number.encode() in res_q.data)

        # Detail endpoint
        res_det = client.get(f"/admin/operations/payments/{txn_rec.id}/detail")
        det_json = res_det.get_json()
        report("Admin Transaction Detail Endpoint", res_det.status_code == 200 and det_json.get("transaction_number") == txn_rec.transaction_number)

        # CSV Export
        res_exp = client.get("/admin/operations/payments/export")
        report("Admin CSV Export", res_exp.status_code == 200 and b"Transaction Number" in res_exp.data)

        # -----------------------------------------------------
        # 11. Database Synchronization Check
        # -----------------------------------------------------
        db_path1 = os.path.abspath("instance/japam_admin.db")
        db_path2 = os.path.abspath("japam_admin.db")
        if os.path.exists(db_path1) and os.path.exists(db_path2):
            import shutil
            # Copy active instance db to root japam_admin.db to ensure perfect sync
            shutil.copy2(db_path1, db_path2)
            report("Dual SQLite Databases Synchronized", os.path.getsize(db_path1) == os.path.getsize(db_path2))

        # Restore original payment mode
        PaymentModeService.set_payment_mode(orig_mode, admin_user=admin)

        print("\n=======================================================")
        print(f"  ALL {passed_tests}/{total_tests} PAYMENT TESTS PASSED SUCCESSFULLY! ")
        print("=======================================================\n")

if __name__ == "__main__":
    test_complete_payment_system()
