import pytest
from app.models.commerce import Product, Category, Customer
from app.models.service import PujaService, JyotishConsultation
from app.models.operations import Coupon, CustomerEnquiry
from app.models.content import Banner
from app.extensions import db


def test_content_api_endpoints(client):
    """Test public content API endpoints."""
    # Testimonials
    res = client.get("/api/v1/content/testimonials")
    assert res.status_code == 200
    data = res.get_json()
    assert "testimonials" in data

    # Articles
    res = client.get("/api/v1/content/articles")
    assert res.status_code == 200
    data = res.get_json()
    assert "articles" in data

    # Banners
    res = client.get("/api/v1/content/banners")
    assert res.status_code == 200
    data = res.get_json()
    assert "banners" in data

    # Guruji profile
    res = client.get("/api/v1/content/guruji")
    assert res.status_code == 200
    data = res.get_json()
    assert "name" in data or "bio" in data


def test_banner_crud(client, app):
    """Test full CRUD on promotional banners in admin."""
    # Log in as Super Admin
    client.post("/auth/login", data={"email": "super@japam.in", "password": "AdminPass123!"})

    # 1. Create
    res = client.post("/admin/content/banners/create", data={
        "title": "Diwali Special Blessings",
        "subtitle": "Sacred Mahalakshmi Yantras",
        "position": "hero",
        "button_text": "Claim Blessings",
        "link_url": "#shop",
        "sort_order": "1",
        "is_active": "1",
    }, follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        b = Banner.query.filter_by(title="Diwali Special Blessings").first()
        assert b is not None
        assert b.subtitle == "Sacred Mahalakshmi Yantras"
        banner_id = b.id

    # 2. Update
    res = client.post(f"/admin/content/banners/{banner_id}/edit", data={
        "title": "Diwali Special Blessings 2026",
        "subtitle": "Updated Subtitle",
        "position": "hero",
        "button_text": "Shop Now",
        "link_url": "#shop",
        "sort_order": "2",
        "is_active": "1",
    }, follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        b = db.session.get(Banner, banner_id)
        assert b.title == "Diwali Special Blessings 2026"
        assert b.sort_order == 2

    # 3. Delete
    res = client.post(f"/admin/content/banners/{banner_id}/delete", follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        b = db.session.get(Banner, banner_id)
        assert b is None


def test_puja_service_crud(client, app):
    """Test full CRUD on Puja Services."""
    client.post("/auth/login", data={"email": "super@japam.in", "password": "AdminPass123!"})

    # 1. Create
    res = client.post("/admin/services/puja/create", data={
        "name": "Navchandi Homa",
        "slug": "navchandi-homa",
        "deity": "Goddess Durga",
        "base_price": "7500.00",
        "duration_minutes": "180",
        "samagri_included": "1",
        "icon": "🔱",
        "description": "Powerful Navchandi Homa for victory and removal of negative energies.",
    }, follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        p = PujaService.query.filter_by(slug="navchandi-homa").first()
        assert p is not None
        assert p.icon == "🔱"
        puja_id = p.id

    # 2. Update
    res = client.post(f"/admin/services/puja/{puja_id}/edit", data={
        "name": "Navchandi Homa Special",
        "deity": "Goddess Durga",
        "base_price": "8500.00",
        "duration_minutes": "200",
        "samagri_included": "1",
        "icon": "🔥",
        "description": "Updated Navchandi description.",
        "is_active": "1",
    }, follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        p = db.session.get(PujaService, puja_id)
        assert p.name == "Navchandi Homa Special"
        assert float(p.price) == 8500.00
        assert p.icon == "🔥"

    # 3. Delete
    res = client.post(f"/admin/services/puja/{puja_id}/delete", follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        p = db.session.get(PujaService, puja_id)
        assert p is None


def test_coupon_crud(client, app):
    """Test full CRUD on Discount Coupons."""
    client.post("/auth/login", data={"email": "super@japam.in", "password": "AdminPass123!"})

    # 1. Create
    res = client.post("/admin/operations/coupons/create", data={
        "code": "VEDA50",
        "discount_type": "percentage",
        "discount_value": "50.00",
        "min_order_amount": "1000.00",
        "usage_limit": "100",
    }, follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        c = Coupon.query.filter_by(code="VEDA50").first()
        assert c is not None
        coupon_id = c.id

    # 2. Update
    res = client.post(f"/admin/operations/coupons/{coupon_id}/edit", data={
        "code": "VEDA50_UPDATED",
        "discount_type": "percentage",
        "discount_value": "45.00",
        "min_order_amount": "1500.00",
        "usage_limit": "200",
        "is_active": "1",
    }, follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        c = db.session.get(Coupon, coupon_id)
        assert c.code == "VEDA50_UPDATED"
        assert float(c.discount_value) == 45.00

    # 3. Delete
    res = client.post(f"/admin/operations/coupons/{coupon_id}/delete", follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        c = db.session.get(Coupon, coupon_id)
        assert c is None


def test_product_crud(client, app):
    """Test full CRUD on Catalog Products."""
    client.post("/auth/login", data={"email": "super@japam.in", "password": "AdminPass123!"})

    with app.app_context():
        cat = Category.query.first()
        cat_id = cat.id

    # 1. Create
    res = client.post("/admin/commerce/products/create", data={
        "name": "Siddha Parad Shivling",
        "sku": "PAR-001",
        "category_id": str(cat_id),
        "price": "3999.00",
        "compare_price": "5499.00",
        "stock_quantity": "25",
        "description": "Authentic Siddha Parad Shivling for home worship.",
        "certification_status": "certified",
    }, follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        p = Product.query.filter_by(sku="PAR-001").first()
        assert p is not None
        assert float(p.price) == 3999.00
        prod_id = p.id

    # 2. Update
    res = client.post(f"/admin/commerce/products/{prod_id}/edit", data={
        "name": "Siddha Parad Shivling Premium",
        "category_id": str(cat_id),
        "price": "4299.00",
        "compare_price": "5999.00",
        "stock_quantity": "30",
        "description": "Updated premium description.",
        "certification_status": "certified",
        "publishing_status": "published",
    }, follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        p = db.session.get(Product, prod_id)
        assert p.name == "Siddha Parad Shivling Premium"
        assert float(p.price) == 4299.00
        assert p.stock_quantity == 30

    # 3. Delete
    res = client.post(f"/admin/commerce/products/{prod_id}/delete", follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        p = db.session.get(Product, prod_id)
        assert p is None


def test_category_crud(client, app):
    """Test full CRUD on Categories."""
    client.post("/auth/login", data={"email": "super@japam.in", "password": "AdminPass123!"})

    # 1. Create
    res = client.post("/admin/commerce/categories/create", data={
        "name": "Sacred Incense",
        "slug": "sacred-incense",
        "description": "Natural temple dhoop and agarbatti.",
    }, follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        c = Category.query.filter_by(slug="sacred-incense").first()
        assert c is not None
        cat_id = c.id

    # 2. Update
    res = client.post(f"/admin/commerce/categories/{cat_id}/edit", data={
        "name": "Sacred Incense & Dhoop",
        "slug": "sacred-incense-dhoop",
        "description": "Updated herbal description.",
        "is_active": "1",
    }, follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        c = db.session.get(Category, cat_id)
        assert c.name == "Sacred Incense & Dhoop"

    # 3. Delete
    res = client.post(f"/admin/commerce/categories/{cat_id}/delete", follow_redirects=True)
    assert res.status_code == 200

    with app.app_context():
        c = db.session.get(Category, cat_id)
        assert c is None

