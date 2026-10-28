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
        location: str = None,
        address: str = None,
        admin_user = None,
        payment_mode: str = None,
        payment_method: str = None,
        status: str = None,
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

        from app.services.sequence_service import SequenceService
        booking_number = SequenceService.next_puja_booking_number()

        # Preserve existing online/offline mode and payment-status rules.
        # WhatsApp mode: booking is pending admin confirmation.
        # Online mode: booking is confirmed on slot, but payment is not marked as successful until verified.
        # Offline mode: booking is pending admin payment confirmation.
        is_whatsapp = (booking_type and booking_type.lower() == "whatsapp") or (payment_mode and payment_mode.lower() == "whatsapp")
        if is_whatsapp:
            initial_status = status if status else "pending"
            notes_text = "Mode: WHATSAPP | Method: WhatsApp Booking"
            booking_type = "whatsapp"
        else:
            initial_status = status if status else ("pending" if payment_mode == "offline" else "confirmed")
            notes_text = f"Payment Mode: {(payment_mode or 'ONLINE').upper()} | Method: {payment_method or ('Offline Payment' if payment_mode == 'offline' else 'Online Gateway')}"

        booking = PujaBooking(
            booking_number=booking_number,
            service_id=service.id,
            customer_name=customer_name,
            customer_email=customer_email or "",
            customer_phone=customer_phone,
            gotra=gotra,
            nakshatra=nakshatra,
            rashi=rashi,
            sankalp_text=sankalp_text,
            location=location,
            address=address,
            booking_date=booking_date,
            time_slot=time_slot,
            booking_type=booking_type,
            priest_name=slot.assigned_priest_or_astrologer if (slot and slot.assigned_priest_or_astrologer) else None,
            status=initial_status,
            amount_paid=Decimal("0.00"),  # A booking submission must not automatically mark a payment as successful
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
        booking.priest_name = priest_name.strip() if priest_name and priest_name.strip() else None
        booking.meeting_link_or_venue = meeting_link.strip() if meeting_link and meeting_link.strip() else None

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

    @staticmethod
    def ingest_service_image(file_obj=None, raw_path_or_url: str = None) -> str:
        """
        Validates and securely saves puja service images.
        Validates allowed formats (jpg, jpeg, png, webp, svg) and file size (MAX_CONTENT_LENGTH).
        Stores in app/static/uploads/services/ and returns public URL (/static/uploads/services/<filename>).
        """
        import os, shutil, uuid
        from flask import current_app
        from werkzeug.utils import secure_filename

        upload_dir = os.path.join(current_app.root_path, "static", "uploads", "services")
        os.makedirs(upload_dir, exist_ok=True)

        allowed_exts = {"jpg", "jpeg", "png", "webp", "svg"}
        max_size = current_app.config.get("MAX_CONTENT_LENGTH", 10 * 1024 * 1024)

        # 1. Direct file upload
        if file_obj and hasattr(file_obj, "filename") and file_obj.filename:
            raw_filename = file_obj.filename.strip()
            if not raw_filename:
                return None

            orig = secure_filename(raw_filename)
            ext = orig.rsplit(".", 1)[-1].lower() if "." in orig else ""
            if ext not in allowed_exts:
                raise ValueError(f"Invalid image format '.{ext}'. Allowed formats: JPG, JPEG, PNG, WEBP, SVG.")

            # Validate size
            file_obj.seek(0, os.SEEK_END)
            size = file_obj.tell()
            file_obj.seek(0)
            if size > max_size:
                max_mb = max_size // (1024 * 1024)
                raise ValueError(f"Image file exceeds maximum allowed size of {max_mb}MB.")

            filename = f"puja_{uuid.uuid4().hex[:8]}_{orig}"
            dest_path = os.path.join(upload_dir, filename)
            file_obj.save(dest_path)
            return f"/static/uploads/services/{filename}"

        # 2. Path or URL string handling
        if not raw_path_or_url:
            return None

        path_str = str(raw_path_or_url).strip()
        if not path_str:
            return None

        if path_str.startswith("http://") or path_str.startswith("https://") or path_str.startswith("/static/"):
            return path_str

        # Clean file:/// prefix if present
        clean_path = path_str
        if clean_path.startswith("file:///"):
            clean_path = clean_path[8:]
        elif clean_path.startswith("file://"):
            clean_path = clean_path[7:]

        candidates = [
            clean_path,
            clean_path.replace("/", "\\"),
            clean_path.replace("\\", "/"),
        ]
        basename = os.path.basename(clean_path.replace("\\", "/"))
        candidates.append(os.path.join("D:\\Downloads", basename))

        found_src = None
        for cand in candidates:
            if cand and os.path.isfile(cand):
                found_src = cand
                break

        if found_src:
            orig = secure_filename(os.path.basename(found_src))
            ext = orig.rsplit(".", 1)[-1].lower() if "." in orig else ""
            if ext not in allowed_exts:
                raise ValueError(f"Invalid image format '.{ext}'. Allowed formats: JPG, JPEG, PNG, WEBP, SVG.")
            filename = f"puja_{uuid.uuid4().hex[:8]}_{orig}"
            dest_path = os.path.join(upload_dir, filename)
            shutil.copy2(found_src, dest_path)
            return f"/static/uploads/services/{filename}"

        return path_str.replace("\\", "/")

