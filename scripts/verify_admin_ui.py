import os
import sys
import codecs
sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'replace')

from playwright.sync_api import sync_playwright

def verify_ui():
    output_dir = r"C:\Users\Admin\.gemini\antigravity\brain\2a5f9d77-43b5-4780-944e-3385ca1f3d62"
    ss_admin_desktop = os.path.join(output_dir, "admin_ui_desktop.png")
    ss_admin_mobile = os.path.join(output_dir, "admin_ui_mobile.png")
    ss_storefront = os.path.join(output_dir, "storefront_verified.png")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1400, 'height': 950})
        page = context.new_page()

        # 1. Login to Admin
        print("1. Logging into Admin panel...")
        page.goto('http://127.0.0.1:5000/auth/login', wait_until='domcontentloaded')
        page.fill('input[name="email"]', 'admin@japam.in')
        page.fill('input[name="password"]', 'Admin@1234')
        page.click('button[type="submit"]')
        page.wait_for_timeout(1000)

        # 2. Go to Checkout Form Builder
        print("2. Navigating to Checkout Form Builder...")
        page.goto('http://127.0.0.1:5000/admin/system/checkout-builder', wait_until='domcontentloaded')
        page.wait_for_timeout(1000)

        # Check tabs and ensure tab-page is hidden initially
        tab_fields = page.locator('#tab-fields')
        tab_page = page.locator('#tab-page')
        print(f"Tab Fields visible: {tab_fields.is_visible()}, Tab Page visible: {tab_page.is_visible()}")
        assert tab_fields.is_visible() is True, "Tab Fields should be visible"
        assert tab_page.is_visible() is False, "Tab Page should be hidden initially"

        # Click Tab 2: Page & Headings
        print("3. Clicking 'Page & Headings' tab...")
        page.click('button[data-tab="tab-page"]')
        page.wait_for_timeout(300)
        print(f"After tab click -> Tab Fields visible: {tab_fields.is_visible()}, Tab Page visible: {tab_page.is_visible()}")
        assert tab_page.is_visible() is True, "Tab Page should now be active"

        # Check live preview kicker
        kicker_input = page.locator('#cfg_kicker')
        kicker_input.fill('DIVINE SANCTUARY CHECKOUT')
        page.wait_for_timeout(300)

        preview_kicker = page.locator('#prevKicker').inner_text()
        print(f"Live preview kicker text after typing: '{preview_kicker}'")
        assert 'DIVINE SANCTUARY CHECKOUT' in preview_kicker, "Live preview should reflect input instantly"

        # Take Desktop Screenshot
        page.screenshot(path=ss_admin_desktop, full_page=False)
        print(f"Saved Admin Desktop Screenshot to: {ss_admin_desktop}")

        # Switch to Mobile preview frame
        print("4. Testing device view switcher...")
        page.click('button[data-frame="mobile"]')
        page.wait_for_timeout(300)
        frame_class = page.locator('#previewFrame').get_attribute('class')
        print(f"Preview frame class after mobile switch: '{frame_class}'")
        assert 'mobile' in frame_class, "Preview frame should have mobile class"

        # Test publishing live to website
        print("5. Publishing live to website...")
        # Override window.prompt in page to auto-return release note
        page.evaluate("window.prompt = () => 'Automated UI test verification publish'")
        page.click('.cb-btn-publish')
        page.wait_for_timeout(1500)

        # Check toast
        toast_text = page.locator('#cbToast').inner_text()
        print(f"Publish toast message: '{toast_text}'")

        # 6. Verify Storefront Live Pickup
        print("6. Verifying Storefront picks up published config...")
        sf_page = context.new_page()
        sf_page.goto('http://127.0.0.1:3000', wait_until='domcontentloaded')
        sf_page.evaluate("""() => {
            localStorage.setItem('astroveda_dpdp_consent_v1', JSON.stringify({ preferences: { necessary: true } }));
            sessionStorage.setItem('welcome_dismissed', 'true');
        }""")
        sf_page.wait_for_timeout(500)
        sf_page.keyboard.press('Escape')
        sf_page.wait_for_timeout(500)

        # Add item and open checkout
        sf_page.evaluate("""() => {
            if (window.__astroveda) {
                window.__astroveda.addToCart({
                    id: 1,
                    title: 'Sacred Rose Quartz Bracelet',
                    price: 1299,
                    img: '/categories/rudraksha.png'
                }, 1299);
                window.__astroveda.openCheckout();
            }
        }""")
        sf_page.wait_for_timeout(1500)

        sf_kicker = sf_page.locator('.checkout-form-col .kicker').inner_text()
        print(f"Storefront Kicker from published live config: '{sf_kicker}'")
        sf_page.screenshot(path=ss_storefront)
        print(f"Saved Storefront Screenshot to: {ss_storefront}")

        assert 'DIVINE SANCTUARY CHECKOUT' in sf_kicker, f"Expected storefront kicker to match published value, got '{sf_kicker}'"

        # 7. Restore Canonical Defaults
        print("7. Restoring canonical defaults...")
        page.evaluate("window.confirm = () => true")
        page.click('.cb-header-actions button:has-text(\"Reset Defaults\")')
        page.wait_for_timeout(1000)
        page.evaluate("window.prompt = () => 'Restored defaults after verification'")
        page.click('.cb-btn-publish')
        page.wait_for_timeout(1500)
        print("Canonical defaults restored and published successfully.")

        print("\n>>> ALL ADMIN UI AND STOREFRONT CONNECTION CHECKS PASSED! <<<")
        browser.close()

if __name__ == '__main__':
    verify_ui()
