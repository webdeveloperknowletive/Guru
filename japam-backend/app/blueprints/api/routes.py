import re
import hmac
import secrets
from urllib.parse import unquote
from decimal import Decimal
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app, session
from sqlalchemy.orm.attributes import flag_modified
from app.extensions import db
from app.models.commerce import Product, Category, Order, OrderItem, Customer, ProductReview
from app.models.service import PujaService, JyotishConsultation, AvailabilitySlot, PujaBooking
from app.models.operations import ReturnRequest, CustomerEnquiry, PaymentTransaction
from app.models.content import Testimonial, BlogPost, GurujiProfile, Banner, AdBanner
from app.models.user import AdminUser

from app.services.auth_service import AuthService
from app.services.commerce_service import CommerceService
from app.services.booking_service import BookingService
from app.services.rate_limit_service import RateLimitService
from app.services.rbac_service import get_current_admin

api_v1_bp = Blueprint("api_v1", __name__, url_prefix="/api/v1")


@api_v1_bp.route("/auth/token", methods=["POST"])
def issue_token():
    """Exchange credentials for JWT access & refresh tokens."""
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    ip_addr = RateLimitService.get_client_ip()
    allowed, _, retry_after = RateLimitService.check_rate_limit(f"api_auth:{ip_addr}", 10, 60)
    if not allowed:
        return jsonify({"error": "Rate limit exceeded", "retry_after": retry_after}), 429

    user, err = AuthService.authenticate_admin(email, password, ip_addr)
    if not user:
        return jsonify({"error": "Unauthorized", "message": err or "Invalid credentials"}), 401

    tokens = AuthService.generate_jwt_tokens(user)
    return jsonify(tokens)


