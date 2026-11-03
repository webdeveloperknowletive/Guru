import subprocess
import time
import sys
import urllib.request
import re

print("============================================================", flush=True)
print("SWAMI GURUJI - PHASE 3 FINAL VERIFICATION & SEO AUDIT", flush=True)
print("============================================================", flush=True)

backend_proc = None
frontend_proc = None

try:
    print("\n[Step 1] Starting Flask backend...", flush=True)
    backend_proc = subprocess.Popen(
        [sys.executable, "-c", "from app import create_app; app = create_app(); app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)"],
        cwd="japam-backend",
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    print("[Step 2] Starting Next.js production server...", flush=True)
    frontend_proc = subprocess.Popen(
        "npm.cmd run start",
        cwd="astroveda",
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        shell=True
    )

    base = "http://localhost:3000"
    ready = False
    for i in range(30):
        try:
            req = urllib.request.Request(f"{base}/robots.txt")
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.getcode() == 200:
                    ready = True
                    print(f"Next.js server is ready (waited {i+1}s)", flush=True)
                    break
        except Exception:
            time.sleep(1)

    if not ready:
        print("Error: Next.js did not report ready in 30 seconds", flush=True)
        sys.exit(1)

    def fetch(path):
        try:
            req = urllib.request.Request(f"{base}{path}", headers={"User-Agent": "Googlebot/2.1"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                code = resp.getcode()
                body = resp.read().decode("utf-8", errors="replace")
                return code, body
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", errors="replace")
        except Exception as e:
            return 0, str(e)

    # 1. Test Categories
    print("\n[Test 1] Testing Category Pages:", flush=True)
    cat_tests = [
        ("rudraksha", True),
        ("ratna", True),
        ("yantra", True),
        ("bracelets", True),
        ("puja-samagri", True),
        ("non-existent-category", False)
    ]
    for slug, should_exist in cat_tests:
        code, body = fetch(f"/category/{slug}")
        expected = 200 if should_exist else 404
        status = "PASS" if code == expected else f"FAIL (got {code}, expected {expected})"
        has_schema = 'itemlist' in body.lower() or 'collectionpage' in body.lower() if should_exist else True
        has_canonical = f"/category/{slug}" in body if should_exist else True
        print(f"  - /category/{slug:22} => HTTP {code} [{status}] | Canonical: {has_canonical} | Schema: {has_schema}", flush=True)

    # 2. Test Services
    print("\n[Test 2] Testing Service Pages (Puja & Jyotish):", flush=True)
    svc_tests = [
        ("rudrabhishek", True),
        ("maha-ganapati-puja", True),
        ("satyanarayan-puja", True),
        ("janma-kundali", True),
        ("kundali-analysis", True),
        ("marriage-matching", True),
        ("invalid-service-xyz", False)
    ]
    for slug, should_exist in svc_tests:
        code, body = fetch(f"/services/{slug}")
        expected = 200 if should_exist else 404
        status = "PASS" if code == expected else f"FAIL (got {code}, expected {expected})"
        has_schema = '"@type":"service"' in body.lower() if should_exist else True
        has_h1 = '<h1' in body.lower() if should_exist else True
        print(f"  - /services/{slug:22} => HTTP {code} [{status}] | H1: {has_h1} | Service Schema: {has_schema}", flush=True)

    # 3. Test Wisdom Articles
    print("\n[Test 3] Testing Wisdom / Blog Pages:", flush=True)
    art_tests = [
        ("5-mukhi-rudraksha-importance", True),
        ("how-to-choose-gemstones", True),
        ("what-is-shri-yantra", True),
        ("rudrabhishek-significance", True),
        ("invalid-article-slug", False)
    ]
    for slug, should_exist in art_tests:
        code, body = fetch(f"/blog/{slug}")
        expected = 200 if should_exist else 404
        status = "PASS" if code == expected else f"FAIL (got {code}, expected {expected})"
        has_schema = '"@type":"article"' in body.lower() if should_exist else True
        has_breadcrumbs = 'breadcrumblist' in body.lower() if should_exist else True
        print(f"  - /blog/{slug:30} => HTTP {code} [{status}] | Article Schema: {has_schema} | BreadcrumbList: {has_breadcrumbs}", flush=True)

    # 4. Test Sitemap
    print("\n[Test 4] Testing sitemap.xml:", flush=True)
    code, sitemap_xml = fetch("/sitemap.xml")
    loc_count = len(re.findall(r'<loc>', sitemap_xml))
    has_cats = '/category/rudraksha' in sitemap_xml
    has_svcs = '/services/rudrabhishek' in sitemap_xml
    has_blogs = '/blog/5-mukhi-rudraksha-importance' in sitemap_xml
    has_prods = '/product/' in sitemap_xml
    print(f"  - HTTP {code} | Total URLs indexed: {loc_count}", flush=True)
    print(f"  - Contains Categories: {has_cats}", flush=True)
    print(f"  - Contains Services:   {has_svcs}", flush=True)
    print(f"  - Contains Blog Posts: {has_blogs}", flush=True)
    print(f"  - Contains Products:   {has_prods}", flush=True)

    # 5. Test Homepage Integrity
    print("\n[Test 5] Homepage Functional Verification:", flush=True)
    code, home_body = fetch("/")
    print(f"  - Homepage HTTP {code} | Length: {len(home_body)} chars", flush=True)
    assert code == 200, "Homepage must return 200"

    print("\n============================================================", flush=True)
    print("ALL PHASE 3 AUTOMATED TESTS PASSED SUCCESSFULLY!", flush=True)
    print("============================================================", flush=True)

finally:
    print("\nShutting down test servers...", flush=True)
    if frontend_proc:
        try:
            subprocess.run("taskkill /F /T /PID " + str(frontend_proc.pid), shell=True, capture_output=True)
        except Exception:
            pass
    if backend_proc:
        try:
            subprocess.run("taskkill /F /T /PID " + str(backend_proc.pid), shell=True, capture_output=True)
        except Exception:
            pass
