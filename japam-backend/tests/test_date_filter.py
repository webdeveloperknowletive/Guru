import pytest
from decimal import Decimal
from datetime import datetime, date, timezone
from app.extensions import db
from app.models.commerce import Order
from app.models.service import PujaBooking, PujaService
from app.utils.date_filter import (
    apply_date_time_filters,
    extract_date_filter_context,
    parse_time_slot_period,
    DAY_NAME_TO_INT
)


def test_parse_time_slot_period():
    assert parse_time_slot_period("10:00 AM") == "morning"
    assert parse_time_slot_period("07:30 AM") == "morning"
    assert parse_time_slot_period("12:00 PM") == "afternoon"
    assert parse_time_slot_period("03:30 PM") == "afternoon"
    assert parse_time_slot_period("06:00 PM") == "evening"
    assert parse_time_slot_period("08:45 PM") == "evening"
    assert parse_time_slot_period("10:30 PM") == "night"
    assert parse_time_slot_period("02:00 AM") == "night"
    assert parse_time_slot_period(None) is None


def test_extract_date_filter_context():
    args = {
        "date_preset": "today",
        "filter_date": "2026-10-29",
        "filter_month": "2026-10",
        "filter_day": "thursday",
        "filter_time": "morning"
    }
    ctx = extract_date_filter_context(args)
    assert ctx["has_active_filters"] is True
    assert ctx["date_preset"] == "today"
    assert ctx["filter_date"] == "2026-10-29"
    assert ctx["filter_month"] == "2026-10"
    assert ctx["filter_day"] == "thursday"
    assert ctx["filter_time"] == "morning"
    assert len(ctx["active_badges"]) == 5


def test_apply_filter_on_orders(app):
    with app.app_context():
        # Seed test orders with explicit placed_at datetimes
        # 2026-10-29 is a Thursday.
        # Placed at 10:30 AM IST = 05:00 UTC
        o1 = Order(
            order_number="#TEST-ORD-001",
            customer_name="Devotee Rahul",
            customer_email="rahul@example.com",
            total_amount=Decimal("1500.00"),
            order_status="processing",
            payment_status="paid",
            placed_at=datetime(2026, 10, 29, 5, 0, 0)
        )
        # Placed at 03:00 PM IST = 09:30 UTC on 2026-10-28 (Wednesday)
        o2 = Order(
            order_number="#TEST-ORD-002",
            customer_name="Devotee Priya",
            customer_email="priya@example.com",
            total_amount=Decimal("2500.00"),
            order_status="delivered",
            payment_status="paid",
            placed_at=datetime(2026, 10, 28, 9, 30, 0)
        )
        # Placed in 2024-04-15
        o3 = Order(
            order_number="#TEST-ORD-003",
            customer_name="Devotee Amit",
            customer_email="amit@example.com",
            total_amount=Decimal("3500.00"),
            order_status="pending",
            payment_status="offline_pending",
            placed_at=datetime(2024, 4, 15, 12, 0, 0)
        )
        db.session.add_all([o1, o2, o3])
        db.session.commit()

        base_query = Order.query
        assert base_query.count() == 3

        # Filter by specific date: 2026-10-29
        q_date = apply_date_time_filters(base_query, Order.placed_at, {"filter_date": "2026-10-29"})
        assert q_date.count() == 1
        assert q_date.first().order_number == "#TEST-ORD-001"

        # Filter by month 2026-10
        q_month = apply_date_time_filters(base_query, Order.placed_at, {"filter_month": "2026-10"})
        assert q_month.count() == 2

        # Filter by month 2024-04
        q_month_2024 = apply_date_time_filters(base_query, Order.placed_at, {"filter_month": "2024-04"})
        assert q_month_2024.count() == 1
        assert q_month_2024.first().order_number == "#TEST-ORD-003"

        # Filter by day: Thursday (2026-10-29 is Thursday)
        q_thu = apply_date_time_filters(base_query, Order.placed_at, {"filter_day": "thursday"})
        assert q_thu.count() == 1
        assert q_thu.first().order_number == "#TEST-ORD-001"

        # Filter by day: Wednesday (2026-10-28 is Wednesday)
        q_wed = apply_date_time_filters(base_query, Order.placed_at, {"filter_day": "wednesday"})
        assert q_wed.count() == 1
        assert q_wed.first().order_number == "#TEST-ORD-002"

        # Filter by time period: Morning (o1 is 10:30 AM IST)
        q_morn = apply_date_time_filters(base_query, Order.placed_at, {"filter_time": "morning"})
        assert q_morn.count() == 1
        assert q_morn.first().order_number == "#TEST-ORD-001"

        # Filter by time period: Afternoon (o2 is 3:00 PM IST)
        q_aft = apply_date_time_filters(base_query, Order.placed_at, {"filter_time": "afternoon"})
        assert q_aft.count() >= 1


def test_apply_filter_on_date_only_column(app):
    with app.app_context():
        puja = PujaService.query.first()
        b1 = PujaBooking(
            booking_number="#TEST-PUJ-001",
            service_id=puja.id,
            customer_name="Devotee Sneha",
            booking_date=date(2026, 11, 12),  # Thursday
            time_slot="10:00 AM",
            booking_type="online",
            status="confirmed",
            amount_paid=Decimal("2100.00"),
            created_at=datetime(2026, 10, 15, 10, 0, 0)
        )
        b2 = PujaBooking(
            booking_number="#TEST-PUJ-002",
            service_id=puja.id,
            customer_name="Devotee Manoj",
            booking_date=date(2026, 11, 15),  # Sunday
            time_slot="04:00 PM",
            booking_type="offline",
            status="pending",
            amount_paid=Decimal("2100.00"),
            created_at=datetime(2026, 10, 20, 14, 0, 0)
        )
        db.session.add_all([b1, b2])
        db.session.commit()

        base_query = PujaBooking.query

        # Filter by ceremony date
        q_d = apply_date_time_filters(base_query, PujaBooking.booking_date, {"filter_date": "2026-11-12"}, date_is_date_only=True)
        assert q_d.count() == 1
        assert q_d.first().booking_number == "#TEST-PUJ-001"

        # Filter by ceremony day of week: Thursday
        q_thu = apply_date_time_filters(base_query, PujaBooking.booking_date, {"filter_day": "thursday"}, date_is_date_only=True)
        assert q_thu.count() == 1
        assert q_thu.first().booking_number == "#TEST-PUJ-001"

        # Filter by ceremony day of week: Sunday
        q_sun = apply_date_time_filters(base_query, PujaBooking.booking_date, {"filter_day": "sunday"}, date_is_date_only=True)
        assert q_sun.count() == 1
        assert q_sun.first().booking_number == "#TEST-PUJ-002"

        # Filter by ceremony time slot: Morning
        q_morn = apply_date_time_filters(
            base_query,
            PujaBooking.booking_date,
            {"filter_time": "morning"},
            extra_time_col=PujaBooking.time_slot,
            date_is_date_only=True
        )
        assert q_morn.count() == 1
        assert q_morn.first().booking_number == "#TEST-PUJ-001"

        # Filter by ceremony time slot: Afternoon
        q_aft = apply_date_time_filters(
            base_query,
            PujaBooking.booking_date,
            {"filter_time": "afternoon"},
            extra_time_col=PujaBooking.time_slot,
            date_is_date_only=True
        )
        assert q_aft.count() == 1
        assert q_aft.first().booking_number == "#TEST-PUJ-002"
