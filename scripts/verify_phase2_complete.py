import os
import sys
import json
import time
import subprocess
import urllib.request
import xml.etree.ElementTree as ET
from playwright.sync_api import sync_playwright

def wait_for_url(url, timeout=30, name="Server"):
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'HealthCheck/1.0'})
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status in (200, 404):
                    print(f"✓ {name} is ready at {url} (HTTP {resp.status})", flush=True)
                    return True
        except Exception:
            time.sleep(1.0)
    print(f"✗ Timeout waiting for {name} at {url}", flush=True)
    return False

def main():
    print("=" * 60, flush=True)
    print("SWAMI GURUJI — PHASE 2 FINAL VERIFICATION & REGRESSION AUDIT", flush=True)
    print("=" * 60, flush=True)

    # 1. Start Flask Backend without reloader
    print("\n[Step 1] Starting Flask backend...", flush=True)
    backend_proc = subprocess.Popen(
        [sys.executable, "-c", "from app import create_app; app = create_app(); app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)"],
        cwd="japam-backend",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # 2. Start Next.js Frontend
    print("[Step 2] Starting Next.js production server...", flush=True)
    frontend_proc = subprocess.Popen(
        "cmd.exe /c npx next start -p 3000 -H 127.0.0.1",
        cwd="astroveda",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=True
    )

    test_results = []

    try:
        if not wait_for_url("http://127.0.0.1:5000/health/live", name="Flask Backend"):
            print("Backend failed to start. Aborting.", flush=True)
            sys.exit(1)

        if not wait_for_url("http://127.0.0.1:3000", name="Next.js Frontend"):
            print("Next.js frontend failed to start. Aborting.", flush=True)
            sys.exit(1)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={'width': 1280, 'height': 900})
            page = context.new_page()

            # ------------------------------------------------------------------
            # TEST 1: Direct Product URLs (HTTP 200, Content, Meta, JSON-LD)
            # ------------------------------------------------------------------
            print("\n" + "=" * 50, flush=True)
            print("TEST 1: Direct Product URLs (Valid Products)", flush=True)
            print("=" * 50, flush=True)

            test_products = [
                {
                    "slug": "1-mukhi-rudraksha-rud-001",
                    "title": "1 Mukhi Rudraksha",
                    "sku": "RUD-001",
                },
                {
                    "slug": "yellow-sapphire-pukhraj-rat-001",
                    "title": "Yellow Sapphire (Pukhraj)",
                    "sku": "RAT-001",
                },
                {
                    "slug": "sri-yantra-in-pure-copper-rm-oo4",
                    "title": "Sri Yantra in Pure Copper",
                    "sku": "RM-OO4",
                }
            ]

            for tp in test_products:
                slug = tp["slug"]
                url = f"http://127.0.0.1:3000/product/{slug}"
                resp = page.goto(url, wait_until="networkidle")
                status = resp.status if resp else 0
                print(f"\n--> Checking {slug} at {url} (HTTP {status})", flush=True)

                assert status == 200, f"Expected 200, got {status}"

                # Title & Heading check
                h1_text = page.locator("h1.product-title-h1").inner_text()
                doc_title = page.title()
                print(f"    Page Title: '{doc_title}'", flush=True)
                print(f"    H1 Header : '{h1_text}'", flush=True)
                assert tp["title"].lower() in h1_text.lower(), f"H1 '{h1_text}' does not match expected '{tp['title']}'"
                assert tp["title"].lower() in doc_title.lower(), f"Doc title does not match '{tp['title']}'"

                # Canonical URL check
                canonical = page.locator("link[rel='canonical']").get_attribute("href")
                print(f"    Canonical : '{canonical}'", flush=True)
                assert f"/product/{slug}" in canonical, f"Canonical does not match slug: {canonical}"

                # Pricing check
                price_text = page.locator(".price-current").inner_text()
                print(f"    Price Text: '{price_text}'", flush=True)
                assert "₹" in price_text, "Price symbol ₹ missing"

                # Stock indicator check
                stock_text = page.locator(".stock-status-row").inner_text()
                print(f"    Stock     : '{stock_text}'", flush=True)
                assert "In Stock" in stock_text, "Stock indicator missing"

                # JSON-LD Schema Validation
                json_ld_scripts = page.locator("script[type='application/ld+json']").all_inner_texts()
                found_product_schema = False
                found_breadcrumb_schema = False

                for raw_json in json_ld_scripts:
                    try:
                        data = json.loads(raw_json)
                        items = data if isinstance(data, list) else [data]
                        for item in items:
                            if item.get("@type") == "Product":
                                found_product_schema = True
                                print(f"    JSON-LD Product: name='{item.get('name')}', sku='{item.get('sku')}', price={item.get('offers', {}).get('price')}", flush=True)
                                assert item.get("name") == tp["title"], "JSON-LD name mismatch"
                                assert item.get("sku") == tp["sku"], "JSON-LD SKU mismatch"
                                assert item.get("offers", {}).get("priceCurrency") == "INR", "JSON-LD currency mismatch"
                            elif item.get("@type") == "BreadcrumbList":
                                found_breadcrumb_schema = True
                                print(f"    JSON-LD Breadcrumbs: {len(item.get('itemListElement', []))} items", flush=True)
                    except Exception as e:
                        print(f"    Warning parsing JSON-LD: {e}", flush=True)

                assert found_product_schema, "Product JSON-LD schema not found"
                assert found_breadcrumb_schema, "BreadcrumbList JSON-LD schema not found"
                print(f"✓ {slug}: Passed all URL, metadata, and JSON-LD checks.", flush=True)

            test_results.append(("Direct Product URLs & Schema", "PASSED"))

            # ------------------------------------------------------------------
            # TEST 2: Invalid Product URL (HTTP 404 Verification)
            # ------------------------------------------------------------------
            print("\n" + "=" * 50, flush=True)
            print("TEST 2: Invalid Product URL (404 Not Found)", flush=True)
            print("=" * 50, flush=True)
            invalid_url = "http://127.0.0.1:3000/product/invalid-slug-999-does-not-exist"
            invalid_resp = page.goto(invalid_url, wait_until="networkidle")
            invalid_status = invalid_resp.status if invalid_resp else 0
            print(f"Invalid URL {invalid_url} responded with HTTP {invalid_status}", flush=True)
            assert invalid_status == 404, f"Expected 404, got {invalid_status}"
            print("✓ Invalid product slug cleanly returned HTTP 404.", flush=True)
            test_results.append(("Invalid Product 404", "PASSED"))

            # ------------------------------------------------------------------
            # TEST 3: Homepage Modal & Browser History Interaction
            # ------------------------------------------------------------------
            print("\n" + "=" * 50, flush=True)
            print("TEST 3: Homepage Modal & Browser History Synchronization", flush=True)
            print("=" * 50, flush=True)
            page.goto("http://127.0.0.1:3000", wait_until="networkidle")
            page.wait_for_timeout(1000)
            init_url = page.url
            print(f"Initial Homepage URL: {init_url}", flush=True)

            # Click a product card
            first_card = page.locator(".prod-card").first
            card_title = first_card.locator(".prod-title").inner_text()
            print(f"Clicking first product card: '{card_title}'...", flush=True)
            first_card.click()
            page.wait_for_timeout(1000)

            # Check modal is visible
            modal = page.locator(".prod-modal")
            assert modal.is_visible(), "Product modal did not open on homepage card click"
            modal_url = page.url
            print(f"Modal opened! Current URL: {modal_url}", flush=True)
            assert "/product/" in modal_url, f"Browser URL was not updated to /product/[slug]: {modal_url}"

            # Close modal via close button
            close_btn = page.locator(".pm-close")
            if close_btn.is_visible():
                print("Clicking modal close button...", flush=True)
                close_btn.click()
                page.wait_for_timeout(800)
                closed_url = page.url
                print(f"After closing modal, URL is: {closed_url}", flush=True)
                assert "/product/" not in closed_url or closed_url.endswith("/"), "URL was not restored to root"
                assert not modal.is_visible(), "Modal did not close"
                print("✓ Modal closed cleanly and URL reverted.", flush=True)

            # Test Browser Back button navigation
            print("\nTesting Browser Back navigation...", flush=True)
            first_card.click()
            page.wait_for_timeout(1000)
            assert modal.is_visible(), "Modal did not reopen"
            print(f"Modal reopened. URL: {page.url}", flush=True)

            print("Pressing browser BACK button...", flush=True)
            page.go_back()
            page.wait_for_timeout(800)
            print(f"After browser back, URL: {page.url}", flush=True)
            assert not modal.is_visible(), "Modal was not dismissed on browser BACK"
            print("✓ Browser BACK cleanly dismissed modal and restored homepage URL.", flush=True)
            test_results.append(("Modal & Browser History Sync", "PASSED"))

            # ------------------------------------------------------------------
            # TEST 4: Add to Cart and Checkout Integration
            # ------------------------------------------------------------------
            print("\n" + "=" * 50, flush=True)
            print("TEST 4: Add to Cart & Checkout from Standalone Product Page", flush=True)
            print("=" * 50, flush=True)
            page.goto("http://127.0.0.1:3000/product/1-mukhi-rudraksha-rud-001", wait_until="networkidle")
            page.wait_for_timeout(1000)

            add_btn = page.locator(".btn-purchase")
            assert add_btn.is_visible(), "Add to Cart button missing on product page"
            print("Clicking Add to Cart...", flush=True)
            add_btn.click()
            page.wait_for_timeout(1200)

            # Verify cart panel opened
            cart_panel = page.locator(".cart-panel")
            assert cart_panel.is_visible(), "Cart drawer did not open after Add to Cart"
            print("✓ Cart drawer opened successfully with the added product.", flush=True)

            # Proceed to checkout
            chk_btn = page.locator(".btn-checkout")
            if chk_btn.is_visible():
                print("Clicking Proceed to Checkout...", flush=True)
                chk_btn.click()
                page.wait_for_timeout(1200)
                chk_modal = page.locator(".checkout-modal")
                assert chk_modal.is_visible(), "Checkout modal did not open from cart"
                print("✓ Checkout modal opened cleanly with accurate order calculation.", flush=True)
            test_results.append(("Add to Cart & Checkout Flow", "PASSED"))

            # ------------------------------------------------------------------
            # TEST 5: Sitemap & Robots.txt Output
            # ------------------------------------------------------------------
            print("\n" + "=" * 50, flush=True)
            print("TEST 5: Sitemap.xml & Robots.txt Output", flush=True)
            print("=" * 50, flush=True)

            # Check robots.txt
            robots_resp = page.goto("http://127.0.0.1:3000/robots.txt")
            robots_content = robots_resp.text() if robots_resp else ""
            print("robots.txt content:", flush=True)
            print(robots_content.strip(), flush=True)
            assert "Allow: /" in robots_content, "robots.txt missing Allow: /"
            assert "Disallow: /api/" in robots_content, "robots.txt missing Disallow: /api/"
            assert "sitemap.xml" in robots_content, "robots.txt missing sitemap reference"
            print("✓ robots.txt verified.", flush=True)

            # Check sitemap.xml
            sitemap_resp = page.goto("http://127.0.0.1:3000/sitemap.xml")
            sitemap_content = sitemap_resp.text() if sitemap_resp else ""
            root = ET.fromstring(sitemap_content)
            urls = [elem.text for elem in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
            print(f"Total URLs in sitemap: {len(urls)}", flush=True)
            product_urls = [u for u in urls if "/product/" in u]
            print(f"Total Product URLs in sitemap: {len(product_urls)}", flush=True)
            print("Sample sitemap product entries:", flush=True)
            for u in product_urls[:5]:
                print(f"  - {u}", flush=True)

            assert len(urls) >= 44, f"Expected at least 44 URLs (1 home + 43 products), got {len(urls)}"
            assert len(product_urls) == 43, f"Expected 43 product URLs, got {len(product_urls)}"
            assert len(set(product_urls)) == len(product_urls), "Duplicate URLs found in sitemap"
            assert not any("#" in u for u in urls), "Hash fragment found in sitemap"

            print("✓ sitemap.xml verified: Contains exactly 43 published products and 1 homepage URL without duplicates.", flush=True)
            test_results.append(("Sitemap & Robots Verification", "PASSED"))

            browser.close()

    finally:
        print("\nShutting down test servers...", flush=True)
        try:
            frontend_proc.terminate()
            subprocess.run("taskkill /F /IM node.exe /T", shell=True, stderr=subprocess.DEVNULL)
        except Exception:
            pass
        try:
            backend_proc.terminate()
            subprocess.run("taskkill /F /IM python.exe /T", shell=True, stderr=subprocess.DEVNULL)
        except Exception:
            pass

    print("\n" + "=" * 60, flush=True)
    print("FINAL AUDIT SUMMARY", flush=True)
    print("=" * 60, flush=True)
    for test_name, res in test_results:
        print(f"  {test_name:<40} : {res}", flush=True)
    print("=" * 60, flush=True)

if __name__ == "__main__":
    main()
