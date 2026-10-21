def test_api_health_live(client):
    res = client.get("/health/live")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["service"] == "japam-admin"


def test_api_health_ready(client):
    res = client.get("/health/ready")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ready"
    assert data["checks"]["database"] is True


def test_api_auth_token_issuance(client):
    res = client.post("/api/v1/auth/token", json={
        "email": "super@japam.in",
        "password": "AdminPass123!"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "Bearer"


def test_api_catalog_products(client):
    res = client.get("/api/v1/catalog/products")
    assert res.status_code == 200
    data = res.get_json()
    assert "products" in data
    assert data["count"] >= 1
    assert data["products"][0]["sku"] == "RM-001"


def test_api_auth_token_refresh(client):
    """Test refreshing access token using refresh token."""
    login_res = client.post("/api/v1/auth/token", json={
        "email": "super@japam.in",
        "password": "AdminPass123!"
    })
    tokens = login_res.get_json()
    refresh_token = tokens["refresh_token"]

    refresh_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_res.status_code == 200
    new_tokens = refresh_res.get_json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens


def test_api_product_detail_and_review(client):
    """Test fetching product by slug and submitting customer review."""
    res = client.get("/api/v1/catalog/products/5-mukhi-rudraksha-rm-001")
    assert res.status_code == 200
    prod = res.get_json()
    assert prod["sku"] == "RM-001"
    assert prod["is_in_stock"] is True

    # Submit review
    review_res = client.post(
        "/api/v1/catalog/products/5-mukhi-rudraksha-rm-001/reviews",
        json={
            "customer_name": "Devotee Rajesh",
            "customer_email": "rajesh@japam.org",
            "rating": 5,
            "comment": "Authentic and energized Rudraksha.",
        }
    )
    assert review_res.status_code == 201
    assert review_res.get_json()["is_approved"] is False


def test_api_contact_enquiry(client):
    """Test external frontend submitting contact enquiry."""
    res = client.post("/api/v1/contact", json={
        "name": "Devotee Sharma",
        "email": "sharma@vedic.org",
        "subject": "Gemstone Inquiry",
        "message": "Please advise on Blue Sapphire suitability."
    })
    assert res.status_code == 201
    assert res.get_json()["status"] == "open"


def test_api_cors_allowed_origin(client):
    """Test CORS headers returned for configured frontend origin."""
    res = client.get("/api/v1/catalog/categories", headers={"Origin": "http://localhost:3000"})
    assert res.status_code == 200
    assert res.headers.get("Access-Control-Allow-Origin") == "http://localhost:3000"
    assert res.headers.get("Access-Control-Allow-Credentials") == "true"


def test_root_redirect_to_admin(client):
    """Test that visiting / redirects to /admin."""
    res = client.get("/", follow_redirects=False)
    assert res.status_code == 302
    assert "/admin" in res.headers.get("Location")
