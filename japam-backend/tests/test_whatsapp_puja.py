from datetime import date
from app.extensions import db
from app.models.service import PujaBooking, PujaService
from app.services.booking_service import BookingService

def test_whatsapp_puja_booking_persistence(app):
    with app.app_context():
        svc = PujaService.query.filter_by(is_active=True).first()
        if not svc:
            svc = PujaService(name="Ganesh Puja", price=1100, is_active=True)
            db.session.add(svc)
            db.session.commit()

        booking = BookingService.book_puja_slot(
            service_id=svc.id,
            customer_name="Ramesh Sharma",
            customer_email="ramesh@example.com",
            customer_phone="9876543210",
            booking_date=date(2026, 11, 15),
            time_slot="10:00 AM",
            booking_type="whatsapp",
            location="Nashik",
            address="Panchavati",
            gotra="Kashyap",
            rashi="Mesh",
            nakshatra="Ashwini",
            sankalp_text="Aarogya and Shanti",
        )

        assert booking.booking_number is not None
        assert booking.booking_type == "whatsapp"
        assert booking.status == "pending"
        assert "WHATSAPP" in (booking.notes or "")

        filtered = PujaBooking.query.filter(
            (PujaBooking.booking_type.ilike("%whatsapp%")) | (PujaBooking.notes.ilike("%whatsapp%"))
        ).all()
        booking_ids = [b.id for b in filtered]
        assert booking.id in booking_ids
