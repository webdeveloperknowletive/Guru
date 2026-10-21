import pytest
from decimal import Decimal
from app.models.commerce import Product, Order, InventoryAdjustment
from app.models.user import AdminUser
from app.services.commerce_service import CommerceService


def test_inventory_adjustment(app):
    with app.app_context():
        admin = AdminUser.query.filter_by(email="super@japam.in").first()
        prod = Product.query.filter_by(sku="RM-001").first()
        initial_stock = prod.stock_quantity

        # Add 15 units
        CommerceService.adjust_inventory(prod.id, 15, "Restock Received", admin)
        assert prod.stock_quantity == initial_stock + 15

        # Check audit adjustment entry
        adj = InventoryAdjustment.query.filter_by(product_id=prod.id).order_by(InventoryAdjustment.id.desc()).first()
        assert adj.quantity_change == 15
        assert adj.previous_stock == initial_stock
        assert adj.new_stock == initial_stock + 15

        # Attempt to subtract more units than available should raise ValueError
        with pytest.raises(ValueError):
            CommerceService.adjust_inventory(prod.id, -1000, "Invalid Deduct", admin)


def test_order_status_and_refund(app):
    with app.app_context():
        admin = AdminUser.query.filter_by(email="super@japam.in").first()

        order = Order(
            order_number="#ORD-TEST-001",
            customer_name="Test Devotee",
            customer_email="devotee@test.in",
            total_amount=Decimal("1500.00"),
            order_status="pending",
            payment_status="paid",
        )
        app.extensions["sqlalchemy"].session.add(order)
        app.extensions["sqlalchemy"].session.commit()

        # Update order status to shipped
        CommerceService.update_order_status(order.id, "shipped", admin, "Dispatched via courier")
        assert order.order_status == "shipped"

        # Process refund
        txn = CommerceService.process_refund(order.id, Decimal("1500.00"), "Damaged item", admin)
        assert order.payment_status == "refunded"
        assert order.order_status == "cancelled"
        assert txn.status == "refunded"


def test_archive_filter_unarchive_lifecycle(client, app):
    """
    Test complete lifecycle:
    1. Archive an active product
    2. Verify public catalog and cart exclude it
    3. Filter by Active, Archived, and All
    4. Unarchive product and verify:
       - Record ID, images, stock, price, SKU are preserved (no duplicates)
       - Previous publishing state ('published') is restored
       - Audit log records admin actor and timestamp for both actions
    """
    with app.app_context():
        prod = Product.query.filter_by(sku="RM-001").first()
        prod_id = prod.id
        initial_price = prod.price
        initial_stock = prod.stock_quantity
        initial_sku = prod.sku

    # Log in as Commerce Manager
    client.post("/auth/login", data={"email": "comm@japam.in", "password": "CommPass123!"})

    # 1. Archive the product
    res_archive = client.post(f"/admin/commerce/products/{prod_id}/archive", follow_redirects=True)
    assert res_archive.status_code == 200

    with app.app_context():
        archived_prod = Product.query.get(prod_id)
        assert archived_prod.is_archived is True
        assert archived_prod.archived_at is not None
        assert archived_prod.previous_publishing_status == "published"
        assert archived_prod.publishing_status == "archived"

    # 2. Verify public catalog excludes archived product
    res_cat = client.get("/api/v1/catalog/products")
    assert res_cat.status_code == 200
    cat_prods = res_cat.get_json().get("products", [])
    assert not any(p["id"] == prod_id for p in cat_prods)

    # Verify cart calculation rejects archived product
    res_cart = client.post("/api/v1/cart/calculate", json={"items": [{"product_id": prod_id, "quantity": 1}]})
    assert res_cart.status_code == 400

    # 3. Test Active / Archived / All filters
    res_filter_active = client.get("/admin/commerce/products?archive_status=active")
    assert res_filter_active.status_code == 200
    assert b"RM-001" not in res_filter_active.data

    res_filter_archived = client.get("/admin/commerce/products?archive_status=archived")
    assert res_filter_archived.status_code == 200
    assert b"RM-001" in res_filter_archived.data
    assert b"Unarchive" in res_filter_archived.data

    res_filter_all = client.get("/admin/commerce/products?archive_status=all")
    assert res_filter_all.status_code == 200
    assert b"RM-001" in res_filter_all.data

    # 4. Unarchive the product
    res_unarchive = client.post(f"/admin/commerce/products/{prod_id}/unarchive", follow_redirects=True)
    assert res_unarchive.status_code == 200

    with app.app_context():
        from app.models.user import AuditLog
        restored_prod = Product.query.get(prod_id)
        # Verify no duplicate created; ID, price, stock, SKU intact
        assert restored_prod.id == prod_id
        assert restored_prod.sku == initial_sku
        assert restored_prod.price == initial_price
        assert restored_prod.stock_quantity == initial_stock
        assert restored_prod.is_archived is False
        assert restored_prod.archived_at is None
        # Restored to previous publication status
        assert restored_prod.publishing_status == "published"

        # Verify audit logs
        archive_log = AuditLog.query.filter_by(action="PRODUCT_ARCHIVE", entity_id=str(prod_id)).first()
        assert archive_log is not None
        assert archive_log.actor_email == "comm@japam.in"
        assert archive_log.created_at is not None

        unarchive_log = AuditLog.query.filter_by(action="PRODUCT_UNARCHIVE", entity_id=str(prod_id)).first()
        assert unarchive_log is not None
        assert unarchive_log.actor_email == "comm@japam.in"
        assert unarchive_log.created_at is not None


def test_unarchive_unknown_state_restores_as_draft(client, app):
    """
    Test restoring a product whose previous publication status is unknown or was already archived.
    It must be restored as 'draft'.
    """
    with app.app_context():
        from decimal import Decimal
        from app.models.commerce import Category
        cat = Category.query.first()
        prod = Product(
            name="Mystery Sacred Yantra",
            slug="mystery-sacred-yantra",
            sku="MYS-999",
            category_id=cat.id,
            price=Decimal("999.00"),
            stock_quantity=5,
            publishing_status="archived",
            is_archived=True,
            previous_publishing_status=None,  # unknown previous state
        )
        app.extensions["sqlalchemy"].session.add(prod)
        app.extensions["sqlalchemy"].session.commit()
        prod_id = prod.id

    client.post("/auth/login", data={"email": "super@japam.in", "password": "AdminPass123!"})
    res_unarchive = client.post(f"/admin/commerce/products/{prod_id}/unarchive", follow_redirects=True)
    assert res_unarchive.status_code == 200

    with app.app_context():
        restored = Product.query.get(prod_id)
        assert restored.is_archived is False
        assert restored.publishing_status == "draft"


def test_unauthorized_user_forbidden_on_archive_and_unarchive(client, app):
    """
    Ensure unauthorized users (e.g. read_only) cannot perform archive or unarchive.
    """
    with app.app_context():
        prod = Product.query.first()
        prod_id = prod.id

    # Log in as Read Only
    client.post("/auth/login", data={"email": "ro@japam.in", "password": "RoPass123!"})

    # Forbidden to archive (HTTP 403)
    res_archive = client.post(f"/admin/commerce/products/{prod_id}/archive")
    assert res_archive.status_code == 403

    # Forbidden to unarchive (HTTP 403)
    res_unarchive = client.post(f"/admin/commerce/products/{prod_id}/unarchive")
    assert res_unarchive.status_code == 403
