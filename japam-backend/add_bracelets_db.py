import os
import shutil
import sqlite3
import json
from datetime import datetime

base_dir = r"d:\Downloads\V2 (3)\V2 (2)\V2"
source_dir = r"D:\Downloads\GurujiImg\bracelet"
backend_upload_dir = os.path.join(base_dir, "japam-backend", "app", "static", "uploads", "products")
frontend_public_dir = os.path.join(base_dir, "astroveda", "public", "products")

os.makedirs(backend_upload_dir, exist_ok=True)
os.makedirs(frontend_public_dir, exist_ok=True)

# Image mapping
images_to_copy = {
    "love quartz.jpeg": "rose_quartz_bracelet.jpg",
    "Polished Black Tourmaline Bead Bracelet.png": "black_tourmaline_bracelet.png",
    "Clear Quartz Bracelet on Wooden Pedestal.png": "clear_quartz_bracelet.png",
    "Money magnet gemstone bracelet on wooden pedestal.png": "money_magnet_bracelet.png"
}

for src_name, dest_name in images_to_copy.items():
    src_path = os.path.join(source_dir, src_name)
    if os.path.exists(src_path):
        shutil.copy2(src_path, os.path.join(backend_upload_dir, dest_name))
        shutil.copy2(src_path, os.path.join(frontend_public_dir, dest_name))
        print(f"Copied {src_name} -> {dest_name}")
    else:
        print(f"Source not found: {src_path}")

db_paths = [
    os.path.join(base_dir, "japam-backend", "instance", "japam_admin.db"),
    os.path.join(base_dir, "japam-backend", "japam_admin.db")
]

now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

new_products = [
    {
        "name": "Rose Quartz Bracelet",
        "sku": "BRC-RSQ",
        "slug": "rose-quartz-love-healing-bracelet-brc-rsq",
        "category_id": 4, # Spiritual Bracelets
        "price": 1299.00,
        "compare_price": 1999.00,
        "stock_quantity": 25,
        "low_stock_threshold": 5,
        "certification_status": "certified",
        "display_rank": 2,
        "publishing_status": "published",
        "is_archived": 0,
        "thumbnail": "/static/uploads/products/rose_quartz_bracelet.jpg",
        "images": json.dumps(["/static/uploads/products/rose_quartz_bracelet.jpg"]),
        "description": "Natural authentic Rose Quartz crystal beads. Inspires unconditional love, emotional balance, inner peace, and heart chakra alignment.",
        "attributes": json.dumps({"bead_size": "8mm", "stones": "Natural Rose Quartz", "chakra": "Heart Chakra"})
    },
    {
        "name": "Black Tourmaline Bracelet",
        "sku": "BRC-TOU",
        "slug": "black-tourmaline-protection-bracelet-brc-tou",
        "category_id": 4,
        "price": 1499.00,
        "compare_price": 2200.00,
        "stock_quantity": 25,
        "low_stock_threshold": 5,
        "certification_status": "certified",
        "display_rank": 3,
        "publishing_status": "published",
        "is_archived": 0,
        "thumbnail": "/static/uploads/products/black_tourmaline_bracelet.png",
        "images": json.dumps(["/static/uploads/products/black_tourmaline_bracelet.png"]),
        "description": "Natural Black Tourmaline polished gemstone beads. Powerful aura protection, shielding against negative energies, grounding, and evil eye safety.",
        "attributes": json.dumps({"bead_size": "8mm", "stones": "Natural Black Tourmaline", "chakra": "Root Chakra"})
    },
    {
        "name": "Clear Quartz Bracelet",
        "sku": "BRC-SPH",
        "slug": "clear-quartz-sphatik-crystal-bracelet-brc-sph",
        "category_id": 4,
        "price": 1199.00,
        "compare_price": 1800.00,
        "stock_quantity": 25,
        "low_stock_threshold": 5,
        "certification_status": "certified",
        "display_rank": 5,
        "publishing_status": "published",
        "is_archived": 0,
        "thumbnail": "/static/uploads/products/clear_quartz_bracelet.png",
        "images": json.dumps(["/static/uploads/products/clear_quartz_bracelet.png"]),
        "description": "Pure natural Sphatik / Clear Quartz gemstone beads. Known as the Master Healer for clarity of thought, spiritual concentration, and positive vibration.",
        "attributes": json.dumps({"bead_size": "8mm", "stones": "Pure Clear Quartz (Sphatik)", "chakra": "Crown Chakra"})
    },
    {
        "name": "Money Magnet Gemstone Bracelet",
        "sku": "BRC-MMG",
        "slug": "money-magnet-wealth-combo-bracelet-brc-mmg",
        "category_id": 4,
        "price": 2499.00,
        "compare_price": 3500.00,
        "stock_quantity": 20,
        "low_stock_threshold": 5,
        "certification_status": "certified",
        "display_rank": 7,
        "publishing_status": "published",
        "is_archived": 0,
        "thumbnail": "/static/uploads/products/money_magnet_bracelet.png",
        "images": json.dumps(["/static/uploads/products/money_magnet_bracelet.png"]),
        "description": "Sacred synergistic combination of Pyrite, Green Aventurine, Tiger Eye, and Citrine crystals. Handcrafted to attract wealth, abundance, luck, and business opportunities.",
        "attributes": json.dumps({"bead_size": "8mm", "stones": "Pyrite, Green Aventurine, Tiger Eye, Citrine", "type": "Combination Bracelet"})
    }
]

for db_path in db_paths:
    if not os.path.exists(db_path):
        continue
    print(f"\nProcessing database: {db_path}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    for prod in new_products:
        cur.execute("SELECT id FROM products WHERE sku = ?", (prod["sku"],))
        existing = cur.fetchone()
        if existing:
            prod_id = existing[0]
            print(f"Updating existing product {prod['name']} (ID: {prod_id})")
            cur.execute("""
                UPDATE products SET 
                    name = ?, slug = ?, price = ?, compare_price = ?,
                    stock_quantity = ?, low_stock_threshold = ?, certification_status = ?,
                    display_rank = ?, publishing_status = ?, is_archived = ?,
                    thumbnail = ?, images = ?, description = ?, attributes = ?, updated_at = ?
                WHERE id = ?
            """, (
                prod["name"], prod["slug"], prod["price"], prod["compare_price"],
                prod["stock_quantity"], prod["low_stock_threshold"], prod["certification_status"],
                prod["display_rank"], prod["publishing_status"], prod["is_archived"],
                prod["thumbnail"], prod["images"], prod["description"], prod["attributes"],
                now_str, prod_id
            ))
        else:
            print(f"Inserting new product {prod['name']}")
            cur.execute("""
                INSERT INTO products (
                    name, slug, sku, category_id, price, compare_price,
                    stock_quantity, low_stock_threshold, certification_status,
                    display_rank, publishing_status, is_archived,
                    thumbnail, images, description, attributes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                prod["name"], prod["slug"], prod["sku"], prod["category_id"],
                prod["price"], prod["compare_price"], prod["stock_quantity"],
                prod["low_stock_threshold"], prod["certification_status"],
                prod["display_rank"], prod["publishing_status"], prod["is_archived"],
                prod["thumbnail"], prod["images"], prod["description"], prod["attributes"],
                now_str, now_str
            ))

    conn.commit()
    conn.close()
    print("Database updated successfully.")
