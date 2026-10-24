import sqlite3
import os
import shutil
import json

db_path = r'd:\Downloads\V2 (3)\V2 (2)\V2\japam-backend\japam_admin.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT id, name, sku, category_id, price, compare_price, thumbnail FROM products WHERE name LIKE '%bracelet%'")
rows = cur.fetchall()
print("Existing bracelets in DB:")
for r in rows:
    print(r)

cur.execute("SELECT id, name, slug FROM categories WHERE slug LIKE '%bracelet%' OR name LIKE '%bracelet%'")
cat_rows = cur.fetchall()
print("\nBracelet category:", cat_rows)

conn.close()
