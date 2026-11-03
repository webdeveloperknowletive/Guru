import os
import sys

sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
from playwright.sync_api import sync_playwright

output_dir = r"C:\Users\Admin\.gemini\antigravity\brain\2a5f9d77-43b5-4780-944e-3385ca1f3d62"
ss_no_gst_shipping = os.path.join(output_dir, "checkout_no_gst_shipping.png")
ss_with_gst_shipping = os.path.join(output_dir, "checkout_with_gst_shipping.png")

def test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1300, 'height': 900})
        page = context.new_page()

        print("=== TEST 1: VERIFY WHEN GST & SHIPPING ARE INACTIVE ===", flush=True)
        # Open Storefront
        page.goto('http://127.0.0.1:3000', wait_until='domcontentloaded')
        page.evaluate("""() => {
            localStorage.setItem('astroveda_dpdp_consent_v1', JSON.stringify({ preferences: { necessary: true } }));
            sessionStorage.setItem('welcome_dismissed', 'true');
        }""")
        page.wait_for_timeout(500)
        page.keyboard.press('Escape')
        page.wait_for_timeout(300)

        # Add Tiger Eye Bracelet (Product ID 26, Price ₹1,899) and open checkout
        page.evaluate("""() => {
            if (window.__astroveda) {
                window.__astroveda.addToCart({
                    id: 26,
                    title: 'Tiger Eye Bracelet',
                    price: 1899,
                    img: '/categories/rudraksha.png'
                }, 1899);
                window.__astroveda.openCheckout();
            }
        }""")
        page.wait_for_timeout(1500)

        # Verify checkout modal opened
        modal = page.locator('.checkout-modal')
        print(f"Checkout modal visible: {modal.is_visible()}", flush=True)

        # Verify GST row is NOT visible
        tax_row_visible = page.locator('text="Vedic Goods GST"').is_visible()
        print(f"Tax row visible: {tax_row_visible} (expected False)", flush=True)
        assert tax_row_visible is False, "Tax row should be hidden when inactive in admin"

        # Verify Shipping row is NOT visible
        shipping_row_visible = page.locator('.checkout-modal :text-matches("^Shipping$")').is_visible()
        print(f"Shipping row visible: {shipping_row_visible} (expected False)", flush=True)
        assert shipping_row_visible is False, "Shipping row should be hidden when inactive in admin"

        # Check Subtotal and Total Amount
        total_text = page.locator('.checkout-modal strong:has-text("₹")').inner_text()
        print(f"Total Amount displayed: '{total_text}'", flush=True)
        assert '1,899' in total_text, f"Expected total to be exactly 1,899 without GST/Shipping, got {total_text}"
        assert '1,955' not in total_text, f"Old hardcoded 3% GST (1,955.97) must not be added! Got {total_text}"

        # Verify Policy content does not mention Cash on Delivery
        policy_text = page.locator('.policy-card').inner_text() if page.locator('.policy-card').is_visible() else ""
        print(f"Policy card contains 'Cash on Delivery': {'Cash on Delivery' in policy_text}", flush=True)
        assert 'Cash on Delivery' not in policy_text, "Return & Product Policy should not mention Cash on Delivery"
        assert 'COD' not in policy_text, "Return & Product Policy should not mention COD"

        page.screenshot(path=ss_no_gst_shipping)
        print(f"Saved screenshot (GST/Shipping Inactive): {ss_no_gst_shipping}", flush=True)

        print("\n=== TEST 2: ENABLE GST (5%) & SHIPPING IN ADMIN AND PUBLISH ===", flush=True)
        admin_page = context.new_page()
        admin_page.goto('http://127.0.0.1:5000/auth/login', wait_until='domcontentloaded')
        admin_page.fill('input[name="email"]', 'admin@japam.in')
        admin_page.fill('input[name="password"]', 'Admin@1234')
        admin_page.click('button[type="submit"]')
        admin_page.wait_for_url('**/admin/**', timeout=6000)

        admin_page.goto('http://127.0.0.1:5000/admin/system/checkout-builder', wait_until='domcontentloaded')
        admin_page.wait_for_timeout(1000)

        # Switch to Order Summary tab
        admin_page.click('button[data-tab="tab-summary"]')
        admin_page.wait_for_timeout(400)

        # Turn ON GST row
        admin_page.evaluate("""() => {
            const tax = document.getElementById('sum_show_tax');
            if (!tax.checked) tax.click();
            const ship = document.getElementById('sum_show_shipping');
            if (!ship.checked) ship.click();
        }""")
        admin_page.wait_for_timeout(200)
        # Set GST to 5%
        admin_page.locator('#sum_gst_pct').fill('5')
        # Set Free shipping threshold to 2500 so 1899 incurs shipping
        admin_page.locator('#sum_free_thresh').fill('2500')
        admin_page.wait_for_timeout(300)

        # Publish Live
        admin_page.evaluate("window.prompt = () => 'Enable 5% GST and shipping'")
        admin_page.click('.cb-btn-publish')
        admin_page.wait_for_timeout(1500)
        print("Published config with 5% GST and Shipping enabled!", flush=True)

        print("\n=== TEST 3: VERIFY STOREFRONT REFLECTS 5% GST AND SHIPPING ===", flush=True)
        # Reopen checkout on storefront
        page.evaluate("""() => {
            if (window.__astroveda) {
                window.__astroveda.refreshCheckoutConfig();
                window.__astroveda.openCheckout();
            }
        }""")
        page.wait_for_timeout(1500)

        # Verify GST row is visible with 5%
        tax_row = page.locator('text="Vedic Goods GST (5%)"')
        print(f"5% GST row visible: {tax_row.is_visible()}", flush=True)
        assert tax_row.is_visible() is True, "5% GST row should now be visible"

        # Check Total: 1899 + 5% (94.95) + 99 shipping = 2,092.95
        new_total = page.locator('.checkout-modal strong:has-text("₹")').inner_text()
        print(f"New Total with 5% GST and shipping: '{new_total}'", flush=True)
        assert '2,092.95' in new_total or '2,093' in new_total, f"Expected total ~2,092.95, got {new_total}"

        page.screenshot(path=ss_with_gst_shipping)
        print(f"Saved screenshot (GST/Shipping Active): {ss_with_gst_shipping}", flush=True)

        print("\n=== TEST 4: RESTORE INACTIVE GST/SHIPPING AS USER REQUESTED ===", flush=True)
        admin_page.bring_to_front()
        admin_page.click('button[data-tab="tab-summary"]')
        admin_page.wait_for_timeout(300)
        admin_page.evaluate("""() => {
            const tax = document.getElementById('sum_show_tax');
            if (tax.checked) tax.click();
            const ship = document.getElementById('sum_show_shipping');
            if (ship.checked) ship.click();
        }""")
        admin_page.wait_for_timeout(300)
        admin_page.evaluate("window.prompt = () => 'Turn off GST and Shipping rows as requested'")
        admin_page.click('.cb-btn-publish')
        admin_page.wait_for_timeout(1500)
        print("Published config with GST and Shipping rows inactive!", flush=True)

        # Check storefront returns to product price 1899
        page.bring_to_front()
        page.evaluate("""() => {
            if (window.__astroveda) {
                window.__astroveda.refreshCheckoutConfig();
                window.__astroveda.openCheckout();
            }
        }""")
        page.wait_for_timeout(1500)
        restored_total = page.locator('.checkout-modal strong:has-text("₹")').inner_text()
        print(f"Restored Total without GST/Shipping: '{restored_total}'", flush=True)
        assert '1,899' in restored_total, f"Expected product price 1,899, got {restored_total}"

        print("\n>>> ALL DYNAMIC CALCULATION AND POLICY CHECKS PASSED PERFECTLY! <<<", flush=True)
        browser.close()

if __name__ == '__main__':
    test()
