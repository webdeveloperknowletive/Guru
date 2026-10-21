import pytest
import json
from decimal import Decimal
from urllib.parse import quote
from app.extensions import db
from app.models.commerce import Product, Order


def test_checkout_idempotency_and_access_token(client, app):
    """Test that checkout is idempotent and generates a high-entropy access_token for IDOR protection."""
    prod = Product.query.first()
    stock_before = prod.stock_quantity

    idempotency_key = "idemp_test_key_12345678"
    checkout_payload = {
        "customer_name": "Rohan Deshmukh",
        "customer_email": "rohan@example.com",
        "customer_phone": "+91 99887 76655",
        "shipping_address": "Flat 402, Shiv Shanti Apts, Pune",
        "payment_method": "Razorpay",
        "idempotency_key": idempotency_key,
        "items": [
            {
                "product_id": prod.id,
                "quantity": 1,
            }
        ]
    }

    # 1. First checkout attempt
    res1 = client.post("/api/v1/orders/checkout", json=checkout_payload)
    assert res1.status_code == 201
    data1 = res1.get_json()
    assert "order_number" in data1
    assert "access_token" in data1
    order_num = data1["order_number"]
    token = data1["access_token"]
    assert len(token) > 20

    # 2. Duplicate checkout attempt with identical idempotency key -> returns existing order
    res2 = client.post("/api/v1/orders/checkout", json=checkout_payload)
    assert res2.status_code == 200
    data2 = res2.get_json()
    assert data2["order_number"] == order_num
    assert data2["access_token"] == token

    # Check stock was only decremented once
    db.session.refresh(prod)
    assert prod.stock_quantity == stock_before - 1

    # 3. Access order with valid access_token via X-Order-Token header -> 200 OK
    encoded_ord = quote(order_num, safe="")
    res3 = client.get(f"/api/v1/orders/{encoded_ord}", headers={"X-Order-Token": token})
    assert res3.status_code == 200
    assert res3.get_json()["order_number"] == order_num

    # 4. Access order with valid access_token via ?token= query param -> 200 OK
    res4 = client.get(f"/api/v1/orders/{encoded_ord}?token={token}")
    assert res4.status_code == 200

    # 5. Attacker tries to view order using only victim's email (IDOR attempt without token) -> 403 Forbidden
    res5 = client.get(f"/api/v1/orders/{encoded_ord}?email=rohan@example.com")
    assert res5.status_code == 403
    assert "not authorized" in res5.get_json()["error"].lower()


def test_cart_calculate_endpoint(client, app):
    """Test server-side cart calculate endpoint validates price, stock, and applies GST/shipping."""
    prod = Product.query.first()
    res = client.post("/api/v1/cart/calculate", json={
        "items": [
            {"product_id": prod.id, "quantity": 1}
        ]
    })
    assert res.status_code == 200
    data = res.get_json()
    assert "subtotal" in data
    assert "tax_amount" in data
    assert "shipping_amount" in data
    assert "total_amount" in data
    assert data["subtotal"] == float(prod.price)
    expected_tax = float((Decimal(str(data["subtotal"])) * Decimal("0.03")).quantize(Decimal("0.01")))
    assert data["tax_amount"] == expected_tax


def test_cart_calculate_invalid_quantity(client, app):
    """Test that zero or negative quantity is rejected with 400."""
    prod = Product.query.first()
    res = client.post("/api/v1/cart/calculate", json={
        "items": [
            {"product_id": prod.id, "quantity": 0}
        ]
    })
    assert res.status_code == 400
    assert "greater than zero" in res.get_json()["error"].lower()
