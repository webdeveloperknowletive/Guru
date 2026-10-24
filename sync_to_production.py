import os
import json
import sqlite3
import requests
from bs4 import BeautifulSoup

BASE_URL = 'https://admin.swaminagesh.knowletive.in'
FRONTEND_URL = 'https://swaminagesh.knowletive.in'
LOCAL_DB = r'd:\Downloads\V2 (3)\V2 (2)\V2\japam-backend\instance\japam_admin.db'
LOCAL_UPLOADS = r'd:\Downloads\V2 (3)\V2 (2)\V2\japam-backend\app\static'

print("=== STARTING FULL PRODUCTION SYNC ===")

# 1. Login to Deployed Admin
s = requests.Session()
login_res = s.post(f'{BASE_URL}/auth/login', data={
    'email': 'admin@japam.in',
    'password': 'Admin@12345'
}, allow_redirects=False)

if login_res.status_code != 302:
    print(f"[FAIL] Login failed: status {login_res.status_code}")
    exit(1)
print("[OK] Logged into deployed admin successfully")

# Get CSRF Token from products create page
create_page = s.get(f'{BASE_URL}/admin/commerce/products')
soup = BeautifulSoup(create_page.text, 'html.parser')
csrf_input = soup.find('input', {'name': 'csrf_token'})
csrf_token = csrf_input['value'] if csrf_input else ''
print("[OK] CSRF Token acquired:", csrf_token[:15] + "...")

# 2. Fetch deployed products
dep_res = s.get(f'{BASE_URL}/api/v1/catalog/products').json()
dep_prods = {p['sku']: p for p in dep_res.get('products', [])}
print(f"[OK] Deployed currently has {len(dep_prods)} products")

# 3. Read all local products from SQLite
conn = sqlite3.connect(LOCAL_DB)
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT * FROM products WHERE is_archived = 0 OR is_archived IS NULL")
local_products = cur.fetchall()
print(f"[OK] Local database has {len(local_products)} active products")

# Category mapping on deployed
cat_res = s.get(f'{BASE_URL}/api/v1/catalog/categories').json()
dep_cats = {c['slug']: c['id'] for c in cat_res.get('categories', [])}
cur.execute("SELECT id, slug FROM categories")
local_cat_id_to_slug = {row['id']: row['slug'] for row in cur.fetchall()}

created_count = 0
updated_count = 0

