from datetime import datetime, date, timezone
from decimal import Decimal
from flask import Blueprint, render_template, request, redirect, url_for, flash, abort, jsonify
from app.extensions import db
from app.models.service import PujaService, PujaBooking, JyotishConsultation, AvailabilitySlot
from app.services.booking_service import BookingService
from app.services.rbac_service import login_required, permission_required, get_current_admin
from app.services.audit_service import AuditService

services_bp = Blueprint("services", __name__, url_prefix="/admin/services")


# -------------------------------------------------------------
# Puja Services
# -------------------------------------------------------------
@services_bp.route("/puja")
@login_required
@permission_required("services", "view")
def puja_services_list():
    user = get_current_admin()
    services = PujaService.query.order_by(PujaService.display_order.asc(), PujaService.id.asc()).all()
    return render_template("services/puja_services.html", current_user=user, services=services, active_page="puja_services")


@services_bp.route("/puja/create", methods=["POST"])
@login_required
@permission_required("services", "create")
def puja_service_create():
    user = get_current_admin()
    name = request.form.get("name", "").strip()
    deity = request.form.get("deity", "").strip()
    price = request.form.get("price") or request.form.get("base_price", "0")
    duration = request.form.get("duration_minutes", 60, type=int)
    icon = request.form.get("icon", "🪔").strip() or "🪔"
    description = request.form.get("description", "").strip()
    online_avail = request.form.get("is_online_available") == "on"
    offline_avail = request.form.get("is_offline_available") == "on"
    display_order_val = request.form.get("display_order", type=int)

    if not name:
        flash("Puja name is required.", "danger")
        return redirect(url_for("services.puja_services_list"))

    # Handle image file upload or URL
    image_file = request.files.get("image") or request.files.get("image_file") or request.files.get("file")
    image_url_val = request.form.get("image_url", "").strip()
    image_url = None
    try:
        if image_file and image_file.filename:
            image_url = BookingService.ingest_service_image(file_obj=image_file)
        elif image_url_val:
            image_url = BookingService.ingest_service_image(raw_path_or_url=image_url_val)
    except ValueError as e:
        flash(str(e), "danger")
        return redirect(url_for("services.puja_services_list"))

    slug = name.lower().replace(" ", "-").replace("/", "-")
    # Auto-assign next display_order if not specified
    if display_order_val is None:
        from app.services.sequence_service import SequenceService
        display_order_val = SequenceService.next_puja_display_order()
    puja = PujaService(
        name=name,
        slug=slug,
        deity=deity,
        price=Decimal(price),
        icon=icon,
        duration_minutes=duration,
        description=description,
        image_url=image_url,
        is_online_available=online_avail,
        is_offline_available=offline_avail,
        display_order=display_order_val,
        inclusions=["Vedic Pandit Ji", "Live Sankalp", "Prasad Delivery"],
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(puja)
    db.session.commit()

    AuditService.log(
        action="PUJA_SERVICE_CREATE",
        module="services",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="PujaService",
        entity_id=str(puja.id),
        details={"name": name, "price": str(price), "image_url": image_url},
    )
    flash(f"Puja service '{name}' created successfully.", "success")
    return redirect(url_for("services.puja_services_list"))


@services_bp.route("/puja/<int:service_id>/edit", methods=["POST"])
@login_required
@permission_required("services", "edit")
def puja_service_update(service_id):
    user = get_current_admin()
    puja = PujaService.query.get_or_404(service_id)

    name = request.form.get("name", "").strip()
    deity = request.form.get("deity", "").strip()
    icon = request.form.get("icon", puja.icon or "🪔").strip()
    price = request.form.get("price") or request.form.get("base_price")
    duration = request.form.get("duration_minutes", type=int)
    description = request.form.get("description", "").strip()
    online_avail = request.form.get("is_online_available") == "on"
    offline_avail = request.form.get("is_offline_available") == "on"
    is_active = request.form.get("is_active") == "1" or request.form.get("is_active") == "on"
    display_order_val = request.form.get("display_order", type=int)

    # Handle image upload, replacement, or removal
    image_file = request.files.get("image") or request.files.get("image_file") or request.files.get("file")
    image_url_val = request.form.get("image_url", "").strip()
    remove_image = request.form.get("remove_image") in ("1", "true", "on")

    try:
        if remove_image:
            puja.image_url = None
        elif image_file and image_file.filename:
            puja.image_url = BookingService.ingest_service_image(file_obj=image_file)
        elif image_url_val:
            puja.image_url = BookingService.ingest_service_image(raw_path_or_url=image_url_val)
    except ValueError as e:
        flash(str(e), "danger")
        return redirect(url_for("services.puja_services_list"))

    if name:
        puja.name = name
    puja.deity = deity
    puja.icon = icon
    if price:
        puja.price = Decimal(price)
    if duration:
        puja.duration_minutes = duration
    puja.description = description
    puja.is_online_available = online_avail
    puja.is_offline_available = offline_avail
    puja.is_active = is_active
    if display_order_val is not None:
        puja.display_order = display_order_val
    db.session.commit()

    AuditService.log(
        action="PUJA_SERVICE_UPDATE",
        module="services",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="PujaService",
        entity_id=str(puja.id),
        details={"name": puja.name, "price": str(puja.price), "is_active": puja.is_active, "image_url": puja.image_url},
    )
    flash(f"Puja service '{puja.name}' updated successfully.", "success")
    return redirect(url_for("services.puja_services_list"))


@services_bp.route("/puja/<int:service_id>/delete", methods=["POST", "DELETE"])
@login_required
@permission_required("services", "delete")
def puja_service_delete(service_id):
    user = get_current_admin()
    puja = PujaService.query.get_or_404(service_id)
    is_json = request.is_json or request.headers.get("Accept") == "application/json" or request.method == "DELETE"

    try:
        if puja.bookings:
            puja.is_active = False
            db.session.commit()
            AuditService.log(
                action="PUJA_SERVICE_DEACTIVATE",
                module="services",
                actor_email=user.email,
                actor_user_id=user.id,
                entity_type="PujaService",
                entity_id=str(service_id),
                details={"name": puja.name, "reason": "has_bookings"},
            )
            msg = f"Puja service '{puja.name}' has past devotee bookings; safely deactivated and removed from public booking."
            if is_json:
                return jsonify({"success": True, "message": msg, "deactivated": True, "service_id": service_id}), 200
            flash(msg, "success")
        else:
            name = puja.name
            db.session.delete(puja)
            db.session.commit()
            AuditService.log(
                action="PUJA_SERVICE_DELETE",
                module="services",
                actor_email=user.email,
                actor_user_id=user.id,
                entity_type="PujaService",
                entity_id=str(service_id),
                details={"name": name},
            )
            msg = f"Puja service '{name}' permanently deleted."
            if is_json:
                return jsonify({"success": True, "message": msg, "deactivated": False, "service_id": service_id}), 200
            flash(msg, "success")
    except Exception as e:
        db.session.rollback()
        err_msg = f"Failed to delete puja service: {str(e)}"
        if is_json:
            return jsonify({"error": err_msg}), 500
        flash(err_msg, "danger")

    return redirect(url_for("services.puja_services_list"))


@services_bp.route("/puja/<int:service_id>/reorder", methods=["POST"])
@login_required
@permission_required("services", "edit")
def puja_service_reorder(service_id):
    """Move a puja service up or down in display_order by swapping with its neighbour."""
    direction = request.form.get("direction")  # 'up' or 'down'
    puja = PujaService.query.get_or_404(service_id)
    all_services = PujaService.query.order_by(PujaService.display_order.asc(), PujaService.id.asc()).all()
    idx = next((i for i, s in enumerate(all_services) if s.id == service_id), None)

    if idx is None:
        flash("Service not found.", "danger")
        return redirect(url_for("services.puja_services_list"))

    swap_idx = idx - 1 if direction == "up" else idx + 1
    if swap_idx < 0 or swap_idx >= len(all_services):
        flash("Cannot move further.", "warning")
        return redirect(url_for("services.puja_services_list"))

    neighbour = all_services[swap_idx]
    # Swap display_order values
    puja.display_order, neighbour.display_order = neighbour.display_order, puja.display_order
    db.session.commit()

    user = get_current_admin()
    AuditService.log(
        action="PUJA_SERVICE_REORDER",
        module="services",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="PujaService",
        entity_id=str(puja.id),
        details={"direction": direction, "swapped_with": neighbour.id},
    )
    return redirect(url_for("services.puja_services_list"))


@services_bp.route("/puja/reorder-bulk", methods=["POST"])
@login_required
@permission_required("services", "edit")
def puja_service_reorder_bulk():
    """Accept JSON {orders:[{id, order},...]} and persist display_order for all puja services."""
    data = request.get_json(silent=True)
    if not data or "orders" not in data:
        return jsonify({"error": "Invalid payload"}), 400

    user = get_current_admin()
    try:
        for item in data["orders"]:
            svc = PujaService.query.get(item["id"])
            if svc:
                svc.display_order = int(item["order"])
        db.session.commit()
        AuditService.log(
            action="PUJA_SERVICE_REORDER_BULK",
            module="services",
            actor_email=user.email,
            actor_user_id=user.id,
            entity_type="PujaService",
            entity_id="bulk",
            details={"count": len(data["orders"])},
        )
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------
# Puja Bookings
# -------------------------------------------------------------
@services_bp.route("/bookings")
@login_required
@permission_required("services", "view")
def puja_bookings_list():
    user = get_current_admin()
    status = request.args.get("status")
    q = PujaBooking.query
    if status:
        q = q.filter_by(status=status)

    bookings = q.order_by(PujaBooking.booking_date.desc()).all()
    puja_services = PujaService.query.filter_by(is_active=True).all()
    return render_template(
        "services/puja_bookings.html",
        current_user=user,
        bookings=bookings,
        services=puja_services,
        selected_status=status,
        active_page="puja_bookings",
    )


@services_bp.route("/bookings/<int:booking_id>/update", methods=["POST"])
@login_required
@permission_required("services", "edit")
def puja_booking_update(booking_id):
    user = get_current_admin()
    status = request.form.get("status")
    priest = request.form.get("priest_name", "").strip()
    link = request.form.get("meeting_link_or_venue", "").strip()

    try:
        BookingService.update_booking_status(booking_id, status, priest, link, user)
        flash("Puja booking updated successfully.", "success")
    except ValueError as e:
        flash(str(e), "danger")

    return redirect(url_for("services.puja_bookings_list"))


# -------------------------------------------------------------
# Jyotish Consultations
# -------------------------------------------------------------
@services_bp.route("/consultations")
@login_required
@permission_required("consultations", "view")
def consultations_list():
    user = get_current_admin()
    status = request.args.get("status")
    q = JyotishConsultation.query
    if status:
        q = q.filter_by(status=status)

    consultations = q.order_by(JyotishConsultation.created_at.desc()).all()
    can_view_notes = user.has_permission("consultations", "notes") or (user.role and user.role.code == "super_admin")

    return render_template(
        "services/consultations.html",
        current_user=user,
        consultations=consultations,
        can_view_notes=can_view_notes,
        selected_status=status,
        active_page="consultations",
    )


@services_bp.route("/consultations/<int:consultation_id>/update", methods=["POST"])
@login_required
@permission_required("consultations", "edit")
def consultation_update(consultation_id):
    user = get_current_admin()
    status = request.form.get("status")
    link = request.form.get("meeting_link", "").strip()
    notes = request.form.get("astrologer_notes")

    # Only astrologers/super admin can update notes
    can_edit_notes = user.has_permission("consultations", "notes") or (user.role and user.role.code == "super_admin")
    if not can_edit_notes:
        notes = None

    try:
        BookingService.update_consultation(consultation_id, status, notes, link, user)
        flash("Consultation status updated successfully.", "success")
    except ValueError as e:
        flash(str(e), "danger")

    return redirect(url_for("services.consultations_list"))


@services_bp.route("/consultations/create", methods=["POST"])
@login_required
@permission_required("consultations", "create")
def consultation_create():
    user = get_current_admin()
    name = request.form.get("customer_name", "").strip()
    email = request.form.get("customer_email", "").strip()
    phone = request.form.get("customer_phone", "").strip()
    topic = request.form.get("topic", "Kundali Consultation").strip()
    dob_str = request.form.get("dob")
    tob = request.form.get("tob", "10:00 AM").strip()
    pob = request.form.get("pob", "").strip()
    astrologer = request.form.get("astrologer_name", "Acharya Shastri Ji").strip()
    status = request.form.get("status", "confirmed")

    if not name or not email or not dob_str or not pob:
        flash("Customer name, email, birth date, and place of birth are required.", "danger")
        return redirect(url_for("services.consultations_list"))

    dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
    from app.services.sequence_service import SequenceService
    consult_num = SequenceService.next_consultation_number()

    consultation = JyotishConsultation(
        consultation_number=consult_num,
        customer_name=name,
        customer_email=email,
        customer_phone=phone,
        dob=dob,
        tob=tob,
        pob=pob,
        topic=topic,
        consultation_type="phone" if "phone" in topic.lower() else "online_video",
        status=status,
        astrologer_name=astrologer,
        amount_paid=Decimal("1500.00"),
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(consultation)
    db.session.commit()

    AuditService.log(
        action="CONSULTATION_CREATE",
        module="services",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="JyotishConsultation",
        entity_id=str(consultation.id),
        details={"consultation_number": consult_num, "customer_name": name, "topic": topic},
    )
    flash(f"Consultation {consult_num} created successfully.", "success")
    return redirect(url_for("services.consultations_list"))


@services_bp.route("/consultations/<int:consultation_id>/delete", methods=["POST"])
@login_required
@permission_required("consultations", "delete")
def consultation_delete(consultation_id):
    user = get_current_admin()
    consultation = JyotishConsultation.query.get_or_404(consultation_id)
    c_num = consultation.consultation_number
    db.session.delete(consultation)
    db.session.commit()

    AuditService.log(
        action="CONSULTATION_DELETE",
        module="services",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="JyotishConsultation",
        entity_id=str(consultation_id),
        details={"consultation_number": c_num},
    )
    flash(f"Consultation {c_num} deleted.", "success")
    return redirect(url_for("services.consultations_list"))



# -------------------------------------------------------------
# Availability Calendar & Slots
# -------------------------------------------------------------
@services_bp.route("/availability")
@login_required
@permission_required("availability", "view")
def availability_list():
    user = get_current_admin()
    slots = AvailabilitySlot.query.order_by(AvailabilitySlot.slot_date.asc(), AvailabilitySlot.start_time.asc()).all()
    return render_template("services/availability.html", current_user=user, slots=slots, active_page="availability")


@services_bp.route("/availability/create", methods=["POST"])
@login_required
@permission_required("availability", "edit")
def availability_create():
    user = get_current_admin()
    svc_type = request.form.get("service_type", "puja")
    slot_date_str = request.form.get("slot_date")
    start_time = request.form.get("start_time", "10:00 AM")
    end_time = request.form.get("end_time", "11:30 AM")
    capacity = request.form.get("max_capacity", 1, type=int)
    assigned = request.form.get("assigned_priest_or_astrologer", "").strip()

    if not slot_date_str:
        flash("Slot date is required.", "danger")
        return redirect(url_for("services.availability_list"))

    slot_date = datetime.strptime(slot_date_str, "%Y-%m-%d").date()

    slot = AvailabilitySlot(
        service_type=svc_type,
        slot_date=slot_date,
        start_time=start_time,
        end_time=end_time,
        max_capacity=capacity,
        booked_count=0,
        is_active=True,
        assigned_priest_or_astrologer=assigned or "Pandit Ji",
    )
    db.session.add(slot)
    db.session.commit()

    AuditService.log(
        action="AVAILABILITY_SLOT_CREATE",
        module="services",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="AvailabilitySlot",
        entity_id=str(slot.id),
        details={"service_type": svc_type, "date": str(slot_date), "start_time": start_time},
    )
    flash("Availability slot created.", "success")
    return redirect(url_for("services.availability_list"))


@services_bp.route("/availability/<int:slot_id>/edit", methods=["POST"])
@login_required
@permission_required("availability", "edit")
def availability_update(slot_id):
    user = get_current_admin()
    slot = AvailabilitySlot.query.get_or_404(slot_id)

    svc_type = request.form.get("service_type", slot.service_type)
    slot_date_str = request.form.get("slot_date")
    start_time = request.form.get("start_time", slot.start_time).strip()
    end_time = request.form.get("end_time", slot.end_time).strip()
    capacity = request.form.get("max_capacity", slot.max_capacity, type=int)
    assigned = request.form.get("assigned_priest_or_astrologer", "").strip()
    is_active = request.form.get("is_active") in ("1", "true", "on", "True")

    if slot_date_str:
        slot.slot_date = datetime.strptime(slot_date_str, "%Y-%m-%d").date()
    slot.service_type = svc_type
    slot.start_time = start_time
    slot.end_time = end_time
    slot.max_capacity = max(1, capacity)
    slot.assigned_priest_or_astrologer = assigned or "Pandit Ji"
    slot.is_active = is_active

    db.session.commit()

    AuditService.log(
        action="AVAILABILITY_SLOT_UPDATE",
        module="services",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="AvailabilitySlot",
        entity_id=str(slot.id),
        details={"service_type": slot.service_type, "date": str(slot.slot_date), "is_active": slot.is_active},
    )
    flash(f"Slot on {slot.slot_date} ({slot.start_time}) updated successfully.", "success")
    return redirect(url_for("services.availability_list"))


@services_bp.route("/availability/<int:slot_id>/toggle-status", methods=["POST"])
@login_required
@permission_required("availability", "edit")
def availability_toggle_status(slot_id):
    user = get_current_admin()
    slot = AvailabilitySlot.query.get_or_404(slot_id)
    slot.is_active = not slot.is_active
    db.session.commit()

    status_label = "Active (Bookable)" if slot.is_active else "Blocked"
    AuditService.log(
        action="AVAILABILITY_SLOT_TOGGLE",
        module="services",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="AvailabilitySlot",
        entity_id=str(slot.id),
        details={"is_active": slot.is_active},
    )
    flash(f"Slot {slot.start_time} status changed to {status_label}.", "info")
    return redirect(url_for("services.availability_list"))


@services_bp.route("/availability/<int:slot_id>/delete", methods=["POST", "DELETE"])
@login_required
@permission_required("availability", "delete")
def availability_delete(slot_id):
    user = get_current_admin()
    slot = AvailabilitySlot.query.get_or_404(slot_id)
    
    if slot.booked_count > 0:
        flash(f"Cannot delete slot with {slot.booked_count} confirmed booking(s). Block it instead.", "warning")
        return redirect(url_for("services.availability_list"))

    db.session.delete(slot)
    db.session.commit()

    AuditService.log(
        action="AVAILABILITY_SLOT_DELETE",
        module="services",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="AvailabilitySlot",
        entity_id=str(slot_id),
        details={"date": str(slot.slot_date), "start_time": slot.start_time},
    )
    flash("Availability slot deleted successfully.", "success")
    return redirect(url_for("services.availability_list"))

