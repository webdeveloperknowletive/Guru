import pytest
from decimal import Decimal
from datetime import datetime, timezone
from urllib.parse import quote
from app.extensions import db
from app.models.commerce import Order, Product, OrderItem


def test_customer_ownership_view_protection(client, app):
    """Test that customer B cannot view customer A's order by tampering with order_number (HTTP 403)."""
    order_a = Order(
        order_number="#ORD-DEVA-001",
        customer_name="Devotee A",
        customer_email="devotee_a@japam.org",
        shipping_address="Varanasi Ashram",
        subtotal=Decimal("1500.00"),
        total_amount=Decimal("1545.00"),
        order_status="processing",
        payment_status="paid",
        placed_at=datetime.now(timezone.utc),
    )
    db.session.add(order_a)
    db.session.commit()

    encoded_ord = quote(order_a.order_number, safe="")

    # Devotee B attempts to view Devotee A's order -> 403 Forbidden
    res_b = client.get(f"/api/v1/orders/{encoded_ord}?email=devotee_b@japam.org")
    assert res_b.status_code == 403
    assert "not authorized" in res_b.get_json()["error"].lower()

    # Devotee A views their own order -> 200 OK
    res_a = client.get(f"/api/v1/orders/{encoded_ord}?email=devotee_a@japam.org")
    assert res_a.status_code == 200
    assert res_a.get_json()["shipping_address"] == "Varanasi Ashram"


def test_customer_ownership_cancel_protection(client, app):
    """Test that customer B cannot cancel customer A's order (HTTP 403)."""
    prod = Product.query.first()

    order_a = Order(
        order_number="#ORD-DEVA-002",
        customer_name="Devotee A",
        customer_email="devotee_a@japam.org",
        shipping_address="Haridwar",
        subtotal=Decimal("1500.00"),
        total_amount=Decimal("1545.00"),
        order_status="processing",
        payment_status="paid",
    )
    db.session.add(order_a)
    db.session.flush()

    item = OrderItem(
        order_id=order_a.id,
        product_id=prod.id,
        product_name=prod.name,
        sku=prod.sku,
        unit_price=prod.price,
        quantity=2,
        total_price=prod.price * 2,
    )
    db.session.add(item)
    db.session.commit()

    encoded_ord = quote(order_a.order_number, safe="")

    # Devotee B attempts to cancel order A -> 403 Forbidden
    res = client.post(f"/api/v1/orders/{encoded_ord}/cancel", json={"email": "devotee_b@japam.org"})
    assert res.status_code == 403
    assert "not authorized" in res.get_json()["error"].lower()

    # Verify order is still processing
    db.session.refresh(order_a)
    assert order_a.order_status == "processing"


def test_customer_ownership_return_protection(client, app):
    """Test that customer B cannot file a return on customer A's order (HTTP 403)."""
    order_a = Order(
        order_number="#ORD-DEVA-003",
        customer_name="Devotee A",
        customer_email="devotee_a@japam.org",
        shipping_address="Rishikesh",
        subtotal=Decimal("1500.00"),
        total_amount=Decimal("1545.00"),
        order_status="delivered",
        payment_status="paid",
    )
    db.session.add(order_a)
    db.session.commit()

    encoded_ord = quote(order_a.order_number, safe="")

    # Devotee B attempts return -> 403
    res = client.post(
        f"/api/v1/orders/{encoded_ord}/return",
        json={"email": "devotee_b@japam.org", "reason": "Malicious return attempt"}
    )
    assert res.status_code == 403
    assert "not authorized" in res.get_json()["error"].lower()


def test_customer_valid_cancellation_restocks_inventory(client, app):
    """Test that authorized owner can cancel pending order and inventory is restored."""
    prod = Product.query.first()
    stock_before = prod.stock_quantity

    order_a = Order(
        order_number="#ORD-DEVA-004",
        customer_name="Devotee A",
        customer_email="devotee_a@japam.org",
        shipping_address="Kashi",
        subtotal=Decimal("1500.00"),
        total_amount=Decimal("1545.00"),
        order_status="pending",
        payment_status="pending",
    )
    db.session.add(order_a)
    db.session.flush()

    item = OrderItem(
        order_id=order_a.id,
        product_id=prod.id,
        product_name=prod.name,
        sku=prod.sku,
        unit_price=prod.price,
        quantity=3,
        total_price=prod.price * 3,
    )
    db.session.add(item)
    db.session.commit()

    encoded_ord = quote(order_a.order_number, safe="")

    # Authorized Devotee A cancels their own order
    res = client.post(f"/api/v1/orders/{encoded_ord}/cancel", json={"email": "devotee_a@japam.org"})
    assert res.status_code == 200
    assert "cancelled successfully" in res.get_json()["message"]

    # Verify order status
    db.session.refresh(order_a)
    assert order_a.order_status == "cancelled"

    # Verify inventory was restored (+3)
    db.session.refresh(prod)
    assert prod.stock_quantity == stock_before + 3
