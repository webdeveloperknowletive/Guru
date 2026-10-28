import io
from app.extensions import db
from app.models.service import PujaService


def test_puja_service_image_lifecycle(client, app):
    """Test creating, replacing, and removing images on Puja Services."""
    client.post("/auth/login", data={"email": "super@japam.in", "password": "AdminPass123!"})

    # 1. Create with uploaded image
    img_data = (io.BytesIO(b"\x89PNG\r\n\x1a\nfake-png-content"), "vastu_shanti.png")
    res = client.post(
        "/admin/services/puja/create",
        data={
            "name": "Vastu Shanti Puja Special",
            "deity": "Lord Ganesha",
            "price": "2100.00",
            "duration_minutes": "60",
            "icon": "🏠",
            "description": "Vedic Vastu Shanti homa for new home prosperity.",
            "is_online_available": "on",
            "is_offline_available": "on",
            "image": img_data,
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert res.status_code == 200

    with app.app_context():
        p = PujaService.query.filter_by(name="Vastu Shanti Puja Special").first()
        assert p is not None
        assert p.image_url is not None
        assert p.image_url.startswith("/static/uploads/services/puja_")
        assert p.image_url.endswith("vastu_shanti.png")
        puja_id = p.id

    # 2. Check public API returns image_url
    api_res = client.get("/api/v1/services/puja")
    assert api_res.status_code == 200
    puja_list = api_res.get_json().get("puja_services", [])
    matched = next((svc for svc in puja_list if svc["id"] == puja_id), None)
    assert matched is not None
    assert matched["image_url"] == p.image_url

    # 3. Replace image
    new_img_data = (io.BytesIO(b"\xff\xd8\xfffake-jpeg-content"), "vastu_alt.jpg")
    res = client.post(
        f"/admin/services/puja/{puja_id}/edit",
        data={
            "name": "Vastu Shanti Puja Special",
            "deity": "Lord Ganesha",
            "price": "2500.00",
            "duration_minutes": "90",
            "icon": "🏠",
            "description": "Updated description",
            "is_online_available": "on",
            "is_offline_available": "on",
            "is_active": "1",
            "image": new_img_data,
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert res.status_code == 200

    with app.app_context():
        p = db.session.get(PujaService, puja_id)
        assert p.image_url is not None
        assert "vastu_alt.jpg" in p.image_url

    # 4. Remove image
    res = client.post(
        f"/admin/services/puja/{puja_id}/edit",
        data={
            "name": "Vastu Shanti Puja Special",
            "deity": "Lord Ganesha",
            "price": "2500.00",
            "duration_minutes": "90",
            "icon": "🏠",
            "description": "Updated description",
            "is_online_available": "on",
            "is_offline_available": "on",
            "is_active": "1",
            "remove_image": "1",
        },
        follow_redirects=True,
    )
    assert res.status_code == 200

    with app.app_context():
        p = db.session.get(PujaService, puja_id)
        assert p.image_url is None

    # Clean up
    client.post(f"/admin/services/puja/{puja_id}/delete", follow_redirects=True)


def test_puja_service_image_validation(client, app):
    """Test that disallowed image extensions and oversized files are rejected."""
    client.post("/auth/login", data={"email": "super@japam.in", "password": "AdminPass123!"})

    # Disallowed extension: .exe
    bad_file = (io.BytesIO(b"malicious script"), "hack.exe")
    res = client.post(
        "/admin/services/puja/create",
        data={
            "name": "Malicious Puja Test",
            "price": "100.00",
            "image": bad_file,
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert res.status_code == 200
    assert b"Invalid image format" in res.data or b"danger" in res.data

    with app.app_context():
        p = PujaService.query.filter_by(name="Malicious Puja Test").first()
        assert p is None
