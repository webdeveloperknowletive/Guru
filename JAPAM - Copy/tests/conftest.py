import pytest
from decimal import Decimal
from datetime import datetime, date, timezone
from app import create_app
from app.extensions import db, redis_client
from app.models.user import Role, AdminUser
from app.models.commerce import Category, Product, Order, OrderItem
from app.models.service import PujaService, AvailabilitySlot
from app.services.rbac_service import seed_roles_and_permissions


@pytest.fixture
def app():
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        seed_roles_and_permissions()

        # Create test users
        super_role = Role.query.filter_by(code="super_admin").first()
        comm_role = Role.query.filter_by(code="commerce_manager").first()
        read_role = Role.query.filter_by(code="read_only").first()

        admin = AdminUser(email="super@japam.in", full_name="Super Admin", role=super_role, is_active=True)
        admin.set_password("AdminPass123!")
        db.session.add(admin)

        commerce_user = AdminUser(email="comm@japam.in", full_name="Commerce User", role=comm_role, is_active=True)
        commerce_user.set_password("CommPass123!")
        db.session.add(commerce_user)

        readonly_user = AdminUser(email="ro@japam.in", full_name="Read Only User", role=read_role, is_active=True)
        readonly_user.set_password("RoPass123!")
        db.session.add(readonly_user)

        # Seed category & product
        cat = Category(name="Rudraksha", slug="rudraksha", is_active=True)
        db.session.add(cat)
        db.session.flush()

        prod = Product(
            name="5 Mukhi Rudraksha",
            slug="5-mukhi-rudraksha-rm-001",
            sku="RM-001",
            category_id=cat.id,
            price=Decimal("1500.00"),
            stock_quantity=10,
            low_stock_threshold=5,
            publishing_status="published",
        )
        db.session.add(prod)

        # Seed Puja service & slot
        puja = PujaService(
            name="Ganapati Puja",
            slug="ganapati-puja",
            deity="Ganesha",
            price=Decimal("2100.00"),
            is_active=True,
        )
        db.session.add(puja)
        db.session.flush()

        slot = AvailabilitySlot(
            service_type="puja",
            slot_date=date(2026, 11, 1),
            start_time="10:00 AM",
            end_time="11:30 AM",
            max_capacity=1,
            booked_count=0,
            is_active=True,
        )
        db.session.add(slot)

        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture(autouse=True)
def clean_redis():
    try:
        redis_client.flushdb()
    except Exception:
        pass
    yield
    try:
        redis_client.flushdb()
    except Exception:
        pass


@pytest.fixture
def client(app):
    return app.test_client()
