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

products_data = [
    {
        "name": "Firoza Bracelet",
        "sku": "BRC-001",
        "slug": "firoza-turquoise-crystal-bracelet-brc-001",
        "category_id": 4,
        "price": 799.00,
        "compare_price": 999.00,
        "stock_quantity": 25,
        "low_stock_threshold": 5,
        "certification_status": "certified",
        "display_rank": 4,
        "publishing_status": "published",
        "is_archived": 0,
        "thumbnail": "/static/uploads/products/firoza_turquoise_bracelet.jpg",
        "images": json.dumps(["/static/uploads/products/firoza_turquoise_bracelet.jpg"]),
        "description": "Sacred natural Turquoise (Firoza) beads for mental serenity, communication clarity, protection, and throat chakra healing.",
        "attributes": json.dumps({"bead_size": "8mm", "stones": "Natural Turquoise (Firoza)", "chakra": "Vishuddha (Throat)"})
    },
    {
        "name": "Green Aventurine Bracelet",
        "sku": "BRC-AVE",
        "slug": "green-aventurine-gemstone-bracelet-brc-ave",
        "category_id": 4,
        "price": 1299.00,
        "compare_price": 1899.00,
        "stock_quantity": 25,
        "low_stock_threshold": 5,
        "certification_status": "certified",
        "display_rank": 8,
        "publishing_status": "published",
        "is_archived": 0,
        "thumbnail": "/static/uploads/products/green_aventurine_bracelet.jpg",
        "images": json.dumps(["/static/uploads/products/green_aventurine_bracelet.jpg"]),
        "description": "Natural Green Aventurine crystal beads. Stone of opportunity, good fortune, heart chakra balance, and emotional prosperity.",
        "attributes": json.dumps({"bead_size": "8mm", "stones": "Natural Green Aventurine", "chakra": "Anahata (Heart)"})
    },
    {
        "name": "Multicolor Gemstone Bracelet",
        "sku": "BRC-MLT",
        "slug": "multicolor-gemstone-navagraha-bracelet-brc-mlt",
        "category_id": 4,
        "price": 1899.00,
        "compare_price": 2799.00,
        "stock_quantity": 25,
        "low_stock_threshold": 5,
        "certification_status": "certified",
        "display_rank": 9,
        "publishing_status": "published",
        "is_archived": 0,
        "thumbnail": "/static/uploads/products/multicolor_gemstone_bracelet.png",
        "images": json.dumps(["/static/uploads/products/multicolor_gemstone_bracelet.png"]),
        "description": "Sacred 9-gemstone planetary combination with authentic natural crystals for holistic balance, aura fortification, and cosmic alignment.",
        "attributes": json.dumps({"bead_size": "8mm", "stones": "Multi-crystal Navagraha blend", "type": "Combination Bracelet"})
    },
    {
        "name": "Black Onyx Bracelet",
        "sku": "BRC-ONX",
        "slug": "black-onyx-protective-bracelet-brc-onx",
        "category_id": 4,
        "price": 1099.00,
        "compare_price": 1699.00,
        "stock_quantity": 25,
        "low_stock_threshold": 5,
        "certification_status": "certified",
        "display_rank": 10,
        "publishing_status": "published",
        "is_archived": 0,
        "thumbnail": "/static/uploads/products/black_onyx_bracelet.png",
        "images": json.dumps(["/static/uploads/products/black_onyx_bracelet.png"]),
        "description": "Polished natural Black Onyx round beads. Master grounding crystal that absorbs negative energies, builds self-discipline, and sharpens focus.",
        "attributes": json.dumps({"bead_size": "8mm", "stones": "Natural Black Onyx", "chakra": "Muladhara (Root)"})
    },
    {
        "name": "Lava Stone Bracelet",
        "sku": "BRC-LAV",
        "slug": "natural-lava-stone-grounding-bracelet-brc-lav",
        "category_id": 4,
        "price": 899.00,
        "compare_price": 1399.00,
        "stock_quantity": 25,
        "low_stock_threshold": 5,
        "certification_status": "certified",
        "display_rank": 11,
        "publishing_status": "published",
        "is_archived": 0,
        "thumbnail": "/static/uploads/products/lava_stone_bracelet.jpeg",
        "images": json.dumps(["/static/uploads/products/lava_stone_bracelet.jpeg"]),
        "description": "Authentic porous volcanic lava rock beads. Connects with Earth energy for grounding, emotional calmness, courage, and vitality.",
        "attributes": json.dumps({"bead_size": "8mm", "stones": "Natural Volcanic Lava Rock", "chakra": "Root Chakra"})
    },
    {
        "name": "Turquoise Stone Bracelet",
        "sku": "BRC-TRQ",
        "slug": "turquoise-healing-bead-bracelet-brc-trq",
        "category_id": 4,
        "price": 999.00,
        "compare_price": 1499.00,
        "stock_quantity": 25,
        "low_stock_threshold": 5,
        "certification_status": "certified",
        "display_rank": 12,
        "publishing_status": "published",
        "is_archived": 0,
        "thumbnail": "/static/uploads/products/turquoise_bracelet.jpg",
        "images": json.dumps(["/static/uploads/products/turquoise_bracelet.jpg"]),
        "description": "Natural vibrant turquoise stone beads for peace of mind, self-expression, friendship, and positive aura flow.",
        "attributes": json.dumps({"bead_size": "8mm", "stones": "Natural Turquoise", "chakra": "Throat Chakra"})
    }
]

for db_path in db_paths:
    if not os.path.exists(db_path):
        continue
    print(f"Processing DB: {db_path}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    for prod in products_data:
        cur.execute("SELECT id FROM products WHERE sku = ?", (prod["sku"],))
        row = cur.fetchone()
        if row:
            p_id = row[0]
            print(f"Updating product {prod['name']} (ID: {p_id})")
            cur.execute("""
                UPDATE products SET
                    name = ?, slug = ?, category_id = ?, price = ?, compare_price = ?,
                    stock_quantity = ?, low_stock_threshold = ?, certification_status = ?,
                    display_rank = ?, publishing_status = ?, is_archived = ?,
                    thumbnail = ?, images = ?, description = ?, attributes = ?, updated_at = ?
                WHERE id = ?
            """, (
                prod["name"], prod["slug"], prod["category_id"], prod["price"], prod["compare_price"],
                prod["stock_quantity"], prod["low_stock_threshold"], prod["certification_status"],
                prod["display_rank"], prod["publishing_status"], prod["is_archived"],
                prod["thumbnail"], prod["images"], prod["description"], prod["attributes"],
                now_str, p_id
            ))
        else:
            print(f"Inserting product {prod['name']}")
            cur.execute("""
                INSERT INTO products (
                    name, slug, sku, category_id, price, compare_price,
                    stock_quantity, low_stock_threshold, certification_status,
                    display_rank, publishing_status, is_archived,
                    thumbnail, images, description, attributes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                prod["name"], prod["slug"], prod["sku"], prod["category_id"], prod["price"], prod["compare_price"],
                prod["stock_quantity"], prod["low_stock_threshold"], prod["certification_status"],
                prod["display_rank"], prod["publishing_status"], prod["is_archived"],
                prod["thumbnail"], prod["images"], prod["description"], prod["attributes"],
                now_str, now_str
            ))
    conn.commit()
    conn.close()
print("All database updates completed successfully.")