for p in local_products:
    sku = p['sku']
    name = p['name']
    cat_slug = local_cat_id_to_slug.get(p['category_id'], 'rudraksha')
    dep_cat_id = dep_cats.get(cat_slug, 1)
    
    # Resolve thumbnail / image file
    thumb_path = p['thumbnail'] or ''
    local_file_path = None
    if thumb_path.startswith('/static/'):
        rel_path = thumb_path[len('/static/'):].replace('/', os.sep)
        full_path = os.path.join(LOCAL_UPLOADS, rel_path)
        if os.path.exists(full_path):
            local_file_path = full_path

    # Check if product is missing on deployed
    if sku not in dep_prods:
        print(f"[CREATE] [{cat_slug}] {name} (SKU: {sku})...")
        form_data = {
            'csrf_token': csrf_token,
            'name': name,
            'sku': sku,
            'category_id': dep_cat_id,
            'price': str(p['price']),
            'compare_price': str(p['compare_price']) if p['compare_price'] else '',
            'stock_quantity': p['stock_quantity'] or 10,
            'low_stock_threshold': p['low_stock_threshold'] or 5,
            'certification_status': p['certification_status'] or 'certified',
            'publishing_status': 'published',
            'description': p['description'] or '',
            'display_rank': p['display_rank'] if p['display_rank'] else 999,
            'thumbnail': thumb_path,
        }
        
        # Add attributes
        if p['attributes']:
            try:
                attrs = json.loads(p['attributes']) if isinstance(p['attributes'], str) else p['attributes']
                if attrs.get('mukhi'): form_data['attr_mukhi'] = str(attrs['mukhi'])
                if attrs.get('origin'): form_data['attr_origin'] = str(attrs['origin'])
                if attrs.get('carat'): form_data['attr_carat'] = str(attrs['carat'])
                if attrs.get('metal'): form_data['attr_metal'] = str(attrs['metal'])
                if attrs.get('energized'): form_data['attr_energized'] = str(attrs['energized'])
            except Exception:
                pass

        files = {}
        file_handle = None
        if local_file_path:
            file_handle = open(local_file_path, 'rb')
            ext = os.path.splitext(local_file_path)[1].lower()
            mime = 'image/jpeg' if ext in ['.jpg', '.jpeg'] else 'image/png' if ext == '.png' else 'image/webp'
            files['thumbnail_file'] = (os.path.basename(local_file_path), file_handle, mime)

        try:
            res = s.post(f'{BASE_URL}/admin/commerce/products/create', data=form_data, files=files if files else None, allow_redirects=True)
            if res.status_code == 200:
                print(f"   [OK] Created successfully!")
                created_count += 1
            else:
                print(f"   [WARN] Create response status {res.status_code}")
        except Exception as e:
            print(f"   [ERROR] Error creating {sku}: {e}")
        finally:
            if file_handle:
                file_handle.close()
    else:
        # Product already exists on deployed - ensure rank and thumbnail are up to date
        dep_item = dep_prods[sku]
        dep_id = dep_item['id']
        local_rank = p['display_rank'] if p['display_rank'] else 999
        dep_rank = dep_item.get('display_rank') or dep_item.get('rank') or 999
        
        # If rank or thumbnail needs sync, send update
        needs_update = (local_rank != dep_rank) or (dep_item.get('thumbnail') == '/static/img/product-default.png' and thumb_path and thumb_path != '/static/img/product-default.png')
        if needs_update:
            print(f"[UPDATE] [{cat_slug}] {name} (ID: {dep_id}, SKU: {sku}, rank: {local_rank})...")
            form_data = {
                'csrf_token': csrf_token,
                'name': name,
                'category_id': dep_cat_id,
                'price': str(p['price']),
                'compare_price': str(p['compare_price']) if p['compare_price'] else '',
                'stock_quantity': p['stock_quantity'] or 10,
                'low_stock_threshold': p['low_stock_threshold'] or 5,
                'certification_status': p['certification_status'] or 'certified',
                'publishing_status': 'published',
                'description': p['description'] or '',
                'display_rank': local_rank,
                'thumbnail': thumb_path,
            }
            files = {}
            file_handle = None
            if local_file_path and dep_item.get('thumbnail') == '/static/img/product-default.png':
                file_handle = open(local_file_path, 'rb')
                ext = os.path.splitext(local_file_path)[1].lower()
                mime = 'image/jpeg' if ext in ['.jpg', '.jpeg'] else 'image/png' if ext == '.png' else 'image/webp'
                files['thumbnail_file'] = (os.path.basename(local_file_path), file_handle, mime)

            try:
                res = s.post(f'{BASE_URL}/admin/commerce/products/{dep_id}/edit', data=form_data, files=files if files else None, allow_redirects=True)
                if res.status_code == 200:
                    updated_count += 1
            except Exception as e:
                print(f"   [ERROR] Error updating {sku}: {e}")
            finally:
                if file_handle:
                    file_handle.close()

print(f"\n[OK] Product Sync Complete: {created_count} created, {updated_count} updated.")

# 4. Sync Categories
cur.execute("SELECT * FROM categories ORDER BY id ASC")
for c in cur.fetchall():
    cid = c['id']
    form_data = {
        'csrf_token': csrf_token,
        'name': c['name'],
        'icon': c['icon'] or 'box',
        'description': c['description'] or '',
    }
    if bool(c['is_active']):
        form_data['is_active'] = '1'
    s.post(f'{BASE_URL}/admin/commerce/categories/{cid}/edit', data=form_data, allow_redirects=True)
print("[OK] Categories synced.")

# 5. Sync Puja Services
cur.execute("SELECT * FROM puja_services ORDER BY id ASC")
for p in cur.fetchall():
    pid = p['id']
    is_active = bool(p['is_active'])
    form_data = {
        'csrf_token': csrf_token,
        'name': p['name'],
        'deity': p['deity'] or 'Vedic',
        'icon': p['icon'] or '🪔',
        'price': str(p['price']),
        'duration_minutes': p['duration_minutes'] or 60,
        'description': p['description'] or '',
        'is_online_available': 'on',
        'is_offline_available': 'on',
    }
    if is_active:
        form_data['is_active'] = '1'
    res = s.post(f'{BASE_URL}/admin/services/puja/{pid}/edit', data=form_data, allow_redirects=True)
    if res.status_code != 200:
        s.post(f'{BASE_URL}/admin/services/puja/create', data=form_data, allow_redirects=True)
