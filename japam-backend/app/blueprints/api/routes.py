from decimal import Decimal
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app, session
from app.extensions import db
from app.models.commerce import Product, Category, Order, OrderItem, Customer, ProductReview
from app.models.service import PujaService, JyotishConsultation
from app.models.operations import ReturnRequest, CustomerEnquiry, PaymentTransaction
from app.models.content import Testimonial, BlogPost, GurujiProfile, Banner
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

    return jsonify({
        "id": p.id,
        "name": p.name,
        "slug": p.slug,
        "sku": p.sku,
            "display_rank": p.display_rank if getattr(p, "display_rank", None) is not None else 1,
        "description": p.description,
        "price": float(p.price),
        "compare_price": float(p.compare_price) if p.compare_price else None,
        "stock_quantity": p.stock_quantity,
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
    }), 200


@api_v1_bp.route("/catalog/products/<slug>/reviews", methods=["POST"])
def submit_product_review(slug):
    """Devotee review submission with initial moderation status (is_approved=False)."""
    p = Product.query.filter_by(slug=slug, publishing_status="published").filter(
        (Product.is_archived.is_(False)) | (Product.is_archived.is_(None))
    ).first()
    if not p:
        return jsonify({"error": f"Product with slug '{slug}' not found"}), 404

    data = request.get_json() or {}
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
        {"id": c.id, "name": c.name, "slug": c.slug, "icon": c.icon, "description": c.description}
        for c in categories
    ]
    return jsonify({"categories": results})


@api_v1_bp.route("/services/puja", methods=["GET"])
def get_puja_services():
    services = PujaService.query.filter_by(is_active=True).all()
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
            "is_online_available": s.is_online_available,
            "is_offline_available": s.is_offline_available,
            "inclusions": s.inclusions,
        }
        for s in services
    ]
    return jsonify({"puja_services": results})



