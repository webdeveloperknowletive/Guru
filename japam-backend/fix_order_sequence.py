import sqlite3
import os
import re

base_dir = r"d:\Downloads\V2 (3)\V2 (2)\V2"
db_paths = [
    os.path.join(base_dir, "japam-backend", "instance", "japam_admin.db"),
    os.path.join(base_dir, "japam-backend", "japam_admin.db")
]

for db_path in db_paths:
    if not os.path.exists(db_path):
        continue
    print(f"\n--- Checking DB: {db_path} ---")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Find highest numeric sequence currently in DB
    cur.execute("SELECT id, order_number FROM orders ORDER BY id ASC")
    all_orders = cur.fetchall()

    max_num = 1000
    for oid, onum in all_orders:
        if onum and not onum.startswith("#ORD-"):
            m = re.search(r'ORD(\d+)', onum, re.IGNORECASE)
            if m:
                val = int(m.group(1))
                if val > max_num:
                    max_num = val

    print(f"Base highest sequential order number: #ORD{max_num}")

    # Now find any non-sequential ORD- orders and assign them sequential numbers
    cur.execute("SELECT id, order_number, customer_name, placed_at FROM orders WHERE order_number LIKE '%ORD-%' ORDER BY id ASC")
    ord_dash_orders = cur.fetchall()

    next_seq = max_num
    for oid, old_onum, cname, placed in ord_dash_orders:
        next_seq += 1
        new_onum = f"#ORD{next_seq}"
        print(f"Migrating order ID {oid} ({cname}): {old_onum} -> {new_onum}")
        cur.execute("UPDATE orders SET order_number = ? WHERE id = ?", (new_onum, oid))
        
        # Also update any audit log referencing old_onum
        cur.execute("UPDATE audit_logs SET details = REPLACE(details, ?, ?) WHERE details LIKE ?", (old_onum, new_onum, f"%{old_onum}%"))

    conn.commit()

    # Display top 10 recent orders to confirm
    cur.execute("SELECT id, order_number, customer_name, total_amount, placed_at FROM orders ORDER BY id DESC LIMIT 10")
    print("Latest 10 orders:")
    for r in cur.fetchall():
        print(" ", r)

    conn.close()

print("\nSequence migration completed successfully.")
