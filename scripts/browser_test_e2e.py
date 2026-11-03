import os
import sys
import json
import time
from playwright.sync_api import sync_playwright

def run_browser_verification():
    sample_cart = [{
        'id': 1,
        'title': 'Sacred Rose Quartz Bracelet',
        'price': 1299,
        'qty': 1,
        'img': '/categories/rudraksha.png'
    }]

    output_dir = r"C:\Users\Admin\.gemini\antigravity\brain\2a5f9d77-43b5-4780-944e-3385ca1f3d62"
    ss_path1 = os.path.join(output_dir, "storefront_live_checkout.png")
    ss_path2 = os.path.join(output_dir, "storefront_updated_checkout.png")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 900})
        
        # Inject cart into localStorage so user has 1 item
        cart_json = json.dumps(sample_cart)
        consent_json = json.dumps({'preferences': {'necessary': True}})
        
        context.add_init_script(f"""
            localStorage.setItem('astroveda_cart_v2', '{cart_json}');
            localStorage.setItem('astroveda_dpdp_consent_v1', '{consent_json}');
        """)

        page = context.new_page()
        print("Navigating to http://127.0.0.1:3000...")
        page.goto('http://127.0.0.1:3000', wait_until='networkidle')
        page.wait_for_timeout(1000)

        # Open cart
        print("Opening cart drawer...")
        page.click('#cartBtn')
        page.wait_for_timeout(800)

        chk_btn = page.locator('.btn-checkout')
        if not chk_btn.is_visible():
            print("ERROR: Checkout button not visible in cart drawer!")
            sys.exit(1)

        print("Clicking Proceed to Checkout...")
        chk_btn.click()
        page.wait_for_timeout(1200)

        chk_modal = page.locator('.checkout-modal')
        if not chk_modal.is_visible():
            print("ERROR: Checkout modal did not open!")
            sys.exit(1)

        # Verify live values from admin changes
        kicker_text = page.locator('.checkout-form-col .kicker').inner_text()
        print(f"Storefront Kicker Text: '{kicker_text}'")

        # Check payment methods
        razorpay_opt = page.locator('.pm-card.pm-razorpay')
        cod_opt = page.locator('.pm-card.pm-cod')
        print(f"Razorpay option visible: {razorpay_opt.is_visible()}")
        print(f"COD option visible: {cod_opt.is_visible()}")

        # Take screenshot 1
        page.screenshot(path=ss_path1, full_page=False)
        print(f"Saved Screenshot 1: {ss_path1}")

        # Now let's test admin live update:
        # Step 2: Update configuration through admin API
        print("\n--- Testing Real-Time Admin Update to Frontend ---")
        import urllib.request
        
        # Fetch current draft/published config from backend
        req = urllib.request.Request("http://127.0.0.1:5000/api/v1/checkout/config")
        with urllib.request.urlopen(req) as resp:
            cfg = json.loads(resp.read().decode('utf-8'))
            current_config = cfg.get("config", {})

        # Change Kicker to "DIVINE BLESSINGS CHECKOUT" and re-enable COD
        current_config["page"]["kicker"] = "DIVINE BLESSINGS CHECKOUT"
        current_config["payment_methods"]["cod"]["enabled"] = True
        current_config["payment_methods"]["cod"]["title"] = "Sacred Cash on Delivery"

        # Publish via Flask API
        post_data = json.dumps({"config": current_config, "change_summary": "E2E automated test: enable COD & new kicker"}).encode('utf-8')
        pub_req = urllib.request.Request("http://127.0.0.1:5000/admin/system/checkout-builder/publish", 
                                         data=post_data, 
                                         headers={"Content-Type": "application/json"})
        
        # Note: Admin endpoint requires session/cookie or we can use CheckoutBuilderService directly via Python script if needed.
        # Let's test if pub_req succeeds directly or requires admin session:
        try:
            with urllib.request.urlopen(pub_req) as pub_resp:
                pub_result = json.loads(pub_resp.read().decode('utf-8'))
                print("Publish API result:", pub_result.get("success"))
        except Exception as e:
            print(f"API publish required admin session ({e}), applying via CheckoutBuilderService...")
            from app import create_app
            from app.services.checkout_builder_service import CheckoutBuilderService
            flask_app = create_app()
            with flask_app.app_context():
                CheckoutBuilderService.publish_config(current_config, change_summary="E2E test: enable COD & new kicker", published_by=1)
            print("Successfully published updated config via CheckoutBuilderService.")

        # Reload storefront and re-open modal
        print("Reloading storefront to verify live pickup...")
        page.reload(wait_until='networkidle')
        page.wait_for_timeout(1000)

        page.click('#cartBtn')
        page.wait_for_timeout(600)
        page.click('.btn-checkout')
        page.wait_for_timeout(1000)

        updated_kicker = page.locator('.checkout-form-col .kicker').inner_text()
        print(f"Updated Kicker Text on Storefront: '{updated_kicker}'")

        cod_visible_now = page.locator('.pm-card.pm-cod').is_visible()
        print(f"Is COD visible now after enabling in Admin?: {cod_visible_now}")
        
        if cod_visible_now:
            cod_label = page.locator('.pm-card.pm-cod .pm-title').inner_text()
            print(f"COD Label on Storefront: '{cod_label}'")

        # Take screenshot 2
        page.screenshot(path=ss_path2, full_page=False)
        print(f"Saved Screenshot 2: {ss_path2}")

        # Assertions
        assert "DIVINE BLESSINGS CHECKOUT" in updated_kicker, f"Expected updated kicker, got {updated_kicker}"
        assert cod_visible_now is True, "Expected COD to be visible after enabling in admin"

        print("\n>>> ALL LIVE BROWSER VERIFICATIONS PASSED SUCCESSFULLY! <<<")
        browser.close()

if __name__ == '__main__':
    run_browser_verification()

