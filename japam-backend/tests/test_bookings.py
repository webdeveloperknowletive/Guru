import pytest
from datetime import date
from app.models.service import PujaService, AvailabilitySlot, PujaBooking
from app.services.booking_service import BookingService


def test_puja_slot_booking_and_double_booking_protection(app):
    with app.app_context():
        service = PujaService.query.filter_by(slug="ganapati-puja").first()
        slot_date = date(2026, 11, 1)

        # Slot capacity is 1 in conftest fixture
        slot = AvailabilitySlot.query.filter_by(service_type="puja", slot_date=slot_date, start_time="10:00 AM").first()
        assert slot.booked_count == 0

        # First booking succeeds
        booking1 = BookingService.book_puja_slot(
            service_id=service.id,
            customer_name="Devotee One",
            customer_email="one@japam.in",
            customer_phone="+91 99999 11111",
            booking_date=slot_date,
            time_slot="10:00 AM",
        )
        assert booking1.status == "confirmed"
        assert slot.booked_count == 1

        # Second booking for the exact same slot must be rejected to prevent double booking!
        with pytest.raises(ValueError) as excinfo:
            BookingService.book_puja_slot(
                service_id=service.id,
                customer_name="Devotee Two",
                customer_email="two@japam.in",
                customer_phone="+91 99999 22222",
                booking_date=slot_date,
                time_slot="10:00 AM",
            )
        assert "fully booked" in str(excinfo.value)
