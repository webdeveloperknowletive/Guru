import sys
import json
from decimal import Decimal

sys.path.insert(0, 'japam-backend')
from app import create_app
from app.extensions import db
from app.models.operations import CheckoutFormConfig, SystemSetting
from app.models.commerce import Category, Product, Order
from app.models.user import AdminUser
from app.services.checkout_builder_service import CheckoutBuilderService

def run_tests():
    app = create_app('testing')
    client = app.test_client()

    with app.app_context():
        print("=== CHECKOUT FORM BUILDER COMPREHENSIVE TEST SUITE ===")
        
        # 1. Seed category & test product
        category = Category.query.first()
        if not category:
            category = Category(name="Sacred Bracelets", slug="sacred-bracelets")
            db.session.add(category)
            db.session.flush()

        product = Product.query.filter_by(sku="TEST-BRACELET-01").first()
        if not product:
            product = Product(
                category_id=category.id,
                name="Sacred Rose Quartz Bracelet",
                slug="sacred-rose-quartz-bracelet",
                sku="TEST-BRACELET-01",
                price=Decimal("1299.00"),
                stock_quantity=100,
                publishing_status="published",
            )
            db.session.add(product)
            db.session.commit()
            print("[SETUP] Created test product ID:", product.id)
        else:
            product.stock_quantity = 100
            db.session.commit()

        # 2. Reset / Seed Baseline Checkout Config
        CheckoutBuilderService.restore_defaults()
        CheckoutBuilderService.publish_config(publish_notes="Baseline Test Publish")
        pub_record = CheckoutBuilderService.get_published_record()
        print(f"[TEST 1] Published baseline config version: {pub_record.version}")
        assert pub_record is not None
        assert pub_record.status == "published"

        # 3. Test Public API endpoint GET /api/v1/checkout/config
        res = client.get("/api/v1/checkout/config")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        pub_json = res.get_json()
        assert pub_json.get("success") is True
        cfg = pub_json.get("config")
        assert cfg is not None
        assert "fields" in cfg
        assert "payment_methods" in cfg
        assert "policy" in cfg
        assert "order_summary" in cfg
        print("[TEST 2] GET /api/v1/checkout/config passed with full public schema.")

        # 4. Test Draft vs Published Isolation
        # Modify draft by adding a custom field 'landmark'
        draft_cfg = json.loads(json.dumps(cfg))
        draft_cfg["fields"].append({
            "id": "landmark",
            "key": "landmark",
            "label": "Landmark / Special Location",
            "placeholder": "Near Temple",
            "type": "text",
            "required": True,
            "enabled": True,
            "is_custom": True
        })
        saved_draft = CheckoutBuilderService.save_draft(draft_cfg)
        assert saved_draft["status"] == "draft"

        # Public endpoint must still return published config (WITHOUT landmark)
        res_public = client.get("/api/v1/checkout/config")
        pub_fields = [f.get("key") for f in res_public.get_json()["config"]["fields"]]
        assert "landmark" not in pub_fields, "Draft leak: landmark should NOT be in published public config!"
        print("[TEST 3] Draft vs Published Isolation passed: Draft changes are isolated.")

        # 5. Test Publishing Draft
        published_v2 = CheckoutBuilderService.publish_config(publish_notes="Added Landmark custom field")
        assert published_v2["version"] > pub_record.version
        res_public_v2 = client.get("/api/v1/checkout/config")
        pub_fields_v2 = [f.get("key") for f in res_public_v2.get_json()["config"]["fields"]]
        assert "landmark" in pub_fields_v2, "Landmark should now be present in published config after publishing!"
        print(f"[TEST 4] Published live promotion passed. New version: v{published_v2['version']}")

        # 6. Test Dynamic Required Field Validation for Custom Field
        # Attempt checkout without required landmark -> expect 400
        checkout_payload = {
            "customer_name": "Rohan Deshmukh",
            "customer_email": "rohan@example.com",
            "customer_phone": "9876543210",
            "shipping_address": "Flat 402, Shiv Shrushti",
            "city": "Pune",
            "pincode": "411001",
            "payment_method": "Razorpay",
            "policy_accepted": True,
            "recaptcha_token": "test-valid-recaptcha-token",
            "items": [{"product_id": product.id, "quantity": 1}]
        }
        res_fail = client.post("/api/v1/orders/checkout", json=checkout_payload)
        assert res_fail.status_code == 400, f"Expected 400 for missing landmark, got {res_fail.status_code}"
        assert "Landmark" in res_fail.get_json()["error"]
        print("[TEST 5] Dynamic custom field requirement validation passed: Rejected missing landmark.")

        # 7. Test Successful Checkout with Custom Field Saved into Admin Notes
        checkout_payload["landmark"] = "Behind Ganesh Mandir"
        res_success = client.post("/api/v1/orders/checkout", json=checkout_payload)
        assert res_success.status_code in (200, 201), f"Expected 200/201, got {res_success.status_code}: {res_fail.data}"
        succ_data = res_success.get_json()
        order_num = succ_data["order_number"]
        saved_order = Order.query.filter_by(order_number=order_num).first()
        assert saved_order is not None
        assert "Behind Ganesh Mandir" in (saved_order.admin_notes or "")
        print("[TEST 6] Custom field persisted into Order.admin_notes successfully.")

        # 8. Test Disabling Cash on Delivery (COD) in Admin
        current_cfg = CheckoutBuilderService.get_published_config()
        current_cfg["payment_methods"]["cod"]["enabled"] = False
        CheckoutBuilderService.save_draft(current_cfg)
        CheckoutBuilderService.publish_config(publish_notes="Disabled COD")
        
        # Attempt checkout with COD -> expect 400
        checkout_payload["payment_method"] = "Cash on Delivery"
        res_cod_disabled = client.post("/api/v1/orders/checkout", json=checkout_payload)
        assert res_cod_disabled.status_code == 400
        assert "Cash on Delivery" in res_cod_disabled.get_json()["error"]
        print("[TEST 7] Disabled COD enforcement passed: Rejected COD payment when disabled.")

        # 9. Test Disabling Razorpay Online in Admin
        current_cfg = CheckoutBuilderService.get_published_config()
        current_cfg["payment_methods"]["cod"]["enabled"] = True
        current_cfg["payment_methods"]["razorpay"]["enabled"] = False
        CheckoutBuilderService.save_draft(current_cfg)
        CheckoutBuilderService.publish_config(publish_notes="Disabled Razorpay, Enabled COD")
        
        # Attempt checkout with Razorpay -> expect 400
        checkout_payload["payment_method"] = "Razorpay"
        res_rzp_disabled = client.post("/api/v1/orders/checkout", json=checkout_payload)
        assert res_rzp_disabled.status_code == 400
        assert "Online payment" in res_rzp_disabled.get_json()["error"]
        print("[TEST 8] Disabled Razorpay enforcement passed: Rejected online payment when disabled.")

        # 10. Test COD Minimum and Maximum Order Value Limits
        current_cfg["payment_methods"]["cod"]["min_order_value"] = 2000 # higher than 1 item ₹1,299
        CheckoutBuilderService.save_draft(current_cfg)
        CheckoutBuilderService.publish_config(publish_notes="Set COD min ₹2000")
        checkout_payload["payment_method"] = "Cash on Delivery"
        res_cod_limit = client.post("/api/v1/orders/checkout", json=checkout_payload)
        assert res_cod_limit.status_code == 400
        assert "minimum" in res_cod_limit.get_json()["error"].lower()
        print("[TEST 9] COD minimum order value threshold enforcement passed.")

        # 11. Test Mandatory Policy Agreement Enforcement
        current_cfg["payment_methods"]["cod"]["min_order_value"] = 0
        current_cfg["payment_methods"]["razorpay"]["enabled"] = True
        current_cfg["policy"]["agreement_required"] = True
        current_cfg["policy"]["agreement_error"] = "Custom error: You must agree to holy policy."
        CheckoutBuilderService.save_draft(current_cfg)
        CheckoutBuilderService.publish_config(publish_notes="Custom policy error")

        checkout_payload["payment_method"] = "Cash on Delivery"
        checkout_payload["policy_accepted"] = False
        res_policy_err = client.post("/api/v1/orders/checkout", json=checkout_payload)
        assert res_policy_err.status_code == 400
        assert "Custom error: You must agree to holy policy." in res_policy_err.get_json()["error"]
        print("[TEST 10] Dynamic policy agreement enforcement with custom error passed.")

        # 12. Test CAPTCHA Deactivation (Allows Checkout without token)
        current_cfg["policy"]["agreement_required"] = True
        current_cfg["captcha"]["enabled"] = False
        CheckoutBuilderService.save_draft(current_cfg)
        CheckoutBuilderService.publish_config(publish_notes="Disabled CAPTCHA")

        checkout_payload["policy_accepted"] = True
        checkout_payload["recaptcha_token"] = None # No token
        res_no_captcha = client.post("/api/v1/orders/checkout", json=checkout_payload)
        assert res_no_captcha.status_code in (200, 201), f"Expected 200 without captcha when disabled, got {res_no_captcha.status_code}: {res_no_captcha.data}"
        print("[TEST 11] CAPTCHA deactivation passed: Order allowed without captcha token.")

        # 13. Test Version Rollback
        history = CheckoutBuilderService.get_version_history()
        assert len(history) >= 2
        # Target version 1
        v1_record = [h for h in history if h["version"] == 1][0]
        restored = CheckoutBuilderService.restore_version(v1_record["id"])
        restored_cfg = restored.get("config") or json.loads(restored.get("config_data", "{}"))
        restored_keys = [f.get("key") for f in restored_cfg["fields"]]
        assert "landmark" not in restored_keys
        print(f"[TEST 12] Version rollback passed: Restored version {v1_record['version']} into draft.")

        # 14. Reset back to clean canonical defaults
        CheckoutBuilderService.restore_defaults()
        CheckoutBuilderService.publish_config(publish_notes="Restored clean defaults after test run")
        print("[TEST 13] Reset to canonical defaults passed.")

        print("\nALL 13 CHECKOUT BUILDER VERIFICATION TESTS PASSED SUCCESSFULLY! (13/13)")

if __name__ == "__main__":
    run_tests()
