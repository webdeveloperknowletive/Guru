import re
from datetime import datetime, timezone
from app.extensions import db
from app.models.service import PujaBooking, JyotishConsultation, PujaService, AvailabilitySlot
from app.models.operations import CustomerEnquiry, PaymentTransaction, ReturnRequest, Coupon


class SequenceService:
    """Centralized dynamic sequential ID generator across services and operations modules.
    
    Ensures IDs strictly follow unbroken sequential numbers (e.g. #PUJ-0001, #JYT-0001, #ENQ-0001)
    and remain synchronized across admin panel views and public APIs.
    """

    @classmethod
    def _get_next_numeric_sequence(cls, model, field_name: str, prefix: str) -> int:
        """Find the maximum numeric sequence currently used for this model/field and return next integer."""
        # Check max primary key id
        max_id = db.session.query(db.func.max(model.id)).scalar() or 0
        max_seq = max_id

        # Also inspect all existing string values to parse any trailing digits
        try:
            records = db.session.query(getattr(model, field_name)).all()
            for (val,) in records:
                if val:
                    clean = str(val).replace("#", "")
                    # Extract the last contiguous group of digits
                    matches = re.findall(r"\d+", clean)
                    if matches:
                        try:
                            # Use the last number segment (e.g. from '#PUJ-2024-001' or '#PUJ-0005' -> 1 or 5)
                            num = int(matches[-1])
                            if num > max_seq:
                                max_seq = num
                        except ValueError:
                            pass
        except Exception:
            pass

        return max_seq + 1

    @classmethod
    def next_puja_booking_number(cls) -> str:
        """Generate next strictly sequential Puja Booking number: #PUJ-0001, #PUJ-0002, etc."""
        next_seq = cls._get_next_numeric_sequence(PujaBooking, "booking_number", "PUJ")
        for attempt in range(50):
            candidate = f"#PUJ-{next_seq + attempt:04d}"
            if not PujaBooking.query.filter_by(booking_number=candidate).first():
                return candidate
        return f"#PUJ-{next_seq + 100:04d}"

    @classmethod
    def next_consultation_number(cls) -> str:
        """Generate next strictly sequential Jyotish Consultation number: #JYT-0001, #JYT-0002, etc."""
        next_seq = cls._get_next_numeric_sequence(JyotishConsultation, "consultation_number", "JYT")
        for attempt in range(50):
            candidate = f"#JYT-{next_seq + attempt:04d}"
            if not JyotishConsultation.query.filter_by(consultation_number=candidate).first():
                return candidate
        return f"#JYT-{next_seq + 100:04d}"

    @classmethod
    def next_enquiry_number(cls) -> str:
        """Generate next strictly sequential Customer Enquiry number: #ENQ-0001, #ENQ-0002, etc."""
        next_seq = cls._get_next_numeric_sequence(CustomerEnquiry, "enquiry_number", "ENQ")
        for attempt in range(50):
            candidate = f"#ENQ-{next_seq + attempt:04d}"
            if not CustomerEnquiry.query.filter_by(enquiry_number=candidate).first():
                return candidate
        return f"#ENQ-{next_seq + 100:04d}"

    @classmethod
    def next_return_number(cls) -> str:
        """Generate next strictly sequential Return Request number: #RET-0001, #RET-0002, etc."""
        next_seq = cls._get_next_numeric_sequence(ReturnRequest, "return_number", "RET")
        for attempt in range(50):
            candidate = f"#RET-{next_seq + attempt:04d}"
            if not ReturnRequest.query.filter_by(return_number=candidate).first():
                return candidate
        return f"#RET-{next_seq + 100:04d}"

    @classmethod
    def next_payment_transaction_number(cls, prefix: str = "TXN") -> str:
        """Generate next strictly sequential Payment Transaction number: TXN-0001, TXN-0002, etc."""
        next_seq = cls._get_next_numeric_sequence(PaymentTransaction, "transaction_number", prefix)
        for attempt in range(50):
            candidate = f"{prefix}-{next_seq + attempt:04d}"
            if not PaymentTransaction.query.filter_by(transaction_number=candidate).first():
                return candidate
        return f"{prefix}-{next_seq + 100:04d}"

    @classmethod
    def next_puja_display_order(cls) -> int:
        """Determine next strictly sequential display order for Puja Services."""
        max_order = db.session.query(db.func.max(PujaService.display_order)).scalar() or 0
        return max_order + 1

    @classmethod
    def normalize_all_sequences(cls) -> dict:
        """Synchronize and normalize all existing records across services & operations to clean,
        strictly sequential numbering matching their sequential IDs.
        """
        results = {}

        # 1. Puja Bookings
        bookings = PujaBooking.query.order_by(PujaBooking.id.asc()).all()
        for i, b in enumerate(bookings, 1):
            b.booking_number = f"#PUJ-{i:04d}"
        results["puja_bookings"] = len(bookings)

        # 2. Consultations
        consultations = JyotishConsultation.query.order_by(JyotishConsultation.id.asc()).all()
        for i, c in enumerate(consultations, 1):
            c.consultation_number = f"#JYT-{i:04d}"
        results["consultations"] = len(consultations)

        # 3. Enquiries
        enquiries = CustomerEnquiry.query.order_by(CustomerEnquiry.id.asc()).all()
        for i, e in enumerate(enquiries, 1):
            e.enquiry_number = f"#ENQ-{i:04d}"
        results["enquiries"] = len(enquiries)

        # 4. Returns
        returns = ReturnRequest.query.order_by(ReturnRequest.id.asc()).all()
        for i, r in enumerate(returns, 1):
            r.return_number = f"#RET-{i:04d}"
        results["returns"] = len(returns)

        # 5. Puja Services display_order
        services = PujaService.query.order_by(PujaService.display_order.asc(), PujaService.id.asc()).all()
        for i, s in enumerate(services, 1):
            s.display_order = i
        results["puja_services"] = len(services)

        db.session.commit()
        return results
