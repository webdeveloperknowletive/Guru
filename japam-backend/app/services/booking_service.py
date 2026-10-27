from datetime import date, datetime, timezone
from decimal import Decimal
from app.extensions import db
from app.models.service import PujaService, PujaBooking, JyotishConsultation, AvailabilitySlot
from app.services.audit_service import AuditService


class BookingService:
    @staticmethod
    def book_puja_slot(
        service_id: int,
        customer_name: str,
        customer_email: str,
        customer_phone: str,
        booking_date: date,
        time_slot: str,
        booking_type: str = "online",
        gotra: str = None,
        nakshatra: str = None,
        rashi: str = None,
        sankalp_text: str = None,
        admin_user = None,
        payment_mode: str = None,
        payment_method: str = None,
    ) -> PujaBooking:
        """
        Creates a Puja Booking after checking and locking the availability slot.
        Prevents double-booking. Assigns status based on active payment_mode.
        """
        from app.services.payment_mode_service import PaymentModeService
        if payment_mode is None:
            payment_mode = PaymentModeService.get_payment_mode()

        service = PujaService.query.filter_by(id=service_id, is_active=True).first()
        if not service:
            raise ValueError(f"Puja service ID {service_id} not found or inactive.")

        # Check and lock slot if configured in availability_slots
        clean_time = time_slot.split("-")[0].strip() if "-" in time_slot else time_slot.strip()
        slot = AvailabilitySlot.query.filter(
            AvailabilitySlot.service_type == "puja",
            AvailabilitySlot.slot_date == booking_date,
            (AvailabilitySlot.start_time == clean_time) | (AvailabilitySlot.start_time == time_slot.strip()),
            AvailabilitySlot.is_active == True,
        ).with_for_update().first()

        if slot:
            if slot.booked_count >= slot.max_capacity:
                raise ValueError(f"The slot {time_slot} on {booking_date} is fully booked.")
            slot.booked_count += 1

        booking_count = PujaBooking.query.count() + 1
        booking_number = f"#PUJ-{booking_date.strftime('%Y%m')}-{booking_count:04d}"

        # In offline mode, booking status is pending payment confirmation
        initial_status = "pending" if payment_mode == "offline" else "confirmed"
        notes_text = f"Payment Mode: {payment_mode.upper()} | Method: {payment_method or ('Offline Payment' if payment_mode == 'offline' else 'Online Gateway')}"

        booking = PujaBooking(
            booking_number=booking_number,
            service_id=service.id,
            customer_name=customer_name,
            customer_email=customer_email,
            customer_phone=customer_phone,
            gotra=gotra,
            nakshatra=nakshatra,
            rashi=rashi,
            sankalp_text=sankalp_text,
            booking_date=booking_date,
            time_slot=time_slot,
            booking_type=booking_type,
            priest_name=slot.assigned_priest_or_astrologer if slot else "Pandit Ji",
            status=initial_status,
            amount_paid=service.price if initial_status == "confirmed" else Decimal("0.00"),
            notes=notes_text,
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(booking)
        db.session.commit()

        AuditService.log(
            action="PUJA_BOOKING_CREATED",
            module="services",
            actor_email=admin_user.email if admin_user else "customer",
            actor_user_id=admin_user.id if admin_user else None,
            entity_type="PujaBooking",
            entity_id=str(booking.id),
            details={
                "booking_number": booking.booking_number,
                "service": service.name,
                "date": str(booking_date),
                "time_slot": time_slot,
            },
        )
        return booking

    @staticmethod
    def update_booking_status(booking_id: int, new_status: str, priest_name: str, meeting_link: str, admin_user) -> PujaBooking:
        booking = PujaBooking.query.filter_by(id=booking_id).first()
        if not booking:
            raise ValueError(f"Booking ID {booking_id} not found.")

        old_status = booking.status
        booking.status = new_status
        if priest_name:
            booking.priest_name = priest_name
        if meeting_link:
            booking.meeting_link_or_venue = meeting_link

        db.session.commit()

        AuditService.log(
            action="PUJA_STATUS_CHANGE",
            module="services",
            actor_email=admin_user.email,
            actor_user_id=admin_user.id,
            entity_type="PujaBooking",
            entity_id=str(booking.id),
            details={
                "booking_number": booking.booking_number,
                "old_status": old_status,
                "new_status": new_status,
                "priest": priest_name,
            },
        )
        return booking

    @staticmethod
    def update_consultation(consultation_id: int, status: str, astrologer_notes: str, meeting_link: str, admin_user) -> JyotishConsultation:
        consultation = JyotishConsultation.query.filter_by(id=consultation_id).first()
        if not consultation:
            raise ValueError(f"Consultation ID {consultation_id} not found.")

        old_status = consultation.status
        consultation.status = status
        if astrologer_notes is not None:
            consultation.astrologer_notes = astrologer_notes
        if meeting_link:
            consultation.meeting_link = meeting_link

        db.session.commit()

        AuditService.log(
            action="CONSULTATION_UPDATE",
            module="services",
            actor_email=admin_user.email,
            actor_user_id=admin_user.id,
            entity_type="JyotishConsultation",
            entity_id=str(consultation.id),
            details={
                "consultation_number": consultation.consultation_number,
                "old_status": old_status,
                "new_status": status,
            },
        )
        return consultation
