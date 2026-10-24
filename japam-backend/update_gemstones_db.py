import sqlite3
import os
import json
from datetime import datetime

base_dir = r"d:\Downloads\V2 (3)\V2 (2)\V2"
db_paths = [
    os.path.join(base_dir, "japam-backend", "instance", "japam_admin.db"),
    os.path.join(base_dir, "japam-backend", "japam_admin.db")
]

now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

# Existing products to update image
updates = [
    {
        "sku": "RAT-RUB",
        "name": "Manik · Ruby 3.5ct",
        "thumbnail": "/static/uploads/products/manik.jpeg",
        "images": json.dumps(["/static/uploads/products/manik.jpeg"]),
        "display_rank": 1
    },
    {
        "sku": "RAT-PRL",
        "display_rank": 2
    },
    {
        "sku": "RAT-COR",
        "name": "Moonga · Red Coral 7ct",
        "thumbnail": "/static/uploads/products/munga.jpeg",
        "images": json.dumps(["/static/uploads/products/munga.jpeg"]),
        "display_rank": 3
    },
    {
        "sku": "RAT-EME",
        "name": "Panna · Emerald 4.2ct",
        "thumbnail": "/static/uploads/products/panna.jpeg",
        "images": json.dumps(["/static/uploads/products/panna.jpeg"]),
        "display_rank": 4
    },
    {
        "sku": "RAT-001",
        "name": "Yellow Sapphire (Pukhraj)",
        "thumbnail": "/static/uploads/products/pushkaraj.jpeg",
        "images": json.dumps(["/static/uploads/products/pushkaraj.jpeg"]),
        "display_rank": 5
    },
    {
        "sku": "RAT-002",
        "name": "Natural Blue Sapphire (Neelam)",
        "thumbnail": "/static/uploads/products/nilam.jpeg",
        "images": json.dumps(["/static/uploads/products/nilam.jpeg"]),
        "display_rank": 7
    }
]

# New products to insert
new_products = [
    {
        "name": "Heera · Natural Diamond 0.75ct",
        "sku": "RAT-DIA",
        "slug": "heera-natural-diamond-0.75ct-rat-dia",
        "category_id": 2,
        "price": 24999.00,
        "compare_price": 35000.00,
        "stock_quantity": 8,
        "low_stock_threshold": 2,
        "certification_status": "certified",
        "display_rank": 6,
        "publishing_status": "published",
        "is_archived": 0,
        "thumbnail": "/static/uploads/products/diamond.jpeg",
        "images": json.dumps(["/static/uploads/products/diamond.jpeg"]),
        "description": "Natural certified brilliant-cut Diamond (Heera). Enhances beauty, luxury, creative genius, matrimonial harmony and Venus (Shukra) blessings.",
        "attributes": json.dumps({"carat": "0.75ct", "origin": "Natural Certified", "lab": "GIA Certified"})
    },
    {
        "name": "Gomed · Hessonite 5.25ct",
        "sku": "RAT-GOM",
        "slug": "gomed-hessonite-5.25ct-rat-gom",
        "category_id": 2,
        "price": 7499.00,
        "compare_price": 10500.00,
        "stock_quantity": 15,
        "low_stock_threshold": 3,
        "certification_status": "certified",
        "display_rank": 8,
        "publishing_status": "published",
        "is_archived": 0,
        "thumbnail": "/static/uploads/products/gomed.jpeg",
        "images": json.dumps(["/static/uploads/products/gomed.jpeg"]),
        "description": "Natural Ceylon Hessonite (Gomed), certified. For Rahu balance, clarity of intellect, victory over adversaries and removal of fear.",
        "attributes": json.dumps({"carat": "5.25ct", "origin": "Ceylon (Sri Lanka)", "lab": "IGI Certified"})
    },
    {
        "name": "Vaidurya · Cat's Eye 4.5ct",
        "sku": "RAT-VAI",
        "slug": "vaidurya-cats-eye-4.5ct-rat-vai",
        "category_id": 2,
        "price": 9999.00,
        "compare_price": 14000.00,
        "stock_quantity": 12,
        "low_stock_threshold": 3,
        "certification_status": "certified",
        "display_rank": 9,
        "publishing_status": "published",
        "is_archived": 0,
        "thumbnail": "/static/uploads/products/Vedurya.jpeg",
        "images": json.dumps(["/static/uploads/products/Vedurya.jpeg"]),
        "description": "Natural Chrysoberyl Cat's Eye (Vaidurya) with sharp chatoyancy, certified. For Ketu blessings, spiritual protection, intuition and overcoming sudden hurdles.",
        "attributes": json.dumps({"carat": "4.5ct", "origin": "Ceylon (Sri Lanka)", "lab": "IGI Certified"})
    }
]

for db_path in db_paths:
    if not os.path.exists(db_path):
        continue
    print(f"Updating database: {db_path}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Update existing products
    for u in updates:
        if "thumbnail" in u:
            cur.execute("""
                UPDATE products 
                SET thumbnail = ?, images = ?, display_rank = ?, updated_at = ?
                WHERE sku = ?
            """, (u["thumbnail"], u["images"], u["display_rank"], now_str, u["sku"]))
        else:
            cur.execute("""
                UPDATE products 
                SET display_rank = ?, updated_at = ?
                WHERE sku = ?
            """, (u["display_rank"], now_str, u["sku"]))
        print(f"  Updated {u['sku']}: rows affected = {cur.rowcount}")

    # Insert or update new products
    for np in new_products:
        cur.execute("SELECT id FROM products WHERE sku = ?", (np["sku"],))
        existing = cur.fetchone()
        if existing:
            cur.execute("""
                UPDATE products
                SET name = ?, slug = ?, category_id = ?, price = ?, compare_price = ?,
                    stock_quantity = ?, low_stock_threshold = ?, certification_status = ?,
                    display_rank = ?, publishing_status = ?, is_archived = ?, thumbnail = ?,
                    images = ?, description = ?, attributes = ?, updated_at = ?
                WHERE sku = ?
            """, (
                np["name"], np["slug"], np["category_id"], np["price"], np["compare_price"],
                np["stock_quantity"], np["low_stock_threshold"], np["certification_status"],
                np["display_rank"], np["publishing_status"], np["is_archived"], np["thumbnail"],
                np["images"], np["description"], np["attributes"], now_str, np["sku"]
            ))
            print(f"  Updated existing new product {np['sku']}")
        else:
            cur.execute("""
                INSERT INTO products (
                    name, sku, slug, category_id, price, compare_price,
                    stock_quantity, low_stock_threshold, certification_status,
                    display_rank, publishing_status, is_archived, thumbnail,
                    images, description, attributes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                np["name"], np["sku"], np["slug"], np["category_id"], np["price"], np["compare_price"],
                np["stock_quantity"], np["low_stock_threshold"], np["certification_status"],
                np["display_rank"], np["publishing_status"], np["is_archived"], np["thumbnail"],
                np["images"], np["description"], np["attributes"], now_str, now_str
            ))
            print(f"  Inserted new product {np['sku']} (ID: {cur.lastrowid})")

    conn.commit()
    conn.close()

print("All databases successfully updated!")
