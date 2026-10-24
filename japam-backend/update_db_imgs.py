import sqlite3

for p in [r"d:\Downloads\V2 (3)\V2 (2)\V2\japam-backend\instance\japam_admin.db", r"d:\Downloads\V2 (3)\V2 (2)\V2\japam-backend\japam_admin.db"]:
    conn = sqlite3.connect(p)
    cur = conn.cursor()
    cur.execute("""
        UPDATE products SET 
            thumbnail = '/static/uploads/products/779af49d3c_Gemstone_bead_bracelet_on_podium_2K_20261020132128-clean.png',
            images = '["/static/uploads/products/779af49d3c_Gemstone_bead_bracelet_on_podium_2K_20261020132128-clean.png"]'
        WHERE sku = 'BRC-001'
    """)
    cur.execute("""
        UPDATE products SET
            thumbnail = '/static/uploads/products/firoza_turquoise_bracelet.jpg',
            images = '["/static/uploads/products/firoza_turquoise_bracelet.jpg"]'
        WHERE sku = 'BRC-TRQ'
    """)
    cur.execute("""
        UPDATE products SET
            thumbnail = '/static/uploads/products/multicolor_gemstone_bracelet.png',
            images = '["/static/uploads/products/multicolor_gemstone_bracelet.png"]'
        WHERE sku = 'BRC-MLT'
    """)
    conn.commit()
    conn.close()
    print("Updated DB:", p)