@api_v1_bp.route("/auth/refresh", methods=["POST"])
def refresh_token():
    """Exchange a valid JWT refresh token for a new access token."""
    data = request.get_json() or {}
    token = data.get("refresh_token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return jsonify({"error": "Missing refresh_token"}), 400

    payload = AuthService.verify_jwt(token, token_type="refresh")
    if not payload:
        return jsonify({"error": "Invalid, expired, or revoked refresh token"}), 401

    user_id = payload.get("sub")
    user = AdminUser.query.filter_by(id=user_id, is_active=True).first()
    if not user:
        return jsonify({"error": "User account inactive or not found"}), 401

    tokens = AuthService.generate_jwt_tokens(user)
    return jsonify(tokens)


@api_v1_bp.route("/auth/revoke", methods=["POST"])
def revoke_token():
    """Revoke a JWT token by its JTI claim."""
    data = request.get_json() or {}
    token = data.get("token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return jsonify({"error": "Missing token"}), 400

    payload = AuthService.verify_jwt(token, token_type="access") or AuthService.verify_jwt(token, token_type="refresh")
    if not payload:
        return jsonify({"message": "Token is already expired or invalid"}), 200

    jti = payload.get("jti")
    exp = payload.get("exp", int(datetime.now(timezone.utc).timestamp()) + 3600)
    if jti:
        AuthService.revoke_jwt(jti, exp)

    return jsonify({"message": "Token revoked successfully"}), 200


@api_v1_bp.route("/products", methods=["GET"])
@api_v1_bp.route("/catalog/products", methods=["GET"])
def get_products():
    category_slug = request.args.get("category", "").strip().lower()
    q = Product.query.filter_by(publishing_status="published").filter((Product.is_archived.is_(False)) | (Product.is_archived.is_(None)))

    cat_id_param = request.args.get("category_id")
    if cat_id_param and str(cat_id_param).strip():
        cid_str = str(cat_id_param).strip()
        if cid_str.isdigit():
            q = q.filter(Product.category_id == int(cid_str))
        else:
            category_slug = cid_str.lower()

    if category_slug and category_slug != "all":
        # Handle common category aliases
        alias_map = {
            "gemstones": ["ratna", "gemstones", "ratna-and-gemstones"],
            "ratna": ["ratna", "gemstones", "ratna-and-gemstones"],
            "bracelets": ["bracelets", "spiritual-bracelets"],
            "bracelet": ["bracelets", "spiritual-bracelets"],
            "yantra": ["yantra", "yantras"],
            "rudraksha": ["rudraksha"],
            "mala": ["special-collections", "rudraksha", "mala"],
            "puja-samagri": ["puja-samagri", "puja"],
            "special-collections": ["special-collections"],
        }
        slug_candidates = alias_map.get(category_slug, [category_slug])
        categories = Category.query.filter(Category.slug.in_(slug_candidates)).all()
        if categories:
            cat_ids = [c.id for c in categories]
            q = q.filter(Product.category_id.in_(cat_ids))

    products = q.order_by(Product.display_rank.asc(), Product.created_at.desc(), Product.id.asc()).all()
    results = []
    for p in products:
        results.append({
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "sku": p.sku,
            "display_rank": p.display_rank if getattr(p, "display_rank", None) is not None else 999,
            "rank": p.display_rank if getattr(p, "display_rank", None) is not None else 999,
            "description": p.description or "",
            "price": float(p.price),
            "compare_price": float(p.compare_price) if p.compare_price else None,
            "stock_quantity": p.stock_quantity,
            "is_in_stock": p.stock_quantity > 0,
            "category": p.category.name if p.category else None,
            "category_slug": p.category.slug if p.category else None,
            "certification_status": p.certification_status,
            "thumbnail": p.thumbnail,
            "images": p.images or [],
            "attributes": p.attributes or {},
        })
    resp = jsonify({"count": len(results), "products": results})
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    return resp



@api_v1_bp.route("/catalog/products/<slug>", methods=["GET"])
def get_product_detail(slug):
    """Retrieve detailed product information, images, specs, and approved devotee reviews."""
    p = Product.query.filter_by(slug=slug, publishing_status="published").filter((Product.is_archived.is_(False)) | (Product.is_archived.is_(None))).first()
    if not p:
        return jsonify({"error": f"Product with slug '{slug}' not found"}), 404

    approved_reviews = [
        {
            "id": r.id,
            "customer_name": r.customer_name,
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in p.reviews if r.is_approved
    ]

    resp = jsonify({
        "id": p.id,
        "name": p.name,
        "slug": p.slug,
        "sku": p.sku,
        "display_rank": p.display_rank if getattr(p, "display_rank", None) is not None else 1,
        "description": p.description,
        "price": float(p.price),
        "compare_price": float(p.compare_price) if p.compare_price else None,
        "stock_quantity": p.stock_quantity,
        "low_stock_threshold": p.low_stock_threshold,
        "is_in_stock": p.stock_quantity > 0,
        "category": {
            "id": p.category.id,
            "name": p.category.name,
            "slug": p.category.slug,
        } if p.category else None,
        "certification_status": p.certification_status,
        "thumbnail": p.thumbnail,
        "images": p.images or [],
        "attributes": p.attributes or {},
        "reviews": approved_reviews,
        "review_count": len(approved_reviews),
        "average_rating": (
            round(sum(r["rating"] for r in approved_reviews) / len(approved_reviews), 1)
            if approved_reviews else 5.0
        ),
    })
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    return resp, 200


@api_v1_bp.route("/catalog/products/<slug>/reviews", methods=["POST"])
def submit_product_review(slug):
    """Devotee review submission with initial moderation status (is_approved=False)."""
    p = Product.query.filter_by(slug=slug, publishing_status="published").filter(
        (Product.is_archived.is_(False)) | (Product.is_archived.is_(None))
    ).first()
    if not p:
        return jsonify({"error": f"Product with slug '{slug}' not found"}), 404

    data = request.get_json() or {}
    # Google reCAPTCHA v2 verification
    captcha_token = data.get("recaptcha_token") or data.get("captcha_token") or data.get("recaptchaToken")
    remote_ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    if remote_ip and "," in remote_ip:
        remote_ip = remote_ip.split(",")[0].strip()

    from app.services.captcha_service import CaptchaService
    is_valid, captcha_err = CaptchaService.verify(captcha_token, remote_ip)
    if not is_valid:
        return jsonify({"error": captcha_err}), 400

    name = (data.get("customer_name") or data.get("name") or "").strip()
    email = (data.get("customer_email") or data.get("email") or "").strip().lower()
    comment = (data.get("comment") or data.get("review") or "").strip()
    rating = data.get("rating", 5)

    if not name or not email or not comment:
        return jsonify({"error": "customer_name, customer_email, and comment are required"}), 400

    try:
        rating = int(rating)
        if not (1 <= rating <= 5):
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Rating must be an integer between 1 and 5"}), 400

    review = ProductReview(
        product_id=p.id,
        customer_name=name,
        customer_email=email,
        rating=rating,
        comment=comment,
        is_approved=False,
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(review)
    db.session.commit()

    return jsonify({
        "message": "Review submitted successfully and queued for admin moderation",
        "review_id": review.id,
        "is_approved": False,
    }), 201


@api_v1_bp.route("/catalog/categories", methods=["GET"])
def get_categories():
    categories = Category.query.filter_by(is_active=True).order_by(Category.sort_order.asc()).all()
    results = [
        {
            "id": c.id,
            "name": c.name,
            "title": c.name,
            "slug": c.slug,
            "icon": c.icon,
            "description": c.description,
            "image_url": c.image_url or "",
            "image": c.image_url or "",
        }
        for c in categories
    ]
    return jsonify({"categories": results})


@api_v1_bp.route("/services/puja", methods=["GET"])
def get_puja_services():
    services = (
        PujaService.query.filter_by(is_active=True)
        .order_by(PujaService.display_order.asc(), PujaService.id.asc())
        .all()
    )
    results = [
        {
            "id": s.id,
            "name": s.name,
            "title": s.name,
            "slug": s.slug,
            "deity": s.deity,
            "icon": s.icon or "🪔",
            "desc": s.description or "",
            "description": s.description or "",
            "price": float(s.price),
            "duration_minutes": s.duration_minutes,
            "display_order": s.display_order,
            "is_online_available": s.is_online_available,
            "is_offline_available": s.is_offline_available,
            "inclusions": s.inclusions,
            "image_url": s.image_url,
            "image": s.image_url,
        }
        for s in services
    ]
    return jsonify({"puja_services": results})


@api_v1_bp.route("/services/availability", methods=["GET"])
def get_availability_slots():
    """Retrieve bookable availability slots for Puja rituals or Jyotish consultations."""
    service_type = request.args.get("service_type", "").strip().lower()
    date_str = request.args.get("date", "").strip()

    q = AvailabilitySlot.query.filter_by(is_active=True)

    if service_type in ("puja", "jyotish"):
        q = q.filter(AvailabilitySlot.service_type == service_type)

    if date_str:
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
            try:
                target_date = datetime.strptime(date_str, fmt).date()
                q = q.filter(AvailabilitySlot.slot_date == target_date)
                break
            except ValueError:
                pass
    else:
        # Default: list from today onwards
        today = datetime.now(timezone.utc).date()
        q = q.filter(AvailabilitySlot.slot_date >= today)

    slots = q.order_by(AvailabilitySlot.slot_date.asc(), AvailabilitySlot.start_time.asc()).all()

    results = []
    for s in slots:
        available_spots = max(0, s.max_capacity - s.booked_count)
        results.append({
            "id": s.id,
            "service_type": s.service_type,
            "slot_date": s.slot_date.strftime("%Y-%m-%d"),
            "start_time": s.start_time,
            "end_time": s.end_time,
            "time_window": f"{s.start_time} - {s.end_time}" if s.end_time else s.start_time,
            "max_capacity": s.max_capacity,
            "booked_count": s.booked_count,
            "available_spots": available_spots,
            "is_full": available_spots <= 0,
            "is_active": s.is_active,
            "assigned_priest_or_astrologer": s.assigned_priest_or_astrologer,
            "notes": s.notes or "",
        })

    resp = jsonify({"count": len(results), "slots": results})
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return resp


@api_v1_bp.route("/services/book-puja", methods=["POST"])
def book_puja():
    data = request.get_json() or {}
    # Google reCAPTCHA v2 verification
    captcha_token = data.get("recaptcha_token") or data.get("captcha_token") or data.get("recaptchaToken")
    remote_ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    if remote_ip and "," in remote_ip:
        remote_ip = remote_ip.split(",")[0].strip()

    from app.services.captcha_service import CaptchaService
    is_valid, captcha_err = CaptchaService.verify(captcha_token, remote_ip)
    if not is_valid:
        return jsonify({"error": captcha_err}), 400


    customer_name = (data.get("customer_name") or data.get("name") or "").strip()
    raw_email = (data.get("customer_email") or data.get("email") or "").strip()
    customer_email = raw_email if raw_email else ""
    customer_phone = str(data.get("customer_phone") or data.get("phone") or "").strip()
    booking_date_raw = data.get("booking_date") or data.get("preferred_date") or data.get("date")
    time_slot = (data.get("time_slot") or data.get("time") or data.get("timeSlot") or "10:00 AM").strip()
    service_id = data.get("service_id")
    location = (data.get("location") or "").strip() or None
    address = (data.get("address") or "").strip() or None
    gotra = (data.get("gotra") or "").strip() or None
    nakshatra = (data.get("nakshatra") or "").strip() or None
    rashi = (data.get("rashi") or "").strip() or None
    sankalp_text = (data.get("sankalp_text") or data.get("sankalp") or "").strip() or None

    if not customer_name:
        return jsonify({"error": "Field 'customer_name' (or 'name') is required"}), 400
    if not customer_phone:
        return jsonify({"error": "Field 'customer_phone' (or 'phone') is required"}), 400
    if not booking_date_raw:
        return jsonify({"error": "Field 'booking_date' is required"}), 400

    # Auto-resolve service_id if missing or string
    if not service_id:
        puja_name = data.get("puja_name") or data.get("puja_title") or data.get("service_name")
        if puja_name:
            matched = PujaService.query.filter(PujaService.is_active == True, PujaService.name.ilike(f"%{puja_name}%")).first()
            if matched:
                service_id = matched.id
        if not service_id:
            first_svc = PujaService.query.filter_by(is_active=True).first()
            if first_svc:
                service_id = first_svc.id
            else:
                return jsonify({"error": "No active puja service found"}), 400

    try:
        service_id = int(service_id)
        # Parse booking date with multiple common formats
        if isinstance(booking_date_raw, str):
            for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
                try:
                    booking_date = datetime.strptime(booking_date_raw.strip(), fmt).date()
                    break
                except ValueError:
                    pass
            else:
                return jsonify({"error": "Invalid date format. Expected YYYY-MM-DD"}), 400
        else:
            booking_date = booking_date_raw

        from app.services.payment_mode_service import PaymentModeService
        from app.services.whatsapp_service import WhatsAppNotificationService

        current_payment_mode = PaymentModeService.get_payment_mode()
        chosen_method = data.get("payment_method") or ("Offline Payment" if current_payment_mode == "offline" else "Online Gateway")

        # Duplicate prevention guard: return existing booking if identical submission within 30s
        from datetime import timedelta
        recent_cutoff = datetime.now(timezone.utc) - timedelta(seconds=30)
        existing_booking = PujaBooking.query.filter(
            PujaBooking.customer_phone == customer_phone,
            PujaBooking.service_id == service_id,
            PujaBooking.booking_date == booking_date,
            PujaBooking.time_slot == time_slot,
            PujaBooking.created_at >= recent_cutoff,
        ).order_by(PujaBooking.id.desc()).first()

        raw_booking_type = (data.get("booking_type") or data.get("bookingType") or "whatsapp").strip().lower()
        effective_booking_type = "whatsapp" if "whatsapp" in raw_booking_type else raw_booking_type
        effective_payment_mode = "whatsapp" if effective_booking_type == "whatsapp" else current_payment_mode
        effective_payment_method = "WhatsApp Booking" if effective_booking_type == "whatsapp" else chosen_method

        if existing_booking:
            booking = existing_booking
        else:
            booking = BookingService.book_puja_slot(
                service_id=service_id,
                customer_name=customer_name,
                customer_email=customer_email,
                customer_phone=customer_phone,
                booking_date=booking_date,
                time_slot=time_slot,
                booking_type=effective_booking_type,
                gotra=gotra,
                nakshatra=nakshatra,
                rashi=rashi,
                sankalp_text=sankalp_text,
                location=location,
                address=address,
                payment_mode=effective_payment_mode,
                payment_method=effective_payment_method,
                status="pending" if effective_booking_type == "whatsapp" else None,
            )

        # Create or update initial PaymentTransaction for Puja Booking
        svc_price = booking.service.price if booking.service else Decimal("0.00")
        txn_number = f"TXN-PUJ-{booking.id}"
        existing_p_txn = PaymentTransaction.query.filter_by(transaction_number=txn_number).first()
        is_p_offline = current_payment_mode == "offline" or booking.booking_type == "whatsapp"
        if not existing_p_txn:
            p_txn = PaymentTransaction(
                transaction_number=txn_number,
                booking_id=booking.id,
                amount=svc_price,
                currency="INR",
                gateway="WhatsApp / Offline" if is_p_offline else "Razorpay",
                payment_method="WhatsApp Booking" if is_p_offline else "Razorpay",
                status="pending" if is_p_offline else "initiated",
                customer_name=booking.customer_name,
                customer_email=booking.customer_email,
                customer_phone=booking.customer_phone,
                item_summary=booking.service.name if booking.service else "Vedic Puja Seva",
                source_form="Puja Booking",
                form_submission_id=booking.booking_number,
                created_at=datetime.now(timezone.utc),
            )
            db.session.add(p_txn)
            db.session.commit()
        else:
            p_txn = existing_p_txn

        # Trigger admin WhatsApp alert safely
        wa_result = WhatsAppNotificationService.send_admin_alert(
            module_name="Puja Booking (WhatsApp)" if booking.booking_type == "whatsapp" else "Puja Booking",
            reference_id=booking.booking_number,
            customer_name=booking.customer_name,
            customer_phone=booking.customer_phone,
            customer_email=booking.customer_email,
            amount=float(booking.service.price) if booking.service else None,
            payment_mode="whatsapp" if booking.booking_type == "whatsapp" else current_payment_mode,
            payment_status=booking.status,
            admin_url="/admin/services/bookings",
            extra_info=f"Service: {booking.service.name if booking.service else 'Puja'} | Date: {booking.booking_date} ({booking.time_slot}) | Mode: {booking.booking_type.upper()}",
        )

        resp = {
            "message": "Puja booking created successfully" if current_payment_mode == "online" else "Puja booking submitted successfully. Offline payment pending confirmation.",
            "booking_number": booking.booking_number,
            "amount_paid": float(booking.amount_paid),
            "dakshina_amount": float(booking.service.price) if booking.service else 0.0,
            "amount": float(booking.service.price) if booking.service else 0.0,
            "customer_name": booking.customer_name,
            "devotee_name": booking.customer_name,
            "name": booking.customer_name,
            "status": booking.status,
            "payment_mode": current_payment_mode,
            "payment_method": chosen_method,
            "whatsapp_notification_status": wa_result.get("status") if 'wa_result' in locals() else None,
        }
        if current_payment_mode == "online" and booking.service and booking.service.price > 0:
            try:
                from app.services.razorpay_service import RazorpayService
                amount_paise = int(booking.service.price * 100)
                clean_receipt = f"puj_{booking.booking_number.replace('#', '').replace('-', '')}"[:40]
                rzp_res = RazorpayService.create_order(
                    amount_paise=amount_paise,
                    receipt=clean_receipt,
                    notes={
                        "booking_number": booking.booking_number,
                        "booking_id": str(booking.id),
                        "customer_email": booking.customer_email,
                        "service_name": booking.service.name,
                    }
                )
                resp["razorpay"] = {
                    "order_id": rzp_res["razorpay_order_id"],
                    "amount": rzp_res["amount"],
                    "currency": rzp_res["currency"],
                    "key_id": rzp_res["key_id"],
                }
            except Exception as e:
                current_app.logger.warning(f"Could not auto-generate Razorpay order on puja booking: {e}")

        if current_payment_mode == "offline":
            resp["offline_payment_instructions"] = PaymentModeService.get_offline_payment_instructions()
            resp["offline_qr_code"] = PaymentModeService.get_offline_qr_code()

        return jsonify(resp), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400



@api_v1_bp.route("/services/request-consultation", methods=["POST"])
def request_consultation():
    data = request.get_json() or {}
    # Google reCAPTCHA v2 verification
    captcha_token = data.get("recaptcha_token") or data.get("captcha_token") or data.get("recaptchaToken")
    remote_ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    if remote_ip and "," in remote_ip:
        remote_ip = remote_ip.split(",")[0].strip()

    from app.services.captcha_service import CaptchaService
    is_valid, captcha_err = CaptchaService.verify(captcha_token, remote_ip)
    if not is_valid:
        return jsonify({"error": captcha_err}), 400


    customer_name = (data.get("customer_name") or data.get("name") or "").strip()
    customer_email = (data.get("customer_email") or data.get("email") or "").strip()
    customer_phone = (data.get("customer_phone") or data.get("phone") or "").strip()
    service_id = (data.get("service_id") or "").strip()
    topic = (data.get("topic") or data.get("consultation_topic") or "General Jyotish Consultation").strip()

    # Birth details extraction (supports direct fields or person1 in marriage matching)
    person1 = data.get("person1") or {}
    dob_raw = (
        data.get("dob")
        or data.get("date_of_birth")
        or person1.get("dob")
        or data.get("preferred_date")
        or data.get("event_start_date")
    )
    time_unknown = data.get("time_unknown") or person1.get("time_unknown") or False
    tob = "Time Unknown" if time_unknown else (data.get("tob") or data.get("time") or person1.get("tob") or "10:00 AM").strip()
    pob = (data.get("pob") or data.get("place") or person1.get("pob") or data.get("event_city") or "Not Specified").strip()

    if not customer_name:
        return jsonify({"error": "Field 'customer_name' (or 'name') is required"}), 400
    if not customer_phone:
        return jsonify({"error": "Field 'customer_phone' (or 'phone') is required"}), 400

    if not customer_email and customer_phone:
        customer_email = f"{customer_phone.replace('+', '').replace(' ', '')}@astroveda.in"
    elif not customer_email:
        customer_email = "devotee@astroveda.in"

    # Resolve date of birth or fall back safely for services without required DOB (e.g. Muhurat)
    dob = None
    if dob_raw:
        if isinstance(dob_raw, str):
            for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
                try:
                    dob = datetime.strptime(dob_raw.strip(), fmt).date()
                    break
                except ValueError:
                    pass
        elif hasattr(dob_raw, "year"):
            dob = dob_raw

    if not dob:
        # For services where DOB is optional, default to today's date for database constraint
        dob = datetime.now(timezone.utc).date()

    # Trusted backend pricing calculation and server-side package validation
    sid = (service_id or "").strip().lower()
    raw_pkg = (data.get("package_type") or data.get("package") or "").strip().lower().replace("-", "_")

    if sid == "janma-kundali":
        if raw_pkg in ("soft_copy", "soft"):
            payable_amount = Decimal("101.00")
            package_type = "soft-copy"
            package_name = "Soft Copy — Digital Kundali Report"
        elif raw_pkg in ("hard_copy", "hard", ""):
            payable_amount = Decimal("1001.00")
            package_type = "hard-copy"
            package_name = "Hard Copy — Printed Hard Copy with Kundali Consultation"
        else:
            return jsonify({
                "error": f"Invalid package '{raw_pkg}' for Janma Kundali Preparation. Expected 'hard-copy' or 'soft-copy'."
            }), 400
    else:
        # All other seven consultation services under Diwali Special Offer (₹201 -> ₹101)
        payable_amount = Decimal("101.00")
        package_type = None
        package_name = "Diwali Special Offer (₹101)"

    # Reject client-side price tampering if client explicitly submitted an amount
    client_amount = data.get("amount") or data.get("fee") or data.get("amount_paid")
    if client_amount is not None:
        try:
            if Decimal(str(client_amount)) != payable_amount:
                return jsonify({
                    "error": f"Invalid consultation fee. Expected ₹{payable_amount:,.0f}, received ₹{client_amount}."
                }), 400
        except Exception:
            return jsonify({"error": "Invalid amount format."}), 400

    # Compile comprehensive, structured astrologer notes for admin & consultation review
    notes_lines = [
        f"--- {topic} ({service_id or 'General'}) ---",
        f"Contact Person: {customer_name} | Phone: {customer_phone} | Email: {customer_email}",
    ]
    if sid == "janma-kundali":
        notes_lines.append(f"Package: {package_name} | Fee: ₹{payable_amount:,.0f}")
    else:
        notes_lines.append(f"Special Offer: Diwali Special Offer (₹201 -> ₹101) | Fee: ₹{payable_amount:,.0f}")

    # Marriage matching details
    groom_name = None
    bride_name = None
    if service_id == "marriage-matching" or data.get("person2"):
        p2 = data.get("person2") or {}
        groom_name = (person1.get("name") or "").strip() or "Not Specified"
        bride_name = (p2.get("name") or "").strip() or "Not Specified"
        notes_lines.append(f"Male / Groom Details: {groom_name} | DOB: {person1.get('dob')} | TOB: {'Unknown' if person1.get('time_unknown') else person1.get('tob', 'N/A')} | POB: {person1.get('pob', 'N/A')}")
        notes_lines.append(f"Female / Bride Details: {bride_name} | DOB: {p2.get('dob')} | TOB: {'Unknown' if p2.get('time_unknown') else p2.get('tob', 'N/A')} | POB: {p2.get('pob', 'N/A')}")
        if data.get("marriage_period"):
            notes_lines.append(f"Preferred Marriage Period: {data.get('marriage_period')}")
        if data.get("proposed_wedding_date"):
            notes_lines.append(f"Proposed Wedding Date: {data.get('proposed_wedding_date')}")
        if data.get("compatibility_question"):
            notes_lines.append(f"Compatibility Question: {data.get('compatibility_question')}")

    # Muhurat details
    elif service_id == "muhurat-selection" or data.get("event_type"):
        notes_lines.append(f"Event Type: {data.get('event_type')}{' - ' + data.get('event_type_other') if data.get('event_type_other') else ''}")
        notes_lines.append(f"Event Location: {data.get('event_city', pob)}")
        notes_lines.append(f"Dates: {data.get('event_start_date')} to {data.get('event_end_date', 'N/A')} (Flexible: {'Yes' if data.get('flexible_dates') else 'No'})")
        if data.get("preferred_time_window"):
            notes_lines.append(f"Time Window: {data.get('preferred_time_window')}")
        if data.get("has_birth_details") and data.get("person_name"):
            notes_lines.append(f"Personal Details for Muhurat: {data.get('person_name')} | DOB: {data.get('dob')} | TOB: {tob} | POB: {pob}")

    # Career & Business details
    elif service_id == "career-business" or data.get("guidance_category"):
        notes_lines.append(f"Guidance Category: {data.get('guidance_category')}{' - ' + data.get('category_other') if data.get('category_other') else ''}")
        if data.get("current_profession"):
            notes_lines.append(f"Current Profession: {data.get('current_profession')}")
        if data.get("business_name_type"):
            notes_lines.append(f"Business Name/Type: {data.get('business_name_type')}")
        if data.get("main_challenge"):
            notes_lines.append(f"Main Challenge: {data.get('main_challenge')}")

    # Finance & Wealth details
    elif service_id == "finance-wealth" or data.get("financial_topic"):
        notes_lines.append(f"Financial Topic: {data.get('financial_topic')}{' - ' + data.get('topic_other') if data.get('topic_other') else ''}")
        if data.get("financial_goal"):
            notes_lines.append(f"Financial Goal / Concern: {data.get('financial_goal')}")

    # Gemstone & Rudraksha details
    elif service_id == "gemstone-rudraksha" or data.get("request_type"):
        notes_lines.append(f"Request Type: {data.get('request_type')} | Purpose: {data.get('recommendation_purpose')}")
        if data.get("existing_items"):
            notes_lines.append(f"Existing / Desired Items: {data.get('existing_items')}")

    # General question & context
    if data.get("customer_question"):
        notes_lines.append(f"Customer Question: {data.get('customer_question')}")
    if data.get("specific_question"):
        notes_lines.append(f"Specific Query: {data.get('specific_question')}")
    if data.get("additional_context"):
        notes_lines.append(f"Additional Context: {data.get('additional_context')}")
    if data.get("notes") or data.get("msg"):
        notes_lines.append(f"Customer Notes: {data.get('notes') or data.get('msg')}")

    # Preferred date / scheduled date & availability slot lock
    time_slot = (data.get("time_slot") or data.get("slot_time") or "").strip()
    slot_id = data.get("slot_id")
    scheduled_at = None
    pref_date = None
    pref_date_raw = data.get("preferred_date") or data.get("date")

    if pref_date_raw:
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
            try:
                parsed_d = datetime.strptime(pref_date_raw.strip(), fmt)
                scheduled_at = parsed_d.replace(tzinfo=timezone.utc)
                pref_date = parsed_d.date()
                break
            except Exception:
                pass

    slot = None
    if slot_id:
        try:
            slot = AvailabilitySlot.query.filter_by(id=int(slot_id), is_active=True).with_for_update().first()
        except Exception:
            slot = None

    if not slot and pref_date and time_slot:
        clean_time = time_slot.split("-")[0].strip() if "-" in time_slot else time_slot.strip()
        slot = AvailabilitySlot.query.filter(
            AvailabilitySlot.service_type == "jyotish",
            AvailabilitySlot.slot_date == pref_date,
            (AvailabilitySlot.start_time == clean_time) | (AvailabilitySlot.start_time == time_slot.strip()),
            AvailabilitySlot.is_active == True,
        ).with_for_update().first()

    astrologer_name = "Nagesh Swami Guruji"
    if slot:
        if slot.booked_count >= slot.max_capacity:
            return jsonify({"error": f"The consultation slot '{slot.start_time}' on {slot.slot_date} is fully booked."}), 400
        slot.booked_count += 1
        if slot.assigned_priest_or_astrologer:
            astrologer_name = slot.assigned_priest_or_astrologer
        notes_lines.append(f"Confirmed Slot: {slot.start_time} - {slot.end_time} on {slot.slot_date} (Scholar: {astrologer_name})")
    elif time_slot:
        notes_lines.append(f"Preferred Time Slot: {time_slot}")

    from app.services.payment_mode_service import PaymentModeService
    from app.services.whatsapp_service import WhatsAppNotificationService

    current_payment_mode = PaymentModeService.get_payment_mode()
    chosen_method = data.get("payment_method") or ("Offline Payment" if current_payment_mode == "offline" else "Online Video Consultation")

    if current_payment_mode == "offline":
        notes_lines.append(f"Payment Mode: OFFLINE PAYMENT (Pending Devotee Confirmation) | Method: {chosen_method}")
    else:
        notes_lines.append(f"Payment Mode: ONLINE (Standard Gateway) | Method: {chosen_method}")

    full_astrologer_notes = "\n".join(notes_lines)

    try:
        from app.services.sequence_service import SequenceService
        consult_num = SequenceService.next_consultation_number()

        consultation = JyotishConsultation(
            consultation_number=consult_num,
            customer_name=customer_name,
            customer_email=customer_email,
            customer_phone=customer_phone,
            dob=dob,
            tob=tob,
            pob=pob,
            topic=topic,
            consultation_type=data.get("consultation_type") or data.get("mode") or "online_video",
            scheduled_at=scheduled_at,
            status="pending",
            astrologer_name=astrologer_name,
            astrologer_notes=full_astrologer_notes,
            amount_paid=payable_amount,
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(consultation)
        db.session.commit()

        # Trigger admin WhatsApp alert safely
        # Note: Sensitive birth particulars (DOB/TOB/POB) are maintained strictly within
        # the authenticated admin panel to preserve devotee privacy and consent standards.
        wa_extra = f"Topic: {consultation.topic} | Fee: ₹{payable_amount:,.0f}"
        if sid == "janma-kundali":
            wa_extra = f"Topic: Janma Kundali Preparation | Package: {package_name} | Fee: ₹{payable_amount:,.0f}"
        elif (sid == "marriage-matching" or data.get("person2")) and groom_name and bride_name:
            wa_extra = f"Topic: Marriage Kundali Matching | Contact Person: {consultation.customer_name} | Groom: {groom_name} | Bride: {bride_name} | Diwali Offer Fee: ₹{payable_amount:,.0f}"

        # Create or update initial PaymentTransaction for Consultation
        txn_number = f"TXN-CNS-{consultation.id}"
        existing_c_txn = PaymentTransaction.query.filter_by(transaction_number=txn_number).first()
        is_c_offline = current_payment_mode == "offline"
        if not existing_c_txn:
            c_txn = PaymentTransaction(
                transaction_number=txn_number,
                consultation_id=consultation.id,
                amount=payable_amount,
                currency="INR",
                gateway="WhatsApp / Offline" if is_c_offline else "Razorpay",
                payment_method="Offline Payment" if is_c_offline else "Razorpay",
                status="pending" if is_c_offline else "initiated",
                customer_name=consultation.customer_name,
                customer_email=consultation.customer_email,
                customer_phone=consultation.customer_phone,
                item_summary=consultation.topic or "Jyotish Consultation",
                source_form="Consultation Booking",
                form_submission_id=consultation.consultation_number,
                created_at=datetime.now(timezone.utc),
            )
            db.session.add(c_txn)
            db.session.commit()
        else:
            c_txn = existing_c_txn

        wa_result = WhatsAppNotificationService.send_admin_alert(
            module_name="Jyotish Consultation",
            reference_id=consultation.consultation_number,
            customer_name=consultation.customer_name,
            customer_phone=consultation.customer_phone,
            customer_email=consultation.customer_email,
            amount=float(consultation.amount_paid),
            payment_mode=current_payment_mode,
            payment_status=consultation.status,
            admin_url="/admin/services/consultations",
            extra_info=wa_extra,
        )

        resp = {
            "message": "Jyotish consultation request submitted successfully" if current_payment_mode == "online" else "Jyotish consultation submitted successfully. Offline payment pending confirmation.",
            "consultation_number": consultation.consultation_number,
            "topic": consultation.topic,
            "status": consultation.status,
            "payment_mode": current_payment_mode,
            "payment_method": chosen_method,
            "amount_paid": float(consultation.amount_paid),
            "fee": float(consultation.amount_paid),
            "package_type": package_type,
            "package_name": package_name if sid == "janma-kundali" else None,
            "whatsapp_notification_status": wa_result.get("status"),
        }

        # Auto-create Razorpay order for online consultation flow
        if current_payment_mode == "online" and payable_amount > 0:
            try:
                from app.services.razorpay_service import RazorpayService
                amount_paise = int(payable_amount * 100)
                clean_receipt = f"cns_{consultation.consultation_number.replace('#', '').replace('-', '')}"[:40]
                rzp_res = RazorpayService.create_order(
                    amount_paise=amount_paise,
                    receipt=clean_receipt,
                    notes={
                        "consultation_number": consultation.consultation_number,
                        "consultation_id": str(consultation.id),
                        "customer_email": consultation.customer_email,
                        "topic": consultation.topic,
                    }
                )
                if c_txn:
                    c_txn.gateway_order_id = rzp_res["razorpay_order_id"]
                    db.session.commit()
                resp["razorpay"] = {
                    "order_id": rzp_res["razorpay_order_id"],
                    "amount": rzp_res["amount"],
                    "currency": rzp_res["currency"],
                    "key_id": rzp_res["key_id"],
                }
            except Exception as e:
                current_app.logger.warning(f"Could not auto-generate Razorpay order on consultation: {e}")

        if current_payment_mode == "offline":
            resp["offline_payment_instructions"] = PaymentModeService.get_offline_payment_instructions()
            resp["offline_qr_code"] = PaymentModeService.get_offline_qr_code()

        return jsonify(resp), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400



@api_v1_bp.route("/services/consultations", methods=["GET"])
def get_consultations_info():
    """Return Jyotish consultation packages, pricing, topic categories, and astrologer profile."""
    guruji = GurujiProfile.query.first()
    packages = [
        {
            "id": "kundali-analysis",
            "title": "Complete Kundali & Life Guidance · संपूर्ण जन्मकुंडली फलादेश",
            "topic": "Kundali Consultation",
            "duration": "45-60 mins",
            "price": 1500.0,
            "description": "सखोल जन्मकुंडली विश्लेषण, ग्रहदोष, महादशा व अंतर्दशा फलादेश, उपाय आणि मार्गदर्शन.",
            "mode": "Online Video / Phone / In-Person",
            "badge": "Popular",
        },
        {
            "id": "marriage-compatibility",
            "title": "Marriage & Kundali Matchmaking · विवाह कुंडली मिलन",
            "topic": "Marriage Matchmaking",
            "duration": "30-45 mins",
            "price": 1200.0,
            "description": "गुण मिलन, मंगळ दोष, नाडी दोष व वैवाहिक जीवनातील सुख-शांतीसाठी अचूक ज्योतिषीय तोडगे.",
            "mode": "Online Video / Phone",
            "badge": "Vedic Match",
        },
        {
            "id": "career-business",
            "title": "Career, Job & Business Growth · करिअर व व्यवसाय मार्गदर्शन",
            "topic": "Career & Business Guidance",
            "duration": "30-45 mins",
            "price": 1500.0,
            "description": "नोकरी, व्यवसाय निवड, पदोन्नती, आर्थिक समस्या व शुभ मुहूर्तांची शास्त्रोक्त निवड.",
            "mode": "Online Video / Phone",
            "badge": "Career",
        },
        {
            "id": "gemstone-rudraksha",
            "title": "Gemstone & Rudraksha Recommendation · रत्न व रुद्राक्ष निवड",
            "topic": "Gemstone & Rudraksha Guidance",
            "duration": "30 mins",
            "price": 800.0,
            "description": "राशी व लग्नानुसार कोणते रत्न किंवा रुद्राक्ष धारण करावे याचे शास्त्रशुद्ध परीक्षण.",
            "mode": "Online / Phone",
            "badge": "Guidance",
        },
        {
            "id": "muhurat-selection",
            "title": "Auspicious Muhurat · शुभ मुहूर्त शोध",
            "topic": "Muhurat Selection",
            "duration": "20 mins",
            "price": 750.0,
            "description": "गृहप्रवेश, लग्न, नामकरण, वाहन खरेदी व नवीन व्यवसाय सुरू करण्यासाठी अचूक मुहूर्त.",
            "mode": "Phone / WhatsApp Report",
            "badge": "Timing",
        },
    ]

    return jsonify({
        "astrologer": {
            "name": guruji.full_title if guruji else "पं. रवींद्र शास्त्री जोशी",
            "lineage": guruji.spiritual_lineage if guruji and guruji.spiritual_lineage else "Vedic Parampara",
            "contact_phone": guruji.contact_phone if guruji and guruji.contact_phone else "+91 9000000000",
            "experience_years": 25,
            "total_consultations": 10000,
        },
        "base_fee": 1500.0,
        "packages": packages,
        "topics": [
            "Kundali Consultation",
            "Marriage Matchmaking",
            "Career & Business Guidance",
            "Finance & Wealth",
            "Health & Longevity",
            "Muhurat Selection",
            "Gemstone & Rudraksha Guidance",
            "Vastu Consultation",
        ],
    }), 200


@api_v1_bp.route("/cart/calculate", methods=["POST"])
def calculate_cart():
    """
    Strict server-side price, coupon, tax, shipping, and stock validation.
    Client-sent prices or totals are completely ignored and never trusted.
    """
    data = request.get_json() or {}
    raw_items = data.get("items", [])
    coupon_code = data.get("coupon_code", "").strip().upper()

    if not raw_items:
        return jsonify({
            "items": [],
            "subtotal": 0.0,
            "discount_amount": 0.0,
            "tax_amount": 0.0,
            "shipping_amount": 0.0,
            "total_amount": 0.0,
        }), 200

    validated_items = []
    subtotal = Decimal("0.00")

    for item in raw_items:
        prod_id = item.get("product_id")
        try:
            qty = int(item.get("quantity", 1))
        except (ValueError, TypeError):
            return jsonify({"error": "Quantity must be an integer"}), 400

        if qty <= 0:
            return jsonify({"error": "Item quantity must be greater than zero"}), 400

        product = Product.query.filter_by(id=prod_id, publishing_status="published").filter((Product.is_archived.is_(False)) | (Product.is_archived.is_(None))).first()
        if not product:
            return jsonify({"error": f"Product ID {prod_id} is unavailable or discontinued"}), 400

        if product.stock_quantity < qty:
            return jsonify({
                "error": f"Insufficient stock for '{product.name}'. Available: {product.stock_quantity}, Requested: {qty}"
            }), 400

        unit_price = product.price
        line_total = unit_price * qty
        subtotal += line_total

        validated_items.append({
            "product_id": product.id,
            "name": product.name,
            "sku": product.sku,
            "unit_price": float(unit_price),
            "quantity": qty,
            "line_total": float(line_total),
            "thumbnail": product.thumbnail,
            "stock_quantity": product.stock_quantity,
        })

    # Validate coupon if provided
    discount_amount = Decimal("0.00")
    coupon_applied = None
    if coupon_code:
        from app.models.operations import Coupon
        coupon = Coupon.query.filter_by(code=coupon_code, is_active=True).first()
        if coupon and coupon.is_valid_for(subtotal):
            customer_email = (data.get("email") or data.get("customer_email") or "").strip().lower()
            if coupon.code == "WELCOME10" and customer_email:
                from app.models.commerce import Order
                existing_completed = Order.query.filter(
                    Order.customer_email == customer_email,
                    Order.payment_status.in_(["paid", "pending", "completed"])
                ).first()
                if existing_completed:
                    return jsonify({"error": f"Coupon '{coupon_code}' is only valid for first-time orders"}), 400

            discount_amount = coupon.calculate_discount(subtotal)
            coupon_applied = {
                "code": coupon.code,
                "discount_type": coupon.discount_type,
                "discount_value": float(coupon.discount_value),
            }
        elif coupon:
            return jsonify({"error": f"Coupon '{coupon_code}' requires a minimum order of ₹{coupon.min_order_amount}"}), 400
        else:
            return jsonify({"error": f"Invalid or expired coupon '{coupon_code}'"}), 400

    taxable = max(Decimal("0.00"), subtotal - discount_amount)
    # GST on spiritual items / handicraft: 3% standard rate
    tax_amount = (taxable * Decimal("0.03")).quantize(Decimal("0.01"))
    # Free shipping on orders over ₹999, else standard ₹99 courier charge
    shipping_amount = Decimal("0.00") if taxable >= Decimal("999.00") else Decimal("99.00")
    total_amount = taxable + tax_amount + shipping_amount

    return jsonify({
        "items": validated_items,
        "subtotal": float(subtotal),
        "discount_amount": float(discount_amount),
        "coupon_applied": coupon_applied,
        "tax_amount": float(tax_amount),
        "shipping_amount": float(shipping_amount),
        "total_amount": float(total_amount),
    }), 200


@api_v1_bp.route("/orders/checkout", methods=["POST"])
def api_checkout():
    """
    Atomic checkout order creation with row locking, server-calculated totals,
    idempotency enforcement, and secure high-entropy access tokens.
    """
    import secrets
    data = request.get_json() or {}
    # Google reCAPTCHA v2 verification
    captcha_token = data.get("recaptcha_token") or data.get("captcha_token") or data.get("recaptchaToken")
    remote_ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    if remote_ip and "," in remote_ip:
        remote_ip = remote_ip.split(",")[0].strip()

    from app.services.captcha_service import CaptchaService
    is_valid, captcha_err = CaptchaService.verify(captcha_token, remote_ip)
    if not is_valid:
        return jsonify({"error": captcha_err}), 400

    customer_name = data.get("customer_name", "").strip()
    customer_email = data.get("customer_email", "").strip().lower()
    customer_phone = data.get("customer_phone", "").strip()
    raw_shipping_addr = data.get("shipping_address", "")
    cust_city = str(data.get("city") or "").strip()
    cust_state = str(data.get("state") or "").strip()
    cust_pincode = str(data.get("pincode") or data.get("postal_code") or "").strip()
    if isinstance(raw_shipping_addr, dict):
        cust_city = cust_city or str(raw_shipping_addr.get("city") or "").strip()
        cust_state = cust_state or str(raw_shipping_addr.get("state") or "").strip()
        cust_pincode = cust_pincode or str(raw_shipping_addr.get("pincode") or raw_shipping_addr.get("postal_code") or "").strip()
        parts = [
            raw_shipping_addr.get("address_line1"),
            raw_shipping_addr.get("address_line2"),
            raw_shipping_addr.get("city"),
            raw_shipping_addr.get("state"),
            raw_shipping_addr.get("pincode") or raw_shipping_addr.get("postal_code"),
        ]
        shipping_address = ", ".join([str(p).strip() for p in parts if p and str(p).strip()])
    else:
        shipping_address = str(raw_shipping_addr or "").strip()
    payment_method = data.get("payment_method", "Razorpay")
    raw_items = data.get("items", [])
    coupon_code = data.get("coupon_code", "").strip().upper()
    idempotency_key = (request.headers.get("Idempotency-Key") or data.get("idempotency_key") or "").strip()

    if not customer_name or not customer_email or not shipping_address:
        return jsonify({"error": "Customer name, email, and shipping address are required"}), 400

    if not raw_items:
        return jsonify({"error": "Cart cannot be empty"}), 400

    # Mandatory Return & Cancellation Policy acceptance enforcement
    policy_accepted = data.get("policy_accepted")
    if policy_accepted not in (True, "true", "True", 1, "1"):
        return jsonify({"error": "Please review and accept the Return, Refund, and Cancellation policy to proceed with checkout."}), 400
    policy_version = str(data.get("policy_version") or "v1.0-2026").strip()

    from app.services.payment_mode_service import PaymentModeService
    from app.services.whatsapp_service import WhatsAppNotificationService

    current_payment_mode = PaymentModeService.get_payment_mode()
    client_payment_mode = str(data.get("payment_mode") or "").strip().lower()
    raw_method_check = str(data.get("payment_method") or "").strip().lower()
    is_cod = raw_method_check in ("cash on delivery", "cod", "pay on delivery")

    # Payment mode & method resolution
    if is_cod:
        order_payment_method = "COD"
        order_payment_status = "cod_pending"
        order_cod_status = "cod_pending"
        notes_record = "Payment Mode: CASH ON DELIVERY (COD Pending Verification)"
    elif current_payment_mode == "offline":
        if client_payment_mode == "online" or raw_method_check in ("razorpay", "online", "card"):
            return jsonify({"error": "Store is currently in Offline Payment Mode. Online checkout is disabled."}), 400
        order_payment_method = "Offline Payment"
        order_payment_status = "offline_pending"
        order_cod_status = None
        notes_record = "Payment Mode: OFFLINE PAYMENT (WhatsApp / Direct Devotee Confirmation)"
    else:
        if client_payment_mode == "offline" or raw_method_check in ("offline payment", "whatsapp order", "whatsapp checkout", "offline / direct upi / bank transfer"):
            return jsonify({"error": "Store is currently in Online Payment Mode. Offline checkout is disabled."}), 400
        order_payment_method = "Razorpay"
        order_payment_status = "pending"
        order_cod_status = None
        notes_record = "Payment Mode: ONLINE GATEWAY (Awaiting Verification/Capture)"

    # Idempotency check: if client sent an idempotency key and order exists, return existing order
    if idempotency_key:
        existing_order = Order.query.filter_by(idempotency_key=idempotency_key).first()
        if existing_order:
            return jsonify({
                "message": "Order already processed (idempotent)",
                "order_id": existing_order.id,
                "order_number": existing_order.order_number,
                "access_token": existing_order.access_token,
                "total_amount": float(existing_order.total_amount),
                "payment_status": existing_order.payment_status,
                "order_status": existing_order.order_status,
            }), 200

    try:
        # Atomic transaction: with_for_update row locking on products
        subtotal = Decimal("0.00")
        line_items_to_create = []

        for item in raw_items:
            prod_id = item.get("product_id")
            qty = int(item.get("quantity", 1))
            if qty <= 0:
                raise ValueError("Quantity must be positive")

            prod = Product.query.filter_by(id=prod_id).with_for_update().first()
            if not prod or prod.publishing_status != "published" or prod.is_archived:
                raise ValueError(f"Product ID {prod_id} is unavailable")

            if prod.stock_quantity < qty:
                raise ValueError(f"Insufficient stock for {prod.name}. Only {prod.stock_quantity} left.")

            # Decrement stock atomically (stock reservation)
            prod.stock_quantity -= qty
            line_total = prod.price * qty
            subtotal += line_total

            line_items_to_create.append({
                "product": prod,
                "product_name": prod.name,
                "sku": prod.sku,
                "unit_price": prod.price,
                "quantity": qty,
                "total_price": line_total,
            })

        # Calculate discount
        discount_amount = Decimal("0.00")
        if coupon_code:
            from app.models.operations import Coupon
            coupon = Coupon.query.filter_by(code=coupon_code, is_active=True).with_for_update().first()
            if coupon and coupon.is_valid_for(subtotal):
                if coupon.code == "WELCOME10":
                    from app.models.commerce import Order as OrderModel
                    existing_completed = OrderModel.query.filter(
                        OrderModel.customer_email == customer_email,
                        OrderModel.payment_status.in_(["paid", "pending", "completed"])
                    ).first()
                    if existing_completed:
                        raise ValueError(f"Coupon '{coupon_code}' is only valid for first-time orders")

                discount_amount = coupon.calculate_discount(subtotal)
                coupon.used_count += 1
            else:
                raise ValueError(f"Coupon '{coupon_code}' is invalid or expired")

        taxable = max(Decimal("0.00"), subtotal - discount_amount)
        tax_amount = (taxable * Decimal("0.03")).quantize(Decimal("0.01"))
        shipping_amount = Decimal("0.00") if taxable >= Decimal("999.00") else Decimal("99.00")
        total_amount = taxable + tax_amount + shipping_amount

        # Find or create customer
        customer = Customer.query.filter_by(email=customer_email).first()
        if not customer:
            customer = Customer(
                full_name=customer_name,
                email=customer_email,
                phone=customer_phone,
                city=cust_city or None,
                state=cust_state or None,
                pincode=cust_pincode or None,
                address=shipping_address,
                total_orders=1,
                total_spent=total_amount,
                is_active=True,
            )
            db.session.add(customer)
            db.session.flush()
        else:
            customer.total_orders += 1
            customer.total_spent += total_amount
            if customer_phone:
                customer.phone = customer_phone
            if cust_city:
                customer.city = cust_city
            if cust_state:
                customer.state = cust_state
            if cust_pincode:
                customer.pincode = cust_pincode
            if shipping_address:
                customer.address = shipping_address

        # Concurrency-safe sequential serial order number generation (#ORD1091, #ORD1092, ...)
        import re
        all_order_records = db.session.query(Order.order_number).all()
        max_seq = 1000
        for (onum,) in all_order_records:
            if onum:
                m = re.search(r'ORD(\d+)', onum, re.IGNORECASE)
                if m:
                    try:
                        val = int(m.group(1))
                        if val > max_seq:
                            max_seq = val
                    except ValueError:
                        pass

        candidate_seq = max_seq + 1
        for attempt in range(50):
            candidate_num = f"#ORD{candidate_seq + attempt}"
            if not Order.query.filter_by(order_number=candidate_num).first():
                order_number = candidate_num
                break
        else:
            order_number = f"#ORD{max_seq + 100}"

        # Generate high-entropy order access token for customer ownership protection
        order_access_token = secrets.token_urlsafe(32)

        order = Order(
            order_number=order_number,
            customer_id=customer.id,
            customer_name=customer_name,
            customer_email=customer_email,
            customer_phone=customer_phone,
            shipping_address=shipping_address,
            subtotal=subtotal,
            discount_amount=discount_amount,
            tax_amount=tax_amount,
            total_amount=total_amount,
            order_status="pending",
            payment_status=order_payment_status,
            payment_method=order_payment_method,
            cod_status=order_cod_status,
            policy_accepted_at=datetime.now(timezone.utc),
            policy_version=policy_version,
            admin_notes=notes_record,
            access_token=order_access_token,
            idempotency_key=idempotency_key if idempotency_key else None,
            placed_at=datetime.now(timezone.utc),
        )
        db.session.add(order)
        db.session.flush()

        for item_data in line_items_to_create:
            order_item = OrderItem(
                order_id=order.id,
                product_id=item_data["product"].id,
                product_name=item_data["product_name"],
                sku=item_data["sku"],
                unit_price=item_data["unit_price"],
                quantity=item_data["quantity"],
                total_price=item_data["total_price"],
            )
            db.session.add(order_item)

        db.session.commit()

        # Create or update PaymentTransaction record for comprehensive admin tracking
        line_summary = ", ".join([f"{it['product_name']} x{it['quantity']}" for it in line_items_to_create[:3]])
        txn_number = f"TXN-{order.order_number.replace('#', '')}"
        existing_txn = PaymentTransaction.query.filter_by(transaction_number=txn_number).first()
        if not existing_txn:
            initial_status = "cod_pending" if order_payment_method == "COD" else ("pending" if current_payment_mode == "offline" else "initiated")
            initial_gateway = "COD" if order_payment_method == "COD" else ("WhatsApp / Offline" if current_payment_mode == "offline" else "Razorpay")
            txn = PaymentTransaction(
                transaction_number=txn_number,
                order_id=order.id,
                amount=order.total_amount,
                currency="INR",
                gateway=initial_gateway,
                payment_method=order_payment_method,
                status=initial_status,
                customer_name=order.customer_name,
                customer_email=order.customer_email,
                customer_phone=order.customer_phone,
                item_summary=line_summary,
                source_form="Store Checkout",
                form_submission_id=order.order_number,
                created_at=datetime.now(timezone.utc),
            )
            db.session.add(txn)
            db.session.commit()
        else:
            txn = existing_txn

        # Trigger admin WhatsApp alert safely without rollback
        wa_result = WhatsAppNotificationService.send_admin_alert(
            module_name="Product Order (COD)" if order.payment_method == "COD" else "Product Order",
            reference_id=order.order_number,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            customer_email=order.customer_email,
            amount=float(order.total_amount),
            payment_mode=current_payment_mode,
            payment_status=order.payment_status,
            admin_url=f"/admin/commerce/orders/{order.id}",
            extra_info=f"{len(line_items_to_create)} item(s) | Method: {order.payment_method}",
        )

        response_payload = {
            "message": "Order placed successfully" if current_payment_mode == "online" else "Order submitted successfully. Offline payment pending confirmation.",
            "order_id": order.id,
            "order_number": order.order_number,
            "access_token": order.access_token,
            "total_amount": float(order.total_amount),
            "payment_status": order.payment_status,
            "payment_method": order.payment_method,
            "payment_mode": current_payment_mode,
            "offline_payment": current_payment_mode == "offline",
            "order_status": order.order_status,
            "whatsapp_notification_status": wa_result.get("status"),
        }

        if current_payment_mode == "online" and order.payment_method == "Razorpay":
            try:
                from app.services.razorpay_service import RazorpayService
                amount_paise = int(order.total_amount * 100)
                receipt = f"rcpt_{order.order_number.replace('#', '')}"[:40]
                rzp_res = RazorpayService.create_order(
                    amount_paise=amount_paise,
                    receipt=receipt,
                    notes={
                        "order_number": order.order_number,
                        "order_id": str(order.id),
                        "customer_email": order.customer_email,
                        "customer_phone": order.customer_phone or "",
                    }
                )
                response_payload["razorpay"] = {
                    "order_id": rzp_res["razorpay_order_id"],
                    "amount": rzp_res["amount"],
                    "currency": rzp_res["currency"],
                    "key_id": rzp_res["key_id"],
                }
            except Exception as e:
                current_app.logger.warning(f"Could not auto-generate Razorpay order on checkout: {e}")

        if current_payment_mode == "offline":
            instr = PaymentModeService.get_offline_payment_instructions()
            response_payload["offline_payment_instructions"] = instr
            response_payload["offline_instructions"] = instr
            response_payload["offline_qr_code"] = PaymentModeService.get_offline_qr_code()

        return jsonify(response_payload), 201

    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to place order: {str(e)}"}), 500


@api_v1_bp.route("/payments/webhook", methods=["POST"])
def payment_webhook():
    """
    Payment Gateway Webhook (Razorpay) with HMAC-SHA256 signature verification,
    idempotency checking, amount mismatch rejection, and order/puja/consultation status transition.
    Supports events: payment.captured, order.paid, payment.failed, refund.processed, refund.created.
    """
    import hmac
    import hashlib
    from app.extensions import redis_client

    raw_payload = request.get_data(as_text=True)
    signature = request.headers.get("X-Razorpay-Signature") or request.headers.get("X-Webhook-Signature")
    webhook_secret = current_app.config.get("PAYMENT_WEBHOOK_SECRET") or current_app.config.get("RAZORPAY_KEY_SECRET")

    # Fail closed: never process webhooks without configured secret
    if not webhook_secret:
        current_app.logger.error("PAYMENT_WEBHOOK_SECRET not configured. Webhook rejected.")
        return jsonify({"error": "Payment webhook is not configured"}), 500

    if not signature:
        return jsonify({"error": "Missing webhook signature header"}), 401

    # Verify HMAC-SHA256 signature
    expected_sig = hmac.new(
        webhook_secret.encode("utf-8"),
        raw_payload.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_sig):
        return jsonify({"error": "Invalid webhook signature"}), 401

    data = request.get_json(silent=True) or {}
    event_id = data.get("event_id") or data.get("id")

    # Idempotency check: prevent duplicate event processing
    if event_id and redis_client:
        try:
            cache_key = f"wh:event:{event_id}"
            if redis_client.exists(cache_key):
                return jsonify({"status": "duplicate_event_ignored", "event_id": event_id}), 200
            redis_client.setex(cache_key, 86400, "1")
        except Exception as e:
            current_app.logger.warning(f"Redis idempotency check warning: {e}")

    payload = data.get("payload", {})
    payment_obj = payload.get("payment", {}).get("entity", {}) if "payment" in payload else data
    refund_obj = payload.get("refund", {}).get("entity", {}) if "refund" in payload else {}

    notes = payment_obj.get("notes", {}) or {}
    order_number = payment_obj.get("order_number") or notes.get("order_number")
    booking_number = payment_obj.get("booking_number") or notes.get("booking_number")
    consultation_number = payment_obj.get("consultation_number") or notes.get("consultation_number")
    receipt = payment_obj.get("receipt", "")

    # Fallback receipt parsing
    if not order_number and not booking_number and not consultation_number and receipt:
        if receipt.startswith("rcpt_ORD"):
            order_number = f"#{receipt[5:]}"
        elif receipt.startswith("puj_PUJ"):
            booking_number = f"#PUJ-{receipt[7:]}"
        elif receipt.startswith("cns_CNS"):
            consultation_number = f"#CNS-{receipt[7:]}"

    amount_in_paise = payment_obj.get("amount")  # in paise
    gateway_payment_id = payment_obj.get("id", f"pay_wh_{int(datetime.now(timezone.utc).timestamp())}")
    gateway_order_id = payment_obj.get("order_id")
    event_type = data.get("event")

    # Handle refund event
    if event_type in ("refund.processed", "refund.created") or refund_obj:
        ref_payment_id = refund_obj.get("payment_id") or gateway_payment_id
        ref_amount = Decimal(refund_obj.get("amount", 0)) / Decimal("100.0") if refund_obj.get("amount") else Decimal("0.00")
        txn = PaymentTransaction.query.filter(
            (PaymentTransaction.gateway_payment_id == ref_payment_id) |
            (PaymentTransaction.gateway_order_id == gateway_order_id)
        ).first()

        if txn:
            txn.refund_status = "refunded"
            txn.refund_amount = ref_amount if ref_amount > 0 else txn.amount
            txn.status = "refunded"
            txn.updated_at = datetime.now(timezone.utc)
            if txn.order:
                txn.order.payment_status = "refunded"
            db.session.commit()
            return jsonify({"status": "refund_processed", "transaction_number": txn.transaction_number}), 200

    # Handle payment failure event
    if event_type == "payment.failed":
        fail_txn_num = f"TXN-FAIL-{gateway_payment_id}"
        existing_fail = PaymentTransaction.query.filter_by(transaction_number=fail_txn_num).first()
        if not existing_fail:
            error_desc = payment_obj.get("error_description") or "Webhook: Payment failed"
            txn = PaymentTransaction(
                transaction_number=fail_txn_num,
                amount=Decimal(amount_in_paise or 0) / Decimal("100.0") if amount_in_paise else Decimal("0.00"),
                currency="INR",
                gateway="Razorpay",
                gateway_payment_id=gateway_payment_id,
                gateway_order_id=gateway_order_id,
                status="failed",
                customer_name=payment_obj.get("notes", {}).get("customer_name") or "Devotee",
                customer_email=payment_obj.get("email"),
                customer_phone=payment_obj.get("contact"),
                error_message=error_desc,
                created_at=datetime.now(timezone.utc),
            )
            if order_number:
                order = _find_order(order_number)
                if order:
                    txn.order_id = order.id
                    txn.customer_name = order.customer_name
                    txn.source_form = "Store Checkout"
                    txn.form_submission_id = order.order_number
            elif booking_number:
                booking = PujaBooking.query.filter_by(booking_number=str(booking_number).strip()).first()
                if booking:
                    txn.booking_id = booking.id
                    txn.customer_name = booking.customer_name
                    txn.source_form = "Puja Booking"
                    txn.form_submission_id = booking.booking_number
            elif consultation_number:
                cns = JyotishConsultation.query.filter_by(consultation_number=str(consultation_number).strip()).first()
                if cns:
                    txn.consultation_id = cns.id
                    txn.customer_name = cns.customer_name
                    txn.source_form = "Consultation Booking"
                    txn.form_submission_id = cns.consultation_number

            db.session.add(txn)
            db.session.commit()
        return jsonify({"status": "payment_failure_recorded", "gateway_payment_id": gateway_payment_id}), 200

    # Successful payment capture: Order, PujaBooking, or Consultation
    if order_number:
        order = _find_order(order_number)
        if not order:
            return jsonify({"error": f"Order '{order_number}' not found"}), 404

        if amount_in_paise is not None:
            expected_paise = int(order.total_amount * 100)
            if int(amount_in_paise) != expected_paise:
                return jsonify({
                    "error": "Payment amount mismatch",
                    "received_amount": amount_in_paise,
                    "expected_amount": expected_paise
                }), 400

        if order.payment_status != "paid":
            order.payment_status = "paid"
            if order.order_status == "pending":
                order.order_status = "processing"

            txn_number = f"TXN-{order.order_number.replace('#', '')}-{gateway_payment_id}"
            txn = PaymentTransaction.query.filter_by(transaction_number=txn_number).first()
            if not txn:
                base_txn = PaymentTransaction.query.filter_by(order_id=order.id).order_by(PaymentTransaction.id.desc()).first()
                if base_txn and base_txn.status != "captured":
                    txn = base_txn
                    txn.transaction_number = txn_number
                    txn.gateway_payment_id = gateway_payment_id
                    txn.gateway_order_id = gateway_order_id
                    txn.status = "captured"
                    txn.payment_method = "Razorpay"
                    txn.updated_at = datetime.now(timezone.utc)
                else:
                    txn = PaymentTransaction(
                        transaction_number=txn_number,
                        order_id=order.id,
                        amount=order.total_amount,
                        currency="INR",
                        gateway="Razorpay",
                        gateway_payment_id=gateway_payment_id,
                        gateway_order_id=gateway_order_id,
                        status="captured",
                        payment_method="Razorpay",
                        customer_name=order.customer_name,
                        customer_email=order.customer_email,
                        customer_phone=order.customer_phone,
                        item_summary=f"Order {order.order_number}",
                        source_form="Store Checkout",
                        form_submission_id=order.order_number,
                        created_at=datetime.now(timezone.utc),
                    )
                    db.session.add(txn)
            else:
                txn.status = "captured"
                txn.updated_at = datetime.now(timezone.utc)

            db.session.commit()

        return jsonify({"status": "payment_processed", "order_number": order.order_number}), 200

    elif booking_number:
        booking = PujaBooking.query.filter_by(booking_number=str(booking_number).strip()).first()
        if not booking:
            return jsonify({"error": f"Booking '{booking_number}' not found"}), 404

        svc_price = booking.service.price if booking.service else Decimal("0.00")
        booking.status = "confirmed"
        booking.amount_paid = svc_price

        txn_number = f"TXN-PUJ-{booking.id}-{gateway_payment_id}"
        txn = PaymentTransaction.query.filter_by(transaction_number=txn_number).first()
        if not txn:
            base_p = PaymentTransaction.query.filter_by(booking_id=booking.id).order_by(PaymentTransaction.id.desc()).first()
            if base_p and base_p.status != "captured":
                txn = base_p
                txn.transaction_number = txn_number
                txn.gateway_payment_id = gateway_payment_id
                txn.gateway_order_id = gateway_order_id
                txn.status = "captured"
                txn.payment_method = "Razorpay"
                txn.updated_at = datetime.now(timezone.utc)
            else:
                txn = PaymentTransaction(
                    transaction_number=txn_number,
                    booking_id=booking.id,
                    amount=svc_price,
                    currency="INR",
                    gateway="Razorpay",
                    gateway_payment_id=gateway_payment_id,
                    gateway_order_id=gateway_order_id,
                    status="captured",
                    payment_method="Razorpay",
                    customer_name=booking.customer_name,
                    customer_email=booking.customer_email,
                    customer_phone=booking.customer_phone,
                    item_summary=booking.service.name if booking.service else "Vedic Puja Seva",
                    source_form="Puja Booking",
                    form_submission_id=booking.booking_number,
                    created_at=datetime.now(timezone.utc),
                )
                db.session.add(txn)
        else:
            txn.status = "captured"
            txn.updated_at = datetime.now(timezone.utc)

        db.session.commit()
        return jsonify({"status": "booking_payment_processed", "booking_number": booking.booking_number}), 200

    elif consultation_number:
        cns = JyotishConsultation.query.filter_by(consultation_number=str(consultation_number).strip()).first()
        if not cns:
            return jsonify({"error": f"Consultation '{consultation_number}' not found"}), 404

        cns_amount = cns.amount_paid if cns.amount_paid > 0 else Decimal("101.00")
        cns.status = "confirmed"
        cns.amount_paid = cns_amount

        txn_number = f"TXN-CNS-{cns.id}-{gateway_payment_id}"
        txn = PaymentTransaction.query.filter_by(transaction_number=txn_number).first()
        if not txn:
            base_c = PaymentTransaction.query.filter_by(consultation_id=cns.id).order_by(PaymentTransaction.id.desc()).first()
            if base_c and base_c.status != "captured":
                txn = base_c
                txn.transaction_number = txn_number
                txn.gateway_payment_id = gateway_payment_id
                txn.gateway_order_id = gateway_order_id
                txn.status = "captured"
                txn.payment_method = "Razorpay"
                txn.updated_at = datetime.now(timezone.utc)
            else:
                txn = PaymentTransaction(
                    transaction_number=txn_number,
                    consultation_id=cns.id,
                    amount=cns_amount,
                    currency="INR",
                    gateway="Razorpay",
                    gateway_payment_id=gateway_payment_id,
                    gateway_order_id=gateway_order_id,
                    status="captured",
                    payment_method="Razorpay",
                    customer_name=cns.customer_name,
                    customer_email=cns.customer_email,
                    customer_phone=cns.customer_phone,
                    item_summary=cns.topic or "Jyotish Consultation",
                    source_form="Consultation Booking",
                    form_submission_id=cns.consultation_number,
                    created_at=datetime.now(timezone.utc),
                )
                db.session.add(txn)
        else:
            txn.status = "captured"
            txn.updated_at = datetime.now(timezone.utc)

        db.session.commit()
        return jsonify({"status": "consultation_payment_processed", "consultation_number": cns.consultation_number}), 200

    return jsonify({"error": "Missing order_number, booking_number, or consultation_number"}), 400


def _verify_order_ownership(order):
    """
    Ensure the caller owns this order to prevent IDOR attacks.
    Supports:
    1. Authenticated Admin User via Bearer JWT token in Authorization header.
    2. High-entropy order access_token (passed via X-Order-Token header, ?token= param, or JSON body).
    3. Customer email verification (passed via X-Customer-Email header, ?email= param, JSON body, or session).
    """
    # Check Admin authorization
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        payload = AuthService.verify_jwt(token, token_type="access")
        if payload:
            user_id = payload.get("sub")
            admin = AdminUser.query.filter_by(id=user_id, is_active=True).first()
            if admin:
                return True, None

    # Check high-entropy order access token
    req_json = request.get_json(silent=True) or {}
    token_candidate = (
        request.headers.get("X-Order-Token")
        or request.args.get("token")
        or req_json.get("access_token")
        or req_json.get("token")
    )
    if order.access_token and token_candidate:
        if hmac.compare_digest(str(token_candidate).strip(), str(order.access_token).strip()):
            return True, None

    # Check customer email verification (for order tracking or devotee self-service)
    client_email = (
        request.headers.get("X-Customer-Email")
        or request.args.get("email")
        or req_json.get("email")
        or req_json.get("customer_email")
        or session.get("devotee_email")
    )
    if client_email and order.customer_email:
        if str(client_email).strip().lower() == str(order.customer_email).strip().lower():
            return True, None

    return False, "You are not authorized to access this order (invalid order credentials or email mismatch)"



def _find_order(order_number):
    if not order_number:
        return None
    cleaned = str(order_number).strip()
    if "%" in cleaned:
        cleaned = unquote(cleaned).strip()
        if "%" in cleaned:
            cleaned = unquote(cleaned).strip()

    order = Order.query.filter_by(order_number=cleaned).first()
    if not order and not cleaned.startswith("#"):
        order = Order.query.filter_by(order_number=f"#{cleaned}").first()
    if not order and cleaned.startswith("#"):
        order = Order.query.filter_by(order_number=cleaned[1:]).first()
    if not order:
        # If user passed only digits (e.g., '1090' or '1112'), check for #ORD1090
        digits = re.sub(r'[^\d]', '', cleaned)
        if digits:
            order = Order.query.filter(
                (Order.order_number == f"#ORD{digits}") |
                (Order.order_number == f"ORD{digits}")
            ).first()
    return order


# --------------------------------------------------------------------------
# Razorpay Payment Endpoints (Test Mode)
# --------------------------------------------------------------------------
@api_v1_bp.route("/payments/create-order", methods=["POST"])
def payment_create_order():
    """
    Creates an authoritative Razorpay payment order for an existing Order or PujaBooking.
    Server calculates authoritative amount from database record (never trusts client amount).
    Validates ownership to prevent IDOR attacks.
    """
    data = request.get_json() or {}
    order_number = data.get("order_number") or data.get("order_id")
    booking_number = data.get("booking_number") or data.get("booking_id")
    consultation_number = data.get("consultation_number") or data.get("consultation_id")

    if not order_number and not booking_number and not consultation_number:
        return jsonify({"error": "order_number, booking_number, or consultation_number is required"}), 400

    from app.services.razorpay_service import RazorpayService
    from app.services.payment_mode_service import PaymentModeService

    current_mode = PaymentModeService.get_payment_mode()
    if current_mode == "offline":
        return jsonify({"error": "Store is currently in Offline Payment Mode. Online checkout is disabled."}), 400

    if order_number:
        order = _find_order(order_number)
        if not order:
            return jsonify({"error": f"Order '{order_number}' not found"}), 404

        is_owner, err_msg = _verify_order_ownership(order)
        if not is_owner:
            return jsonify({"error": err_msg or "Unauthorized"}), 403

        if order.payment_method == "Offline Payment" or order.payment_status == "offline_pending":
            return jsonify({"error": "Cannot verify online payment for an offline order."}), 400

        if order.payment_status == "paid":
            return jsonify({"error": "Order is already paid"}), 400

        if order.payment_method == "Offline Payment" or order.payment_status == "offline_pending":
            return jsonify({"error": "Cannot create online payment order for an offline order."}), 400

        amount_paise = int(order.total_amount * 100)
        receipt = f"rcpt_{order.order_number.replace('#', '')}"[:40]
        notes = {
            "order_number": order.order_number,
            "order_id": str(order.id),
            "customer_email": order.customer_email,
            "customer_phone": order.customer_phone or "",
            "type": "product_order",
        }

        try:
            rzp_res = RazorpayService.create_order(
                amount_paise=amount_paise,
                receipt=receipt,
                notes=notes,
            )
            return jsonify({
                "success": True,
                "order_number": order.order_number,
                "order_id": order.id,
                "amount": rzp_res["amount"],
                "currency": rzp_res["currency"],
                "razorpay_order_id": rzp_res["razorpay_order_id"],
                "key_id": rzp_res["key_id"],
                "customer_name": order.customer_name,
                "customer_email": order.customer_email,
                "customer_phone": order.customer_phone or "",
            }), 200
        except Exception as e:
            current_app.logger.error(f"Razorpay order creation failed: {e}")
            return jsonify({"error": f"Failed to initialize payment: {str(e)}"}), 500

    elif booking_number:
        booking = PujaBooking.query.filter_by(booking_number=str(booking_number).strip()).first()
        if not booking:
            return jsonify({"error": f"Booking '{booking_number}' not found"}), 404

        if booking.status in ("confirmed", "completed") and booking.amount_paid > 0:
            return jsonify({"error": "Puja booking is already confirmed and paid"}), 400

        svc_price = booking.service.price if booking.service else Decimal("0.00")
        amount_paise = int(svc_price * 100)
        clean_receipt = f"puj_{booking.booking_number.replace('#', '').replace('-', '')}"[:40]
        notes = {
            "booking_number": booking.booking_number,
            "booking_id": str(booking.id),
            "customer_email": booking.customer_email,
            "type": "puja_booking",
        }

        try:
            rzp_res = RazorpayService.create_order(
                amount_paise=amount_paise,
                receipt=clean_receipt,
                notes=notes,
            )
            return jsonify({
                "success": True,
                "booking_number": booking.booking_number,
                "booking_id": booking.id,
                "amount": rzp_res["amount"],
                "currency": rzp_res["currency"],
                "razorpay_order_id": rzp_res["razorpay_order_id"],
                "key_id": rzp_res["key_id"],
                "customer_name": booking.customer_name,
                "customer_email": booking.customer_email,
                "customer_phone": booking.customer_phone or "",
            }), 200
        except Exception as e:
            current_app.logger.error(f"Razorpay order creation failed for booking: {e}")
            return jsonify({"error": f"Failed to initialize booking payment: {str(e)}"}), 500

    elif consultation_number:
        consultation = JyotishConsultation.query.filter_by(consultation_number=str(consultation_number).strip()).first()
        if not consultation:
            return jsonify({"error": f"Consultation '{consultation_number}' not found"}), 404

        if consultation.status in ("confirmed", "completed") and consultation.amount_paid > 0:
            return jsonify({"error": "Consultation is already confirmed and paid"}), 400

        c_amount = consultation.amount_paid if consultation.amount_paid > 0 else Decimal("101.00")
        amount_paise = int(c_amount * 100)
        clean_receipt = f"cns_{consultation.consultation_number.replace('#', '').replace('-', '')}"[:40]
        notes = {
            "consultation_number": consultation.consultation_number,
            "consultation_id": str(consultation.id),
            "customer_email": consultation.customer_email,
            "topic": consultation.topic,
            "type": "consultation_booking",
        }

        try:
            rzp_res = RazorpayService.create_order(
                amount_paise=amount_paise,
                receipt=clean_receipt,
                notes=notes,
            )
            c_txn = PaymentTransaction.query.filter_by(consultation_id=consultation.id).order_by(PaymentTransaction.id.desc()).first()
            if not c_txn:
                c_txn = PaymentTransaction(
                    transaction_number=f"TXN-CNS-{consultation.id}",
                    consultation_id=consultation.id,
                    amount=c_amount,
                    currency="INR",
                    gateway="Razorpay",
                    gateway_order_id=rzp_res["razorpay_order_id"],
                    status="initiated",
                    customer_name=consultation.customer_name,
                    customer_email=consultation.customer_email,
                    customer_phone=consultation.customer_phone,
                    item_summary=consultation.topic,
                    source_form="Consultation Booking",
                    form_submission_id=consultation.consultation_number,
                    created_at=datetime.now(timezone.utc),
                )
                db.session.add(c_txn)
            else:
                c_txn.gateway_order_id = rzp_res["razorpay_order_id"]
                c_txn.status = "initiated"
            db.session.commit()

            return jsonify({
                "success": True,
                "consultation_number": consultation.consultation_number,
                "consultation_id": consultation.id,
                "amount": rzp_res["amount"],
                "currency": rzp_res["currency"],
                "razorpay_order_id": rzp_res["razorpay_order_id"],
                "key_id": rzp_res["key_id"],
                "customer_name": consultation.customer_name,
                "customer_email": consultation.customer_email,
                "customer_phone": consultation.customer_phone or "",
            }), 200
        except Exception as e:
            current_app.logger.error(f"Razorpay consultation order creation failed: {e}")
            return jsonify({"error": f"Failed to initialize payment: {str(e)}"}), 500


@api_v1_bp.route("/payments/verify", methods=["POST"])
def payment_verify():
    """
    Authoritative verification of Razorpay payment signature.
    Updates database only upon cryptographic signature verification.
    Idempotent: Duplicate verification requests do not duplicate transactions or corrupt status.
    """
    data = request.get_json() or {}
    order_number = data.get("order_number")
    booking_number = data.get("booking_number")
    consultation_number = data.get("consultation_number")
    razorpay_order_id = data.get("razorpay_order_id")
    razorpay_payment_id = data.get("razorpay_payment_id")
    razorpay_signature = data.get("razorpay_signature")

    if not razorpay_payment_id or not razorpay_signature:
        return jsonify({"error": "razorpay_payment_id and razorpay_signature are required"}), 400

    from app.services.razorpay_service import RazorpayService
    from app.services.audit_service import AuditService
    from app.services.whatsapp_service import WhatsAppNotificationService
    from app.services.payment_mode_service import PaymentModeService

    current_mode = PaymentModeService.get_payment_mode()
    if current_mode == "offline":
        return jsonify({"error": "Store is currently in Offline Payment Mode. Online payment verification is disabled."}), 400

    # Cryptographic signature verification using official Razorpay SDK
    valid, err = RazorpayService.verify_payment_signature(
        razorpay_order_id=razorpay_order_id,
        razorpay_payment_id=razorpay_payment_id,
        razorpay_signature=razorpay_signature,
    )
    if not valid:
        AuditService.log(
            action="PAYMENT_SIGNATURE_FAILED",
            module="commerce",
            actor_email=data.get("email") or "customer",
            entity_type="Order",
            entity_id=str(order_number or booking_number or ""),
            details={"error": err, "razorpay_payment_id": razorpay_payment_id},
        )
        return jsonify({"error": "Invalid payment signature", "details": err}), 400

    if order_number:
        order = _find_order(order_number)
        if not order:
            return jsonify({"error": f"Order '{order_number}' not found"}), 404

        is_owner, err_msg = _verify_order_ownership(order)
        if not is_owner:
            return jsonify({"error": err_msg or "Unauthorized"}), 403

        if order.payment_method == "Offline Payment" or order.payment_status == "offline_pending":
            return jsonify({"error": "Cannot verify online payment for an offline order."}), 400

        # Idempotency check: Has this transaction already been recorded or order paid?
        existing_txn = PaymentTransaction.query.filter_by(gateway_payment_id=razorpay_payment_id).first()
        if existing_txn and existing_txn.status == "captured":
            return jsonify({
                "status": "already_verified",
                "message": "Payment has already been verified and recorded",
                "order_number": order.order_number,
                "payment_status": order.payment_status,
                "transaction_number": existing_txn.transaction_number,
            }), 200

        # Transition order to paid
        order.payment_status = "paid"
        order.payment_method = "Razorpay"
        if order.order_status == "pending":
            order.order_status = "processing"

        txn_number = f"TXN-{order.order_number.replace('#', '')}-{razorpay_payment_id}"
        existing_num = PaymentTransaction.query.filter_by(transaction_number=txn_number).first()
        if not existing_num:
            txn = PaymentTransaction(
                transaction_number=txn_number,
                order_id=order.id,
                amount=order.total_amount,
                currency="INR",
                gateway="Razorpay",
                gateway_payment_id=razorpay_payment_id,
                gateway_order_id=razorpay_order_id,
                status="captured",
                customer_name=order.customer_name,
                customer_email=order.customer_email,
                created_at=datetime.now(timezone.utc),
            )
            db.session.add(txn)

        db.session.commit()

        AuditService.log(
            action="PAYMENT_CAPTURED",
            module="commerce",
            actor_email=order.customer_email,
            entity_type="Order",
            entity_id=str(order.id),
            details={
                "order_number": order.order_number,
                "amount": str(order.total_amount),
                "gateway_payment_id": razorpay_payment_id,
                "gateway_order_id": razorpay_order_id,
            },
        )

        WhatsAppNotificationService.send_admin_alert(
            module_name="Product Order Payment",
            reference_id=order.order_number,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            customer_email=order.customer_email,
            amount=float(order.total_amount),
            payment_mode="online",
            payment_status="paid",
            admin_url=f"/admin/commerce/orders/{order.id}",
            extra_info=f"Razorpay Payment Verified: {razorpay_payment_id}",
        )

        return jsonify({
            "status": "success",
            "message": "Payment verified and order confirmed",
            "order_number": order.order_number,
            "payment_status": order.payment_status,
            "order_status": order.order_status,
            "transaction_number": txn_number,
            "gateway_payment_id": razorpay_payment_id,
        }), 200

    elif booking_number:
        booking = PujaBooking.query.filter_by(booking_number=str(booking_number).strip()).first()
        if not booking:
            return jsonify({"error": f"Booking '{booking_number}' not found"}), 404

        booking_price = booking.service.price if booking.service else Decimal("0.00")
        booking.status = "confirmed"
        booking.amount_paid = booking_price

        txn_number = f"TXN-PUJ-{booking.id}-{razorpay_payment_id}"
        existing_p = PaymentTransaction.query.filter_by(transaction_number=txn_number).first()
        if not existing_p:
            base_p = PaymentTransaction.query.filter_by(booking_id=booking.id).order_by(PaymentTransaction.id.desc()).first()
            if base_p and base_p.status != "captured":
                txn = base_p
                txn.transaction_number = txn_number
                txn.gateway_payment_id = razorpay_payment_id
                txn.gateway_order_id = razorpay_order_id
                txn.status = "captured"
                txn.payment_method = "Razorpay"
                txn.updated_at = datetime.now(timezone.utc)
            else:
                txn = PaymentTransaction(
                    transaction_number=txn_number,
                    booking_id=booking.id,
                    amount=booking_price,
                    currency="INR",
                    gateway="Razorpay",
                    gateway_payment_id=razorpay_payment_id,
                    gateway_order_id=razorpay_order_id,
                    status="captured",
                    payment_method="Razorpay",
                    customer_name=booking.customer_name,
                    customer_email=booking.customer_email,
                    customer_phone=booking.customer_phone,
                    item_summary=booking.service.name if booking.service else "Vedic Puja Seva",
                    source_form="Puja Booking",
                    form_submission_id=booking.booking_number,
                    created_at=datetime.now(timezone.utc),
                )
                db.session.add(txn)
        else:
            existing_p.status = "captured"
            existing_p.updated_at = datetime.now(timezone.utc)

        db.session.commit()

        AuditService.log(
            action="PUJA_PAYMENT_CAPTURED",
            module="services",
            actor_email=booking.customer_email,
            entity_type="PujaBooking",
            entity_id=str(booking.id),
            details={
                "booking_number": booking.booking_number,
                "amount": str(booking_price),
                "gateway_payment_id": razorpay_payment_id,
            },
        )

        return jsonify({
            "status": "success",
            "message": "Puja payment verified and booking confirmed",
            "booking_number": booking.booking_number,
            "booking_status": booking.status,
            "amount_paid": float(booking.amount_paid),
            "transaction_number": txn_number,
            "gateway_payment_id": razorpay_payment_id,
        }), 200

    elif consultation_number:
        consultation = JyotishConsultation.query.filter_by(consultation_number=str(consultation_number).strip()).first()
        if not consultation:
            return jsonify({"error": f"Consultation '{consultation_number}' not found"}), 404

        consult_fee = consultation.amount_paid if consultation.amount_paid > 0 else Decimal("101.00")
        consultation.status = "confirmed"
        consultation.amount_paid = consult_fee

        txn_number = f"TXN-CNS-{consultation.id}-{razorpay_payment_id}"
        existing_c = PaymentTransaction.query.filter_by(transaction_number=txn_number).first()
        if not existing_c:
            base_c = PaymentTransaction.query.filter_by(consultation_id=consultation.id).order_by(PaymentTransaction.id.desc()).first()
            if base_c and base_c.status != "captured":
                txn = base_c
                txn.transaction_number = txn_number
                txn.gateway_payment_id = razorpay_payment_id
                txn.gateway_order_id = razorpay_order_id
                txn.status = "captured"
                txn.payment_method = "Razorpay"
                txn.updated_at = datetime.now(timezone.utc)
            else:
                txn = PaymentTransaction(
                    transaction_number=txn_number,
                    consultation_id=consultation.id,
                    amount=consult_fee,
                    currency="INR",
                    gateway="Razorpay",
                    gateway_payment_id=razorpay_payment_id,
                    gateway_order_id=razorpay_order_id,
                    status="captured",
                    payment_method="Razorpay",
                    customer_name=consultation.customer_name,
                    customer_email=consultation.customer_email,
                    customer_phone=consultation.customer_phone,
                    item_summary=consultation.topic or "Jyotish Consultation",
                    source_form="Consultation Booking",
                    form_submission_id=consultation.consultation_number,
                    created_at=datetime.now(timezone.utc),
                )
                db.session.add(txn)
        else:
            existing_c.status = "captured"
            existing_c.updated_at = datetime.now(timezone.utc)

        db.session.commit()

        AuditService.log(
            action="CONSULTATION_PAYMENT_CAPTURED",
            module="services",
            actor_email=consultation.customer_email,
            entity_type="JyotishConsultation",
            entity_id=str(consultation.id),
            details={
                "consultation_number": consultation.consultation_number,
                "amount": str(consult_fee),
                "gateway_payment_id": razorpay_payment_id,
            },
        )

        return jsonify({
            "status": "success",
            "message": "Consultation payment verified and confirmed",
            "consultation_number": consultation.consultation_number,
            "status": "confirmed",
            "amount_paid": float(consultation.amount_paid),
            "transaction_number": txn_number,
            "gateway_payment_id": razorpay_payment_id,
        }), 200


@api_v1_bp.route("/payments/failure", methods=["POST"])
def payment_failure():
    """
    Records payment failure or checkout cancellation.
    Preserves unpaid/pending state of order so devotee can retry payment.
    Never marks order as paid.
    """
    data = request.get_json() or {}
    order_number = data.get("order_number")
    booking_number = data.get("booking_number")
    error_code = data.get("error_code") or "PAYMENT_CANCELLED"
    error_description = data.get("error_description") or data.get("description") or "Devotee cancelled or closed checkout modal"
    razorpay_order_id = data.get("razorpay_order_id")
    razorpay_payment_id = data.get("razorpay_payment_id")

    from app.services.audit_service import AuditService

    if order_number:
        order = _find_order(order_number)
        if not order:
            return jsonify({"error": f"Order '{order_number}' not found"}), 404

        is_owner, err_msg = _verify_order_ownership(order)
        if not is_owner:
            return jsonify({"error": err_msg or "Unauthorized"}), 403

        if order.payment_method == "Offline Payment" or order.payment_status == "offline_pending":
            return jsonify({"error": "Cannot verify online payment for an offline order."}), 400

        if order.payment_status != "paid":
            fail_txn_num = f"TXN-FAIL-{order.order_number.replace('#', '')}-{int(datetime.now(timezone.utc).timestamp())}"
            txn = PaymentTransaction(
                transaction_number=fail_txn_num,
                order_id=order.id,
                amount=order.total_amount,
                currency="INR",
                gateway="Razorpay",
                gateway_payment_id=razorpay_payment_id or "cancelled",
                gateway_order_id=razorpay_order_id,
                status="failed",
                customer_name=order.customer_name,
                customer_email=order.customer_email,
                error_message=f"[{error_code}] {error_description}",
                created_at=datetime.now(timezone.utc),
            )
            db.session.add(txn)

            order.admin_notes = f"{order.admin_notes or ''}\n[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] Payment Attempt Failed: {error_description}".strip()
            db.session.commit()

            AuditService.log(
                action="PAYMENT_FAILED",
                module="commerce",
                actor_email=order.customer_email,
                entity_type="Order",
                entity_id=str(order.id),
                details={"error_code": error_code, "description": error_description},
            )

        return jsonify({
            "status": "failure_recorded",
            "order_number": order.order_number,
            "payment_status": order.payment_status,
            "message": "Payment failure recorded. Devotee can retry.",
        }), 200

    elif booking_number:
        booking = PujaBooking.query.filter_by(booking_number=str(booking_number).strip()).first()
        if not booking:
            return jsonify({"error": f"Booking '{booking_number}' not found"}), 404

        p_txn = PaymentTransaction.query.filter_by(booking_id=booking.id).order_by(PaymentTransaction.id.desc()).first()
        if p_txn:
            p_txn.status = "failed"
            p_txn.error_message = f"[{error_code}] {error_description}"
            db.session.commit()

        return jsonify({
            "status": "failure_recorded",
            "booking_number": booking.booking_number,
            "booking_status": booking.status,
        }), 200

    elif consultation_number:
        consultation = JyotishConsultation.query.filter_by(consultation_number=str(consultation_number).strip()).first()
        if not consultation:
            return jsonify({"error": f"Consultation '{consultation_number}' not found"}), 404

        c_txn = PaymentTransaction.query.filter_by(consultation_id=consultation.id).order_by(PaymentTransaction.id.desc()).first()
        if c_txn:
            c_txn.status = "failed"
            c_txn.error_message = f"[{error_code}] {error_description}"
            db.session.commit()

        return jsonify({
            "status": "failure_recorded",
            "consultation_number": consultation.consultation_number,
            "consultation_status": consultation.status,
        }), 200

    return jsonify({"error": "order_number, booking_number, or consultation_number is required"}), 400


@api_v1_bp.route("/payments/status/<order_number>", methods=["GET"])
def payment_status(order_number):
    """
    Authenticated check of authoritative payment status and transaction history.
    """
    order = _find_order(order_number)
    if not order:
        return jsonify({"error": f"Order '{order_number}' not found"}), 404

    is_owner, err_msg = _verify_order_ownership(order)
    if not is_owner:
        return jsonify({"error": err_msg or "Unauthorized"}), 403

    transactions = PaymentTransaction.query.filter_by(order_id=order.id).order_by(PaymentTransaction.created_at.desc()).all()
    txn_list = [
        {
            "transaction_number": t.transaction_number,
            "gateway": t.gateway,
            "gateway_payment_id": t.gateway_payment_id,
            "gateway_order_id": t.gateway_order_id,
            "amount": float(t.amount),
            "currency": t.currency,
            "status": t.status,
            "error_message": t.error_message,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in transactions
    ]

    return jsonify({
        "order_number": order.order_number,
        "payment_status": order.payment_status,
        "payment_method": order.payment_method,
        "order_status": order.order_status,
        "total_amount": float(order.total_amount),
        "is_paid": order.payment_status == "paid",
        "transactions": txn_list,
    }), 200


@api_v1_bp.route("/orders/<order_number>", methods=["GET"])
def get_order_tracking(order_number):
    """Devotee order lookup and tracking timeline with ownership verification."""
    order = _find_order(order_number)
    if not order:
        return jsonify({"error": f"Order '{order_number}' not found"}), 404

    authorized, err = _verify_order_ownership(order)
    if not authorized:
        return jsonify({"error": err}), 403

    return jsonify({
        "order_number": order.order_number,
        "customer_name": order.customer_name or "",
        "customer_email": order.customer_email or "",
        "customer_phone": order.customer_phone or "",
        "shipping_address": order.shipping_address or "",
        "order_status": order.order_status or "pending",
        "payment_status": order.payment_status or "pending",
        "payment_method": order.payment_method or "Online",
        "tracking_number": order.tracking_number or "",
        "courier_partner": order.courier_partner or "",
        "placed_at": order.placed_at.isoformat() if order.placed_at else None,
        "subtotal": float(order.subtotal or 0),
        "discount_amount": float(order.discount_amount or 0),
        "tax_amount": float(order.tax_amount or 0),
        "total_amount": float(order.total_amount or 0),
        "items": [
            {
                "product_id": item.product_id,
                "product_name": item.product_name or "",
                "sku": item.sku or "",
                "unit_price": float(item.unit_price or 0),
                "quantity": item.quantity or 1,
                "total_price": float(item.total_price or 0),
            }
            for item in (order.items or [])
        ],
    }), 200


@api_v1_bp.route("/orders/<order_number>/cancel", methods=["POST"])
def cancel_order_api(order_number):
    """Cancel order with customer ownership verification and automatic stock replenishment."""
    order = _find_order(order_number)
    if not order:
        return jsonify({"error": f"Order '{order_number}' not found"}), 404

    authorized, err = _verify_order_ownership(order)
    if not authorized:
        return jsonify({"error": err}), 403

    if order.order_status in ("shipped", "delivered"):
        return jsonify({"error": "Shipped or delivered orders cannot be cancelled directly. Please request a return."}), 400

    if order.order_status == "cancelled":
        return jsonify({"message": "Order is already cancelled", "order_number": order.order_number}), 200

    order.order_status = "cancelled"
    # Restock inventory
    for item in order.items:
        if item.product:
            item.product.stock_quantity += item.quantity

    db.session.commit()

    return jsonify({
        "message": f"Order {order.order_number} cancelled successfully",
        "order_number": order.order_number,
        "order_status": order.order_status,
    }), 200


@api_v1_bp.route("/orders/<order_number>/return", methods=["POST"])
def return_order_api(order_number):
    """Submit return request with customer ownership verification."""
    order = _find_order(order_number)
    if not order:
        return jsonify({"error": f"Order '{order_number}' not found"}), 404

    authorized, err = _verify_order_ownership(order)
    if not authorized:
        return jsonify({"error": err}), 403

    data = request.get_json(silent=True) or request.form or {}
    reason = (data.get("reason") or "").strip()
    if not reason:
        return jsonify({"error": "Return reason is required"}), 400

    from app.services.sequence_service import SequenceService
    ret = ReturnRequest(
        return_number=SequenceService.next_return_number(),
        order_id=order.id,
        customer_name=order.customer_name,
        reason=reason,
        refund_amount=order.total_amount,
        status="requested",
    )
    db.session.add(ret)
    db.session.commit()

    return jsonify({
        "message": "Return request submitted successfully",
        "return_number": ret.return_number,
        "refund_amount": float(ret.refund_amount),
        "status": ret.status,
    }), 201


@api_v1_bp.route("/contact", methods=["POST"])
def submit_contact_enquiry():
    """Submit customer enquiry / contact seva form."""
    data = request.get_json() or {}
    # Google reCAPTCHA v2 verification
    captcha_token = data.get("recaptcha_token") or data.get("captcha_token") or data.get("recaptchaToken")
    remote_ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    if remote_ip and "," in remote_ip:
        remote_ip = remote_ip.split(",")[0].strip()

    from app.services.captcha_service import CaptchaService
    is_valid, captcha_err = CaptchaService.verify(captcha_token, remote_ip)
    if not is_valid:
        return jsonify({"error": captcha_err}), 400

    name = (data.get("name") or data.get("customer_name") or "").strip()
    email = (data.get("email") or data.get("customer_email") or "").strip().lower()
    subject = (data.get("subject") or "").strip()
    message = (data.get("message") or "").strip()
    phone = (data.get("phone") or "").strip()

    if not name or not email or not message:
        return jsonify({"error": "Name, email, and message are required"}), 400

    from app.services.sequence_service import SequenceService
    enquiry_number = SequenceService.next_enquiry_number()

    enq = CustomerEnquiry(
        enquiry_number=enquiry_number,
        name=name,
        email=email,
        phone=phone,
        subject=subject or "General Devotee Enquiry",
        message=message,
        status="open",
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(enq)
    db.session.commit()

    return jsonify({
        "message": "Your inquiry has been submitted successfully",
        "enquiry_id": enq.id,
        "enquiry_number": enq.enquiry_number,
        "status": enq.status,
    }), 201


@api_v1_bp.route("/content/testimonials", methods=["GET"])
def get_testimonials():
    """Retrieve approved devotee testimonials for storefront display."""
    items = Testimonial.query.filter_by(is_approved=True).order_by(Testimonial.sort_order.asc(), Testimonial.created_at.desc()).all()
    results = [
        {
            "id": t.id,
            "name": t.devotee_name,
            "place": f"{t.devotee_city} · {t.service_or_product}" if t.devotee_city and t.service_or_product else (t.devotee_city or t.service_or_product or "Devotee"),
            "city": t.devotee_city,
            "service": t.service_or_product,
            "rating": t.rating,
            "text": t.blessing_text,
            "quote": t.blessing_text,
            "initial": t.devotee_name[0] if t.devotee_name else "A",
            "is_video": bool(t.is_video or t.video_url),
            "video_url": t.video_url,
            "videoSrc": t.video_url,
            "poster_url": t.poster_url,
            "poster": t.poster_url,
            "badge": t.badge or ("व्हिडिओ अनुभव" if t.is_video else None),
            "duration": t.duration or "0:30",
            "sort_order": t.sort_order or 0,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in items
    ]
    return jsonify({"count": len(results), "testimonials": results})


@api_v1_bp.route("/content/articles", methods=["GET"])
def get_articles():
    """Retrieve published spiritual articles and wisdom posts."""
    category = request.args.get("category")
    q = BlogPost.query.filter_by(is_published=True)
    if category and category.lower() != "all":
        q = q.filter(BlogPost.category.ilike(f"%{category}%"))

    posts = q.order_by(BlogPost.created_at.desc()).all()
    results = [
        {
            "id": p.id,
            "title": p.title,
            "slug": p.slug,
            "category": p.category,
            "tag": p.category,
            "tags": [t.strip() for t in p.tags.split(",") if t.strip()] if p.tags else [p.category],
            "excerpt": p.excerpt,
            "content": p.content,
            "cover_image": p.cover_image,
            "author": p.author_name,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "time": "5 min read",
            "views_count": p.views_count,
        }
        for p in posts
    ]
    resp = jsonify({"count": len(results), "articles": results})
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return resp


@api_v1_bp.route("/content/articles/<slug>", methods=["GET"])
def get_article_detail(slug):
    """Retrieve single published article by slug and increment views."""
    post = BlogPost.query.filter_by(slug=slug, is_published=True).first()
    if not post:
        return jsonify({"error": f"Article with slug '{slug}' not found"}), 404

    try:
        post.views_count = (post.views_count or 0) + 1
        db.session.commit()
    except Exception:
        db.session.rollback()

    resp = jsonify({
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "category": post.category,
        "tags": [t.strip() for t in post.tags.split(",") if t.strip()] if post.tags else [post.category],
        "excerpt": post.excerpt,
        "content": post.content,
        "cover_image": post.cover_image,
        "author": post.author_name,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "views_count": post.views_count,
    })
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return resp


@api_v1_bp.route("/content/banners", methods=["GET"])
def get_banners():
    """Retrieve active promotional and announcement banners."""
    position = request.args.get("position")
    q = Banner.query.filter_by(is_active=True)
    if position:
        q = q.filter_by(position=position)

    banners = q.order_by(Banner.sort_order.asc(), Banner.created_at.desc()).all()
    results = [
        {
            "id": b.id,
            "title": b.title,
            "subtitle": b.subtitle,
            "position": b.position,
            "image_url": b.image_url,
            "link_url": b.link_url,
            "button_text": b.button_text,
            "sort_order": b.sort_order,
        }
        for b in banners
    ]
    return jsonify({"count": len(results), "banners": results})


@api_v1_bp.route("/content/ads", methods=["GET"])
def get_ads():
    """Retrieve active promotional ad units (Google AdSense, Meta Ads, Custom Embeds, Image Banners)."""
    position = request.args.get("position")
    q = AdBanner.query.filter_by(is_active=True)
    if position and position != "all":
        q = q.filter((AdBanner.position == position) | (AdBanner.position == "all"))

    ads = q.order_by(AdBanner.sort_order.asc(), AdBanner.created_at.desc()).all()
    results = [a.to_dict() for a in ads]
    return jsonify({
        "count": len(results),
        "is_active": len(results) > 0,
        "ads": results
    })


@api_v1_bp.route("/content/sections", methods=["GET"])
def get_sections_order():
    """Retrieve ordered homepage sections and visibility configuration."""
    from app.services.section_service import SectionService
    sections = SectionService.get_sections()
    return jsonify({
        "sections": sections,
        "count": len(sections),
    })


@api_v1_bp.route("/content/guruji", methods=["GET"])
def get_guruji_profile():
    """Retrieve Guruji profile, bio, ashram details, and darshan timings."""
    profile = GurujiProfile.query.first()
    default_visibility = {
        "show_photo": True,
        "show_lineage": True,
        "show_bio": True,
        "show_secondary_bio": True,
        "show_stats": True,
        "show_experience": True,
        "show_consultations": True,
        "show_pujas": True,
        "show_cta_button": True,
        "show_darshan": False,
        "show_ashram": False,
        "show_contact": False,
    }
    if not profile:
        data = {
            "name": "Nagesh Guruji",
            "full_title": "Nagesh Guruji",
            "spiritual_lineage": "वेदशास्त्र संपन्न • २५+ वर्षांची साधना व ज्योतिष मार्गदर्शन",
            "bio": "श्रद्धेतून समाधान, परंपरेतून मार्गदर्शन. सनातन वैदिक परंपरा, सिद्ध रुद्राक्ष, प्रामाणिक रत्न आणि शास्त्रोक्त पूजा विधींद्वारे सहस्रो भक्तांचे जीवन प्रकाशित करणारे आदरणीय मार्गदर्शक.",
            "secondary_bio": "जन्मकुंडली अभ्यास, वास्तुशांती, रुद्राभिषेक, नवग्रह शांती आणि रत्न निवड — प्रत्येक सेवेत शास्त्राचा आदर आणि व्यक्तीच्या गरजेचा विचार केला जातो.",
            "experience_years": "25+",
            "consultations_count": "10K+",
            "pujas_count": "5000+",
            "button_text": "Book Consultation →",
            "button_url": "#jyotish",
            "darshan_timings": "सकाळी ९ ते दुपारी १ व संध्याकाळी ४ ते ८",
            "ashram_address": "पुणे / नाशिक, महाराष्ट्र",
            "contact_phone": "+91 98220 00000",
            "contact_email": "seva@nageshguruji.com",
            "profile_image": "/guruji.png",
            "image_url": "/guruji.png",
            "visibility_settings": default_visibility,
        }
        return jsonify({**data, "guruji": data})

    vis = profile.visibility
    vis_settings = profile.visibility_settings or {}
    data = {
        "id": profile.id,
        "name": profile.full_title,
        "full_title": profile.full_title,
        "spiritual_lineage": profile.spiritual_lineage,
        "bio": profile.bio,
        "secondary_bio": profile.secondary_bio,
        "experience_years": profile.experience_years or "25+",
        "consultations_count": profile.consultations_count or "10K+",
        "pujas_count": profile.pujas_count or "5000+",
        "button_text": profile.button_text or "Book Consultation →",
        "button_url": profile.button_url or "#jyotish",
        "darshan_timings": profile.darshan_timings,
        "ashram_address": profile.ashram_address,
        "contact_phone": profile.contact_phone,
        "contact_email": profile.contact_email,
        "profile_image": profile.profile_image or "/guruji.png",
        "image_url": profile.profile_image or "/guruji.png",
        "visibility_settings": vis,
        "section_kicker": vis_settings.get("section_kicker") or "About Guruji",
        "experience_label": vis_settings.get("experience_label") or "Years Experience",
        "consultations_label": vis_settings.get("consultations_label") or "Consultations",
        "pujas_label": vis_settings.get("pujas_label") or "Pujas Performed",
        "darshan_label": vis_settings.get("darshan_label") or "Meeting Time:",
        "address_label": vis_settings.get("address_label") or "Address:",
        "contact_label": vis_settings.get("contact_label") or "Contact:",
        "email_label": vis_settings.get("email_label") or "Email:",
    }
    return jsonify({**data, "guruji": data})


@api_v1_bp.route("/content/site-text", methods=["GET"])
def get_site_text():
    """Retrieve all customizable storefront texts and section headings."""
    from app.services.site_text_service import SiteTextService
    texts = SiteTextService.get_all()
    return jsonify({"site_text": texts, **texts})


@api_v1_bp.route("/system/payment-mode", methods=["GET"])
def get_public_payment_mode():
    """
    Public REST API endpoint returning current authoritative payment mode
    ('online' or 'offline') and configured offline instructions.
    """
    try:
        from app.services.payment_mode_service import PaymentModeService
        from app.services.whatsapp_service import WhatsAppNotificationService
        mode = PaymentModeService.get_payment_mode()
        instructions = PaymentModeService.get_offline_payment_instructions()
        qr_code = PaymentModeService.get_offline_qr_code()
        admin_phone = WhatsAppNotificationService.get_admin_phone()
        return jsonify({
            "payment_mode": mode,
            "is_offline": mode == "offline",
            "offline_payment_instructions": instructions,
            "instructions": instructions,
            "offline_qr_code": qr_code,
            "whatsapp_number": admin_phone,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        current_app.logger.error("Failed to retrieve payment mode: %s", e)
        return jsonify({"error": "Failed to retrieve payment mode", "details": str(e)}), 500




@api_v1_bp.route("/catalog/products/<int:product_id>", methods=["DELETE"])
@api_v1_bp.route("/products/<int:product_id>", methods=["DELETE"])
def api_product_delete(product_id):
    """Admin REST API endpoint to delete or safely archive a product."""
    auth_header = request.headers.get("Authorization", "")
    user = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        payload = AuthService.verify_jwt(token, token_type="access")
        if payload and payload.get("sub"):
            user = AdminUser.query.filter_by(id=payload["sub"], is_active=True).first()

    if not user:
        user = get_current_admin()

    if not user:
        return jsonify({"error": "Unauthorized: admin authentication required"}), 401

    if not user.has_permission("commerce", "delete"):
        return jsonify({"error": "Forbidden: permission 'commerce.delete' required"}), 403

    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error": f"Product with ID {product_id} not found"}), 404

    try:
        if product.order_items:
            if product.publishing_status in ("published", "draft"):
                product.previous_publishing_status = product.publishing_status
            product.is_archived = True
            product.archived_at = datetime.now(timezone.utc)
            product.publishing_status = "archived"
            product.updated_at = datetime.now(timezone.utc)
            db.session.commit()

            from app.services.audit_service import AuditService
            AuditService.log(
                action="PRODUCT_DELETE",
                module="commerce",
                actor_email=user.email,
                actor_user_id=user.id,
                entity_type="Product",
                entity_id=str(product.id),
                details={"sku": product.sku, "name": product.name, "action": "soft_deleted_archived", "reason": "referenced_in_orders"},
            )
            return jsonify({
                "success": True,
                "message": f"Product '{product.name}' was safely archived and removed from storefront to protect order records.",
                "soft_deleted": True,
                "product_id": product.id,
            }), 200
        else:
            name = product.name
            sku = product.sku
            db.session.delete(product)
            db.session.commit()

            from app.services.audit_service import AuditService
            AuditService.log(
                action="PRODUCT_DELETE",
                module="commerce",
                actor_email=user.email,
                actor_user_id=user.id,
                entity_type="Product",
                entity_id=str(product_id),
                details={"sku": sku, "name": name, "action": "permanently_deleted"},
            )
            return jsonify({
                "success": True,
                "message": f"Product '{name}' permanently deleted.",
                "soft_deleted": False,
                "product_id": product_id,
            }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete product: {str(e)}"}), 500


@api_v1_bp.route("/products", methods=["POST"])
@api_v1_bp.route("/catalog/products", methods=["POST"])
def create_product_api():
    """Create product via REST API with display_rank validation and category resolution."""
    data = request.get_json() or {}
    name = (data.get("name") or data.get("title") or "").strip()
    sku = (data.get("sku") or "").strip().upper()
    raw_cat = data.get("category_id") or data.get("category")

    if not name or not raw_cat:
        return jsonify({"error": "name and category are required"}), 400

    # Auto-generate SKU if missing
    if not sku:
        import random
        prefix = "".join([w[0].upper() for w in name.split() if w])[:3] or "PROD"
        sku = f"{prefix}-{random.randint(100, 999)}"

    # Resolve category by id, slug, or name
    cat_obj = None
    raw_cat_str = str(raw_cat).strip()
    if raw_cat_str.isdigit():
        cat_obj = Category.query.get(int(raw_cat_str))
    if not cat_obj:
        cat_obj = Category.query.filter(
            (db.func.lower(Category.name) == raw_cat_str.lower()) |
            (db.func.lower(Category.slug) == raw_cat_str.lower()) |
            (Category.name.ilike(f"%{raw_cat_str}%"))
        ).first()

    if not cat_obj:
        # Fallback to first active category or create slug-based
        cat_obj = Category.query.first()
    category_id = cat_obj.id if cat_obj else 1

    # display_rank: default 999
    raw_rank = data.get("display_rank") or data.get("displayRank") or data.get("rank") or data.get("sort_order")
    display_rank = 999
    if raw_rank is not None:
        try:
            val = int(raw_rank)
            display_rank = max(1, val)
        except (ValueError, TypeError):
            display_rank = 999

    # Default status: "Active" / is_archived: False / publishing_status: "published"
    pub_status = (data.get("publishing_status") or "published").strip().lower()
    if pub_status not in ["published", "draft", "archived"]:
        pub_status = "published"

    existing = Product.query.filter_by(sku=sku).first()
    if existing:
        return jsonify({"error": f"SKU '{sku}' already exists"}), 409

    slug = name.lower().replace(" ", "-").replace("/", "-") + f"-{sku.lower()}"
    prod = Product(
        name=name,
        slug=slug,
        sku=sku,
        category_id=category_id,
        display_rank=display_rank,
        price=Decimal(str(data.get("price", "0"))),
        compare_price=Decimal(str(data.get("compare_price"))) if data.get("compare_price") else None,
        stock_quantity=int(data.get("stock_quantity", 10)),
        low_stock_threshold=int(data.get("low_stock_threshold", 5)),
        certification_status=data.get("certification_status", "certified"),
        publishing_status=pub_status,
        is_archived=False,
        description=(data.get("description") or data.get("desc") or "").strip(),
        thumbnail=data.get("thumbnail") or "/static/img/product-default.png",
        attributes=data.get("attributes") or {},
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(prod)
    db.session.commit()

    resp = jsonify({
        "message": "Product created successfully",
        "product": {
            "id": prod.id,
            "name": prod.name,
            "sku": prod.sku,
            "display_rank": prod.display_rank,
            "rank": prod.display_rank,
            "category": prod.category.name if prod.category else "",
            "category_id": prod.category_id,
            "price": float(prod.price),
            "status": "Active",
            "publishing_status": prod.publishing_status,
        }
    })
    resp.status_code = 201
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    return resp


@api_v1_bp.route("/products/<int:product_id>", methods=["PUT", "PATCH"])
@api_v1_bp.route("/catalog/products/<int:product_id>", methods=["PUT", "PATCH"])
def update_product_api(product_id):
    """Update product via REST API with display_rank validation and category persistence."""
    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    data = request.get_json() or {}

    raw_rank = None
    for k in ["display_rank", "displayRank", "rank", "sort_order"]:
        if k in data and data[k] is not None:
            raw_rank = data[k]
            break
    if raw_rank is not None:
        try:
            val = int(raw_rank)
            product.display_rank = max(1, val)
        except (ValueError, TypeError):
            product.display_rank = 1

    if "name" in data and data["name"]:
        product.name = data["name"].strip()
    elif "title" in data and data["title"]:
        product.name = data["title"].strip()

    raw_cat = data.get("category_id") or data.get("category")
    if raw_cat is not None:
        raw_cat_str = str(raw_cat).strip()
        cat_obj = None
        if raw_cat_str.isdigit():
            cat_obj = Category.query.get(int(raw_cat_str))
        if not cat_obj:
            cat_obj = Category.query.filter(
                (db.func.lower(Category.name) == raw_cat_str.lower()) |
                (db.func.lower(Category.slug) == raw_cat_str.lower()) |
                (Category.name.ilike(f"%{raw_cat_str}%"))
            ).first()
        if cat_obj:
            product.category_id = cat_obj.id

    if "price" in data and data["price"] is not None:
        product.price = Decimal(str(data["price"]))
    if "compare_price" in data:
        product.compare_price = Decimal(str(data["compare_price"])) if data["compare_price"] else None
    if "stock_quantity" in data and data["stock_quantity"] is not None:
        product.stock_quantity = int(data["stock_quantity"])
    if "low_stock_threshold" in data and data["low_stock_threshold"] is not None:
        product.low_stock_threshold = int(data["low_stock_threshold"])
    if "certification_status" in data:
        product.certification_status = data["certification_status"]
    if "publishing_status" in data:
        product.publishing_status = data["publishing_status"]
    if "description" in data:
        product.description = data["description"]
    if "thumbnail" in data and data["thumbnail"]:
        resolved_thumb = CommerceService.ingest_product_thumbnail(raw_path_or_url=data["thumbnail"])
        product.thumbnail = resolved_thumb or data["thumbnail"]
    if "images" in data and isinstance(data["images"], list):
        product.images = data["images"]
        flag_modified(product, "images")

    attrs = dict(product.attributes or {})
    if "attributes" in data and isinstance(data["attributes"], dict):
        attrs.update(data["attributes"])

    # Support explicit individual attribute fields
    attr_keys = [
        "material", "size", "mukhi", "origin", "carat", "metal", "bead_size",
        "energized", "installation", "significance_en", "significance_mr",
        "how_to_wear_mr", "mantra", "care_mr", "shipping_mr", "cert_label"
    ]
    for ak in attr_keys:
        if ak in data:
            attrs[ak] = str(data[ak]).strip() if data[ak] is not None else ""

    product.attributes = attrs
    flag_modified(product, "attributes")

    product.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    resp = jsonify({
        "message": "Product updated successfully",
        "product": {
            "id": product.id,
            "name": product.name,
            "display_rank": product.display_rank,
            "rank": product.display_rank,
            "category": product.category.name if product.category else "",
            "category_id": product.category_id,
            "price": float(product.price),
            "compare_price": float(product.compare_price) if product.compare_price else None,
            "stock_quantity": product.stock_quantity,
            "status": "Archived" if product.is_archived else "Active",
            "publishing_status": product.publishing_status,
            "thumbnail": product.thumbnail,
            "images": product.images or [],
            "attributes": product.attributes or {},
        }
    })
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    return resp


@api_v1_bp.route("/upload-product-image", methods=["POST"])
def api_upload_product_image():
    file = request.files.get("image") or request.files.get("file") or request.files.get("thumbnail_file")
    raw_path = request.form.get("path") or request.form.get("thumbnail")
    if not file and not raw_path and request.is_json:
        raw_path = (request.get_json() or {}).get("path") or (request.get_json() or {}).get("thumbnail")
    saved_url = CommerceService.ingest_product_thumbnail(file_obj=file, raw_path_or_url=raw_path)
    if saved_url:
        return jsonify({"success": True, "url": saved_url})
    return jsonify({"success": False, "error": "No valid file or path found"}), 400


@api_v1_bp.route("/welcome-popup", methods=["GET"])
def get_welcome_popup():
    """Fetch active published welcome popup configuration, or draft if preview requested."""
    from app.models.content import WelcomePopupSetting
    is_preview = request.args.get("preview") in ("true", "1", "yes") or request.args.get("is_preview") in ("true", "1", "yes")

    if is_preview:
        draft = WelcomePopupSetting.query.filter_by(status="draft").first()
        if not draft:
            draft = WelcomePopupSetting.query.filter_by(status="published").first()
        if draft:
            resp = jsonify({
                "enabled": True,
                "is_preview": True,
                "popup": draft.to_dict(),
            })
            resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            return resp

    pub = WelcomePopupSetting.query.filter_by(status="published").first()
    if not pub or not pub.is_enabled:
        return jsonify({"enabled": False, "popup": None}), 200

    now_utc = datetime.now(timezone.utc)
    if pub.start_date:
        start_utc = pub.start_date if pub.start_date.tzinfo else pub.start_date.replace(tzinfo=timezone.utc)
        if now_utc < start_utc:
            return jsonify({"enabled": False, "reason": "not_started", "popup": None}), 200

    if pub.end_date:
        end_utc = pub.end_date if pub.end_date.tzinfo else pub.end_date.replace(tzinfo=timezone.utc)
        if now_utc > end_utc:
            return jsonify({"enabled": False, "reason": "expired", "popup": None}), 200

    resp = jsonify({
        "enabled": True,
        "is_preview": False,
        "popup": pub.to_dict(),
    })
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return resp


# ==========================================
# STOREFRONT ANALYTICS & LIVE TELEMETRY
# ==========================================
from app.services.analytics_service import AnalyticsService


@api_v1_bp.route("/analytics/track", methods=["POST", "OPTIONS"])
def analytics_track():
    """Ingest visitor events, pageviews, and section engagements."""
    if request.method == "OPTIONS":
        return "", 200
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        data = {}
    if not data:
        return jsonify({"status": "ignored", "reason": "empty_payload"}), 400

    ip_addr = request.headers.get("X-Forwarded-For", request.remote_addr or "")
    if "," in ip_addr:
        ip_addr = ip_addr.split(",")[0].strip()
    ua = request.headers.get("User-Agent", "")

    success = AnalyticsService.ingest_tracking_data(data, ip_address=ip_addr, user_agent_str=ua)
    if success:
        return jsonify({"status": "ok"}), 200
    return jsonify({"status": "error"}), 400


@api_v1_bp.route("/analytics/heartbeat", methods=["POST", "OPTIONS"])
def analytics_heartbeat():
    """Ingest foreground session heartbeats to power Active Now (5 min) metric."""
    if request.method == "OPTIONS":
        return "", 200
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        data = {}
    if not data:
        return jsonify({"status": "ignored", "reason": "empty_payload"}), 400

    success = AnalyticsService.ingest_heartbeat(data)
    if success:
        return jsonify({"status": "ok"}), 200
    return jsonify({"status": "error"}), 400