print("[OK] Puja services synced.")

# 6. Archive products marked as archived locally
cur.execute("SELECT sku FROM products WHERE is_archived = 1 OR publishing_status = 'archived'")
for arch_row in cur.fetchall():
    ask_sku = arch_row['sku']
    if ask_sku in dep_prods:
        s.post(f"{BASE_URL}/admin/commerce/products/{dep_prods[ask_sku]['id']}/archive", data={'csrf_token': csrf_token})

# 7. Sync Guruji Profile
cur.execute("SELECT * FROM guruji_profile")
local_g_row = cur.fetchone()
if local_g_row:
    local_g = dict(local_g_row)
    g_vis = json.loads(local_g['visibility_settings']) if local_g.get('visibility_settings') else {}
    g_form = {
        'csrf_token': csrf_token,
        'full_title': local_g['full_title'],
        'spiritual_lineage': local_g['spiritual_lineage'],
        'bio': local_g['bio'],
        'secondary_bio': local_g['secondary_bio'] or '',
        'experience_years': local_g['experience_years'] or '3rd',
        'consultations_count': local_g['consultations_count'] or '20k',
        'pujas_count': local_g['pujas_count'] or '20k',
        'button_text': local_g.get('button_text') or 'Book Consultation →',
        'button_url': local_g.get('button_url') or '#jyotish',
        'darshan_timings': local_g['darshan_timings'],
        'ashram_address': local_g['ashram_address'],
        'contact_phone': local_g['contact_phone'],
        'contact_email': local_g['contact_email'],
        'profile_image': f"{BASE_URL}/static/uploads/guruji_697f7a4a_guruji_2e2921a4_ProfileImg.jpeg",
        'show_photo': 'on', 'show_lineage': 'on', 'show_bio': 'on', 'show_secondary_bio': 'on',
        'show_stats': 'on', 'show_experience': 'on', 'show_consultations': 'on', 'show_pujas': 'on',
        'show_cta_button': 'on', 'show_darshan': 'on', 'show_ashram': 'on', 'show_contact': 'on',
        'section_kicker': g_vis.get('section_kicker', 'About Guruji'),
        'experience_label': g_vis.get('experience_label', 'Generations of Vedic Heritage'),
        'consultations_label': g_vis.get('consultations_label', 'Consultations'),
        'pujas_label': g_vis.get('pujas_label', 'Serving Yajmans Worldwide'),
        'darshan_label': g_vis.get('darshan_label', 'Consultation Time:'),
        'address_label': g_vis.get('address_label', 'Office Address:'),
        'contact_label': g_vis.get('contact_label', 'Contact:'),
        'email_label': g_vis.get('email_label', 'Email:'),
    }
    s.post(f"{BASE_URL}/admin/content/guruji", data=g_form)
print("[OK] Guruji profile synced.")

# 8. Sync Homepage Sections Order
cur.execute("SELECT value FROM system_settings WHERE key='homepage_sections_order'")
row = cur.fetchone()
if row:
    local_sections = json.loads(row['value'])
    sec_res = s.post(
        f'{BASE_URL}/admin/content/sections/reorder',
        headers={'X-CSRFToken': csrf_token, 'Content-Type': 'application/json'},
        json={'sections': local_sections}
    )
    print("[OK] Sections reorder response:", sec_res.json().get('message'))

# 7. Final Verification
final_res = requests.get(f'{BASE_URL}/api/v1/catalog/products').json()
final_prods = final_res.get('products', [])
ratna_items = [p for p in final_prods if p.get('category_slug') == 'ratna']

print(f"\n[DONE] FULL VERIFICATION:")
print(f" - Total Products on Deployed: {len(final_prods)}")
print(f" - Ratna Gemstones on Deployed: {len(ratna_items)}")
for r in ratna_items:
    print(f"   * {r['name']} (SKU: {r['sku']}, Rank: {r.get('display_rank')})")
