def test_super_admin_has_full_access(client):
    # Log in as Super Admin
    client.post("/auth/login", data={"email": "super@japam.in", "password": "AdminPass123!"})
    
    # Check overview
    res_dash = client.get("/admin/dashboard")
    assert res_dash.status_code == 200

    # Check products
    res_prod = client.get("/admin/commerce/products")
    assert res_prod.status_code == 200

    # Check user management
    res_users = client.get("/admin/system/users")
    assert res_users.status_code == 200

    # Check settings
    res_set = client.get("/admin/system/settings")
    assert res_set.status_code == 200


def test_commerce_manager_forbidden_on_system_users(client):
    # Log in as Commerce Manager
    client.post("/auth/login", data={"email": "comm@japam.in", "password": "CommPass123!"})

    # Allowed: commerce products
    res_prod = client.get("/admin/commerce/products")
    assert res_prod.status_code == 200

    # Forbidden: system user management (should return HTTP 403)
    res_users = client.get("/admin/system/users")
    assert res_users.status_code == 403

    # Forbidden: system settings (should return HTTP 403)
    res_set = client.get("/admin/system/settings")
    assert res_set.status_code == 403


def test_readonly_user_forbidden_on_create_product(client):
    # Log in as Read Only
    client.post("/auth/login", data={"email": "ro@japam.in", "password": "RoPass123!"})

    # Can view products
    res_prod = client.get("/admin/commerce/products")
    assert res_prod.status_code == 200

    # Forbidden to create product (returns 403)
    res_create = client.post("/admin/commerce/products/create", data={
        "name": "Unauthorized Yantra",
        "sku": "YAN-999",
        "category_id": 1,
        "price": "999.00",
    })
    assert res_create.status_code == 403
