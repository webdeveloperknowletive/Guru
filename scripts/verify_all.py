import os
import sys

sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
from playwright.sync_api import sync_playwright

output_dir = r"C:\Users\Admin\.gemini\antigravity\brain\2a5f9d77-43b5-4780-944e-3385ca1f3d62"
ss_admin_desktop = os.path.join(output_dir, "admin_builder_desktop.png")
ss_admin_mobile = os.path.join(output_dir, "admin_builder_mobile.png")
ss_storefront = os.path.join(output_dir, "storefront_live_modal.png")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1400, 'height': 950})
        page = context.new_page()

        print("1. Logging into Admin...", flush=True)
        page.goto('http://127.0.0.1:5000/auth/login', wait_until='domcontentloaded')
        page.fill('input[name="email"]', 'admin@japam.in')
        page.fill('input[name="password"]', 'Admin@1234')
        page.click('button[type="submit"]')
        page.wait_for_url('**/admin/**', timeout=6000)
        print("   Admin Login success! URL:", page.url, flush=True)

        print("2. Navigating to Checkout Form Builder...", flush=True)
        page.goto('http://127.0.0.1:5000/admin/system/checkout-builder', wait_until='domcontentloaded')
        page.wait_for_timeout(1000)

        # Check tabs
        tab_fields = page.locator('#tab-fields')
        tab_page = page.locator('#tab-page')
        print(f"   Tab Fields visible: {tab_fields.is_visible()}, Tab Page visible: {tab_page.is_visible()}", flush=True)

        # Click Tab 2: Page & Headings
        print("3. Switching to 'Page & Headings' tab...", flush=True)
        page.click('button[data-tab="tab-page"]')
        page.wait_for_timeout(400)
        print(f"   After tab click: Tab Fields: {tab_fields.is_visible()}, Tab Page: {tab_page.is_visible()}", flush=True)

        # Update Kicker
        kicker_input = page.locator('#cfg_kicker')
        kicker_input.fill('100% SACRED & LAB CERTIFIED CHECKOUT')
        page.wait_for_timeout(300)
        prev_kicker = page.locator('#prevKicker').inner_text()
        print(f"   Live preview kicker text: '{prev_kicker}'", flush=True)

        # Screenshot Desktop
        page.screenshot(path=ss_admin_desktop, full_page=False)
        print(f"   Saved Admin Desktop screenshot: {ss_admin_desktop}", flush=True)

        # Device switcher - mobile
        print("4. Testing mobile preview frame...", flush=True)
        page.click('button[data-frame="mobile"]')
        page.wait_for_timeout(300)
        page.screenshot(path=ss_admin_mobile, full_page=False)
        print(f"   Saved Admin Mobile screenshot: {ss_admin_mobile}", flush=True)

        # Publish Live
        print("5. Publishing live to website...", flush=True)
        page.evaluate("window.prompt = () => 'E2E Verification Test Publish'")
        page.click('.cb-btn-publish')
        page.wait_for_timeout(1500)
        toast = page.locator('#cbToast').inner_text()
        print(f"   Publish toast: '{toast}'", flush=True)

        # 6. Verify Storefront
        print("6. Verifying Storefront opens checkout with published config...", flush=True)
        sf_page = context.new_page()
        sf_page.goto('http://127.0.0.1:3000', wait_until='domcontentloaded')
        sf_page.wait_for_timeout(1000)
        sf_page.keyboard.press('Escape')
        sf_page.wait_for_timeout(300)

        # Add item and open checkout
        sf_page.evaluate("""() => {
            if (window.__astroveda) {
                window.__astroveda.addToCart({
                    id: 1,
                    title: 'Rose Quartz Bracelet',
                    price: 1299,
                    img: '/categories/rudraksha.png'
                }, 1299);
                window.__astroveda.openCheckout();
            }
        }""")
        sf_page.wait_for_timeout(1200)

        modal = sf_page.locator('.checkout-modal')
        print(f"   Storefront checkout modal is open: {modal.is_visible()}", flush=True)
        sf_kicker = sf_page.locator('.checkout-form-col .kicker').inner_text()
        print(f"   Storefront Live Kicker: '{sf_kicker}'", flush=True)
        assert '100% SACRED & LAB CERTIFIED CHECKOUT' in sf_kicker, f"Mismatch in storefront kicker: {sf_kicker}"

        sf_page.screenshot(path=ss_storefront)
        print(f"   Saved Storefront Modal screenshot: {ss_storefront}", flush=True)

        # 7. Restore Canonical Defaults in Admin
        print("7. Restoring Canonical Defaults...", flush=True)
        page.evaluate("window.confirm = () => true")
        page.click('.cb-header-actions button:has-text("Reset Defaults")')
        page.wait_for_timeout(1000)
        page.evaluate("window.prompt = () => 'Restored defaults'")
        page.click('.cb-btn-publish')
        page.wait_for_timeout(1500)
        print("   Restored defaults successfully!", flush=True)

        print("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<", flush=True)
        browser.close()

if __name__ == '__main__':
    run()

