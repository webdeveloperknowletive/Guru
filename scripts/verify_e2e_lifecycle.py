import os
import sys

sys.path.insert(0, os.path.abspath('japam-backend'))
from app import create_app
from app.models.user import AdminUser
from app.models.commerce import Product
from app.models.service import PujaService

app = create_app('development')

with app.app_context():
    admin = AdminUser.query.first()
    if not admin.session_token:
        admin.session_token = "admin_e2e_session_token"
        from app.extensions import db
        db.session.commit()

    prod = Product.query.filter(Product.stock_quantity > 0, Product.publishing_status == 'published').first()
    assert prod is not None, "Product must exist"
    puja = PujaService.query.first()
    assert puja is not None, "PujaService must exist"

    with app.test_client() as client:
        # Authenticate admin
        client.set_cookie('japam_admin_auth', admin.session_token)

        # -------------------------------------------------------------
        # 1. Product Checkout
        # -------------------------------------------------------------
        checkout_payload = {
            'customer_name': 'Aman Gupta',
            'customer_email': 'webdeveloper.knowletive@gmail.com',
            'customer_phone': '9876543210',
            'shipping_address': 'Flat 201, Shivam Heights, Baner, Pune 411045',
            'payment_method': 'COD',
            'policy_accepted': True,
            'recaptcha_token': 'devotee_verified_e2e',
            'items': [{'product_id': prod.id, 'quantity': 1}]
        }
        res = client.post('/api/v1/orders/checkout', json=checkout_payload)
        assert res.status_code in (200, 201), f"Checkout failed: {res.get_json()}"
        order_info = res.get_json()
        order_number = order_info['order_number']
        token = order_info['access_token']
        order_id = order_info['order_id']
        clean_num = order_number.lstrip('#')
        print(f"[PASS] 1. Order checked out: {order_number} (ID: {order_id})")

        # -------------------------------------------------------------
        # 2. Devotee Order Tracking (via Email)
        # -------------------------------------------------------------
        # Test clean number (ORD1118)
        tr1 = client.get(f'/api/v1/orders/{clean_num}?email=webdeveloper.knowletive@gmail.com')
        assert tr1.status_code == 200, f"Tracking failed with clean_num: {tr1.get_json()}"
        assert tr1.get_json()['order_number'] == order_number
        print(f"[PASS] 2a. Tracking with clean number '{clean_num}': 200 OK")

        # Test encoded # number (%23ORD1118)
        tr2 = client.get(f'/api/v1/orders/%23{clean_num}?email=webdeveloper.knowletive@gmail.com')
        assert tr2.status_code == 200, f"Tracking failed with encoded hash: {tr2.get_json()}"
        print(f"[PASS] 2b. Tracking with encoded hash '%23{clean_num}': 200 OK")

        # Test digits only
        import re
        digits = re.sub(r'[^\d]', '', clean_num)
        tr3 = client.get(f'/api/v1/orders/{digits}?email=webdeveloper.knowletive@gmail.com')
        assert tr3.status_code == 200, f"Tracking failed with digits: {tr3.get_json()}"
        print(f"[PASS] 2c. Tracking with numeric digits '{digits}': 200 OK")

        # -------------------------------------------------------------
        # 3. Devotee Order Tracking (via Access Token)
        # -------------------------------------------------------------
        tr_token = client.get(f'/api/v1/orders/{clean_num}?token={token}')
        assert tr_token.status_code == 200, f"Tracking failed with token: {tr_token.get_json()}"
        print(f"[PASS] 3. Tracking with token: 200 OK")

        # -------------------------------------------------------------
        # 4. Admin Orders List
        # -------------------------------------------------------------
        admin_list = client.get(f'/admin/commerce/orders?q={clean_num}')
        assert admin_list.status_code == 200
        assert clean_num in admin_list.get_data(as_text=True)
        print(f"[PASS] 4. Admin orders list shows {order_number}")

        # -------------------------------------------------------------
        # 5. Admin Order Detail
        # -------------------------------------------------------------
        admin_detail = client.get(f'/admin/commerce/orders/{order_id}')
        assert admin_detail.status_code == 200
        assert 'Aman Gupta' in admin_detail.get_data(as_text=True)
        print(f"[PASS] 5. Admin order detail verified")

        # -------------------------------------------------------------
        # 6. Admin Payment Transactions
        # -------------------------------------------------------------
        admin_payments = client.get('/admin/operations/payments')
        assert admin_payments.status_code == 200
        assert clean_num in admin_payments.get_data(as_text=True)
        print(f"[PASS] 6. Admin payments view displays transaction for {order_number}")

        # -------------------------------------------------------------
        # 7. Admin Customers
        # -------------------------------------------------------------
        admin_cust = client.get('/admin/commerce/customers')
        assert admin_cust.status_code == 200
        assert 'webdeveloper.knowletive@gmail.com' in admin_cust.get_data(as_text=True)
        print(f"[PASS] 7. Admin customer profile verified")

        # -------------------------------------------------------------
        # 8. Puja Booking
        # -------------------------------------------------------------
        pb_res = client.post('/api/v1/services/book-puja', json={
            'service_id': puja.id,
            'customer_name': 'Sunita Deshmukh',
            'customer_email': 'sunita.deshmukh@example.com',
            'customer_phone': '9811223344',
            'gotra': 'Shandilya',
            'booking_date': '2026-11-20',
            'time_slot': '09:00 AM',
            'booking_type': 'online',
            'recaptcha_token': 'devotee_verified_e2e'
        })
        assert pb_res.status_code in (200, 201)
        pb_num = pb_res.get_json()['booking_number']
        admin_pb = client.get('/admin/services/bookings')
        assert admin_pb.status_code == 200
        assert pb_num.lstrip('#') in admin_pb.get_data(as_text=True)
        print(f"[PASS] 8. Puja booking {pb_num} created & visible in admin")

        # -------------------------------------------------------------
        # 9. Jyotish Consultation
        # -------------------------------------------------------------
        jc_res = client.post('/api/v1/services/request-consultation', json={
            'customer_name': 'Kavita Joshi',
            'customer_email': 'kavita.joshi@example.com',
            'customer_phone': '9822334455',
            'dob': '1990-08-15',
            'tob': '10:15',
            'pob': 'Mumbai',
            'topic': 'Career & Finance Consultation',
            'scheduled_at': '2026-11-22 15:00:00',
            'recaptcha_token': 'devotee_verified_e2e'
        })
        assert jc_res.status_code in (200, 201)
        jc_num = jc_res.get_json()['consultation_number']
        admin_jc = client.get('/admin/services/consultations')
        assert admin_jc.status_code == 200
        assert jc_num.lstrip('#') in admin_jc.get_data(as_text=True)
        print(f"[PASS] 9. Jyotish consultation {jc_num} created & visible in admin")

        # -------------------------------------------------------------
        # 10. Devotee Contact Enquiry
        # -------------------------------------------------------------
        enq_res = client.post('/api/v1/contact', json={
            'name': 'Mahesh Kulkarni',
            'email': 'mahesh.kulkarni@example.com',
            'phone': '9844556677',
            'subject': 'Rudraksha Mala Energization Inquiry',
            'message': 'Please provide details on authentic energization ritual process.',
            'recaptcha_token': 'devotee_verified_e2e'
        })
        assert enq_res.status_code in (200, 201)
        admin_enq = client.get('/admin/operations/enquiries')
        assert admin_enq.status_code == 200
        assert 'mahesh.kulkarni@example.com' in admin_enq.get_data(as_text=True)
        print(f"[PASS] 10. Contact enquiry saved & visible in admin")

print("\n=======================================================")
print(" ALL 10 E2E LIFECYCLE CHECKS PASSED: ZERO DATA LOSS")
print("=======================================================")