@api_v1_bp.route("/services/book-puja", methods=["POST"])
def book_puja():
    data = request.get_json() or {}

    customer_name = (data.get("customer_name") or data.get("name") or "").strip()
    customer_email = (data.get("customer_email") or data.get("email") or "").strip()
    customer_phone = (data.get("customer_phone") or data.get("phone") or "").strip()
    booking_date_raw = data.get("booking_date") or data.get("preferred_date") or data.get("date")
    time_slot = (data.get("time_slot") or data.get("time") or data.get("timeSlot") or "10:00 AM").strip()
    service_id = data.get("service_id")

    if not customer_name:
        return jsonify({"error": "Field 'customer_name' (or 'name') is required"}), 400
    if not customer_email and customer_phone:
        customer_email = f"{customer_phone.replace('+', '').replace(' ', '')}@astroveda.in"
    elif not customer_email:
        customer_email = "devotee@astroveda.in"

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

        booking = BookingService.book_puja_slot(
            service_id=service_id,
            customer_name=customer_name,
            customer_email=customer_email,
            customer_phone=customer_phone,
            booking_date=booking_date,
            time_slot=time_slot,
            booking_type=data.get("booking_type") or data.get("bookingType") or "online",
            gotra=data.get("gotra"),
            nakshatra=data.get("nakshatra"),
            rashi=data.get("rashi"),
            sankalp_text=data.get("sankalp_text") or data.get("sankalp"),
        )
        return jsonify({
            "message": "Puja booking created successfully",
            "booking_number": booking.booking_number,
            "amount_paid": float(booking.amount_paid),
            "status": booking.status,
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@api_v1_bp.route("/services/request-consultation", methods=["POST"])
def request_consultation():
    data = request.get_json() or {}

    customer_name = (data.get("customer_name") or data.get("name") or "").strip()
    customer_email = (data.get("customer_email") or data.get("email") or "").strip()
    customer_phone = (data.get("customer_phone") or data.get("phone") or "").strip()
    dob_raw = data.get("dob") or data.get("date_of_birth")
    tob = (data.get("tob") or data.get("time") or data.get("time_of_birth") or "10:00 AM").strip()
    pob = (data.get("pob") or data.get("place") or data.get("place_of_birth") or "Not Specified").strip()
    topic = (data.get("topic") or data.get("consultation_topic") or "General Jyotish Consultation").strip()

    if not customer_name:
        return jsonify({"error": "Field 'customer_name' is required"}), 400
    if not customer_email and customer_phone:
        customer_email = f"{customer_phone.replace('+', '').replace(' ', '')}@astroveda.in"
    elif not customer_email:
        customer_email = "devotee@astroveda.in"
    if not dob_raw:
        return jsonify({"error": "Field 'dob' (date of birth) is required"}), 400

    try:
        # Parse dob with multiple formats
        if isinstance(dob_raw, str):
            for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
                try:
                    dob = datetime.strptime(dob_raw.strip(), fmt).date()
                    break
                except ValueError:
                    pass
            else:
                return jsonify({"error": "Invalid date format for dob. Expected YYYY-MM-DD"}), 400
        else:
            dob = dob_raw

        consult_count = JyotishConsultation.query.count() + 1
        consult_num = f"#JYT-{dob.strftime('%Y%m')}-{consult_count:04d}"

        consultation = JyotishConsultation(
            consultation_number=consult_num,
            customer_name=customer_name,
            customer_email=customer_email,
            customer_phone=customer_phone,
            dob=dob,
            tob=tob,
            pob=pob,
            topic=topic,
            consultation_type=data.get("consultation_type", "online_video"),
            status="pending",
            amount_paid=Decimal("1500.00"),
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(consultation)
        db.session.commit()

        return jsonify({
            "message": "Jyotish consultation request submitted",
            "consultation_number": consultation.consultation_number,
            "status": consultation.status,
        }), 201
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
    customer_name = data.get("customer_name", "").strip()
    customer_email = data.get("customer_email", "").strip().lower()
    customer_phone = data.get("customer_phone", "").strip()
    shipping_address = data.get("shipping_address", "").strip()
    payment_method = data.get("payment_method", "Razorpay")
    raw_items = data.get("items", [])
    coupon_code = data.get("coupon_code", "").strip().upper()
    idempotency_key = (request.headers.get("Idempotency-Key") or data.get("idempotency_key") or "").strip()

    if not customer_name or not customer_email or not shipping_address:
        return jsonify({"error": "Customer name, email, and shipping address are required"}), 400

    if not raw_items:
        return jsonify({"error": "Cart cannot be empty"}), 400

    # Idempotency check: if client sent an idempotency key and order exists, return existing order
    if idempotency_key:
        existing_order = Order.query.filter_by(idempotency_key=idempotency_key).first()
        if existing_order:
            return jsonify({
                "message": "Order already processed (idempotent)",
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

        # Concurrency-safe unique order number generation
        for _ in range(5):
            ts_str = datetime.now(timezone.utc).strftime("%y%m%d%H%M")
            rand_suffix = secrets.token_hex(2).upper()
            candidate_num = f"#ORD-{ts_str}-{rand_suffix}"
            if not Order.query.filter_by(order_number=candidate_num).first():
                order_number = candidate_num
                break
        else:
            order_number = f"#ORD-{secrets.token_hex(6).upper()}"

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
            payment_status="pending",
            payment_method=payment_method,
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

        return jsonify({
            "message": "Order placed successfully",
            "order_number": order.order_number,
            "access_token": order.access_token,
            "total_amount": float(order.total_amount),
            "payment_status": order.payment_status,
            "payment_method": order.payment_method,
            "order_status": order.order_status,
        }), 201

    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to place order: {str(e)}"}), 500


@api_v1_bp.route("/payments/webhook", methods=["POST"])
def payment_webhook():
    """
    Payment Gateway Webhook (Razorpay / Stripe) with HMAC-SHA256 signature verification,
    idempotency checking, amount mismatch rejection, and order status transition.
    Fails closed if PAYMENT_WEBHOOK_SECRET is not configured.
    """
    import hmac
    import hashlib
    from app.extensions import redis_client

    raw_payload = request.get_data(as_text=True)
    signature = request.headers.get("X-Razorpay-Signature") or request.headers.get("X-Webhook-Signature")
    webhook_secret = current_app.config.get("PAYMENT_WEBHOOK_SECRET")

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

    order_number = payment_obj.get("order_number") or payment_obj.get("notes", {}).get("order_number")
    amount_in_paise = payment_obj.get("amount")  # in paise: e.g. 129900 for ₹1299.00
    gateway_payment_id = payment_obj.get("id", f"pay_sim_{int(datetime.now(timezone.utc).timestamp())}")

    if not order_number:
        return jsonify({"error": "Missing order_number in payment notes or entity"}), 400

    order = Order.query.filter_by(order_number=order_number).first()
    if not order:
        return jsonify({"error": f"Order '{order_number}' not found"}), 404

    # Validate paid amount against order total (convert order.total_amount to paise)
    if amount_in_paise is not None:
        expected_paise = int(order.total_amount * 100)
        if int(amount_in_paise) != expected_paise:
            # Amount mismatch: reject and alert
            return jsonify({
                "error": "Payment amount mismatch",
                "received_amount": amount_in_paise,
                "expected_amount": expected_paise
            }), 400

    # Successful payment: transition order and create transaction
    if order.payment_status != "paid":
        order.payment_status = "paid"
        if order.order_status == "pending":
            order.order_status = "processing"

        txn = PaymentTransaction(
            transaction_number=f"TXN-{order.order_number.replace('#', '')}-{gateway_payment_id}",
            order_id=order.id,
            amount=order.total_amount,
            currency="INR",
            gateway="Razorpay",
            gateway_payment_id=gateway_payment_id,
            status="captured",
            customer_name=order.customer_name,
            customer_email=order.customer_email,
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(txn)
        db.session.commit()

    return jsonify({"status": "payment_processed", "order_number": order.order_number}), 200


def _verify_order_ownership(order):
    """
    Ensure the caller owns this order to prevent IDOR attacks.
    Supports:
    1. Authenticated Admin User via Bearer JWT token in Authorization header.
    2. High-entropy order access_token (passed via X-Order-Token header, ?token= param, or JSON body).
    3. For legacy or seed records without access_token: verified customer email.
    """
    import hmac
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
        if hmac.compare_digest(token_candidate.strip(), order.access_token.strip()):
            return True, None

    # Check verified email verification (only for legacy orders without access_token, or verified session)
    if not order.access_token or session.get("devotee_email"):
        client_email = (
            request.headers.get("X-Customer-Email")
            or request.args.get("email")
            or req_json.get("email")
            or req_json.get("customer_email")
            or session.get("devotee_email")
        )
        if client_email and client_email.strip().lower() == order.customer_email.strip().lower():
            return True, None

    if not token_candidate:
        return False, "You are not authorized to access this order (order token required)"

    return False, "You are not authorized to access this order (invalid order token or email mismatch)"



def _find_order(order_number):
    if not order_number:
        return None
    cleaned = str(order_number).strip()
    order = Order.query.filter_by(order_number=cleaned).first()
    if not order and not cleaned.startswith("#"):
        order = Order.query.filter_by(order_number=f"#{cleaned}").first()
    if not order and cleaned.startswith("#"):
        order = Order.query.filter_by(order_number=cleaned[1:]).first()
    return order


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
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
        "customer_phone": order.customer_phone,
        "shipping_address": order.shipping_address,
        "order_status": order.order_status,
        "payment_status": order.payment_status,
        "payment_method": order.payment_method,
        "placed_at": order.placed_at.isoformat() if order.placed_at else None,
        "subtotal": float(order.subtotal),
        "discount_amount": float(order.discount_amount),
        "tax_amount": float(order.tax_amount),
        "total_amount": float(order.total_amount),
        "items": [
            {
                "product_id": item.product_id,
                "product_name": item.product_name,
                "sku": item.sku,
                "unit_price": float(item.unit_price),
                "quantity": item.quantity,
                "total_price": float(item.total_price),
            }
            for item in order.items
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

    ret_count = ReturnRequest.query.count() + 1
    ret = ReturnRequest(
        return_number=f"#RET-{order.order_number.replace('#', '')}-{ret_count:02d}",
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
    name = (data.get("name") or data.get("customer_name") or "").strip()
    email = (data.get("email") or data.get("customer_email") or "").strip().lower()
    subject = (data.get("subject") or "").strip()
    message = (data.get("message") or "").strip()
    phone = (data.get("phone") or "").strip()

    if not name or not email or not message:
        return jsonify({"error": "Name, email, and message are required"}), 400

    enq_count = CustomerEnquiry.query.count() + 1
    enquiry_number = f"#ENQ-{datetime.now(timezone.utc).strftime('%Y%m')}-{enq_count:04d}"

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
        "status": enq.status,
    }), 201


@api_v1_bp.route("/content/testimonials", methods=["GET"])
def get_testimonials():
    """Retrieve approved devotee testimonials for storefront display."""
    items = Testimonial.query.filter_by(is_approved=True).order_by(Testimonial.created_at.desc()).all()
    results = [
        {
            "id": t.id,
            "name": t.devotee_name,
            "place": f"{t.devotee_city} · {t.service_or_product}" if t.devotee_city and t.service_or_product else (t.devotee_city or t.service_or_product or "Devotee"),
            "city": t.devotee_city,
            "service": t.service_or_product,
            "rating": t.rating,
            "text": t.blessing_text,
            "initial": t.devotee_name[0] if t.devotee_name else "A",
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
            "excerpt": p.excerpt,
            "cover_image": p.cover_image,
            "author": p.author_name,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "time": "5 min read",
        }
        for p in posts
    ]
    return jsonify({"count": len(results), "articles": results})


@api_v1_bp.route("/content/articles/<slug>", methods=["GET"])
def get_article_detail(slug):
    """Retrieve single published article by slug."""
    post = BlogPost.query.filter_by(slug=slug, is_published=True).first()
    if not post:
        return jsonify({"error": f"Article with slug '{slug}' not found"}), 404

    return jsonify({
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "category": post.category,
        "excerpt": post.excerpt,
        "content": post.content,
        "cover_image": post.cover_image,
        "author": post.author_name,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "views_count": post.views_count,
    })


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
    }
    return jsonify({**data, "guruji": data})


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
    if "attributes" in data and isinstance(data["attributes"], dict):
        product.attributes = data["attributes"]

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
            "status": "Archived" if product.is_archived else "Active",
            "publishing_status": product.publishing_status,
            "thumbnail": product.thumbnail,
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

