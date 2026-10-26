from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from app.services.rbac_service import login_required, permission_required, get_current_admin
from app.services.report_service import ReportService
from app.models.commerce import Product, Order, Customer
from app.models.service import PujaBooking, JyotishConsultation

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/admin")


@dashboard_bp.route("/")
@dashboard_bp.route("/dashboard")
@login_required
@permission_required("dashboard", "view")
def overview():
    user = get_current_admin()
    metrics = ReportService.get_dashboard_metrics()
    return render_template("dashboard/overview.html", current_user=user, metrics=metrics, active_page="overview")


@dashboard_bp.route("/search")
@login_required
def global_search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"results": []})

    results = []

    # 1. Search Products (exclude deleted/archived)
    products = Product.query.filter(
        (Product.is_archived.is_(False) | Product.is_archived.is_(None)) & (Product.publishing_status != "archived")
    ).filter(
        (Product.name.ilike(f"%{query}%")) | (Product.sku.ilike(f"%{query}%"))
    ).limit(4).all()
    for p in products:
        results.append({
            "category": "Products",
            "title": p.name,
            "subtitle": f"SKU: {p.sku} · ₹{p.price}",
            "url": url_for("commerce.products_list") + f"?q={p.sku}",
        })

    # 2. Search Orders
    orders = Order.query.filter(
        (Order.order_number.ilike(f"%{query}%")) | (Order.customer_name.ilike(f"%{query}%"))
    ).limit(4).all()
    for o in orders:
        results.append({
            "category": "Orders",
            "title": o.order_number,
            "subtitle": f"{o.customer_name} · ₹{o.total_amount} ({o.order_status})",
            "url": url_for("commerce.order_detail", order_id=o.id),
        })

    # 3. Search Puja Bookings
    bookings = PujaBooking.query.filter(
        (PujaBooking.booking_number.ilike(f"%{query}%")) | (PujaBooking.customer_name.ilike(f"%{query}%"))
    ).limit(3).all()
    for b in bookings:
        results.append({
            "category": "Puja Bookings",
            "title": b.booking_number,
            "subtitle": f"{b.customer_name} · {b.service.name if b.service else 'Puja'}",
            "url": url_for("services.puja_bookings_list"),
        })

    # 4. Search Customers
    customers = Customer.query.filter(
        (Customer.full_name.ilike(f"%{query}%")) | (Customer.email.ilike(f"%{query}%"))
    ).limit(3).all()
    for c in customers:
        results.append({
            "category": "Customers",
            "title": c.full_name,
            "subtitle": f"{c.email} · {c.total_orders} orders",
            "url": url_for("commerce.customers_list"),
        })

    return jsonify({"results": results})


# ==========================================
# WEBSITE ANALYTICS & LIVE ACTIVITY DASHBOARD
# ==========================================
from flask import Response
from app.services.analytics_service import AnalyticsService, IST


@dashboard_bp.route("/analytics")
@login_required
@permission_required("dashboard", "view")
def analytics_page():
    """Render Website Analytics & Live Activity admin dashboard."""
    user = get_current_admin()
    range_type = request.args.get("range", "today")
    custom_start = request.args.get("start_date")
    custom_end = request.args.get("end_date")

    start_utc, end_utc, prev_start_utc, prev_end_utc, range_label = AnalyticsService.parse_date_range(
        range_type, custom_start, custom_end
    )

    metrics = AnalyticsService.get_summary_metrics(start_utc, end_utc, prev_start_utc, prev_end_utc)
    pages = AnalyticsService.get_most_visited_pages(start_utc, end_utc, limit=10)
    sections = AnalyticsService.get_most_engaged_sections(start_utc, end_utc, limit=10)
    feed = AnalyticsService.get_live_activity_feed(limit=35)
    now_ist = AnalyticsService.get_ist_now().strftime("%I:%M:%S %p")

    return render_template(
        "dashboard/analytics.html",
        current_user=user,
        active_page="analytics",
        selected_range=range_type,
        range_label=range_label,
        metrics=metrics,
        pages=pages,
        sections=sections,
        feed=feed,
        last_updated_ist=now_ist,
        custom_start=custom_start or "",
        custom_end=custom_end or "",
    )


@dashboard_bp.route("/analytics/data")
@login_required
@permission_required("dashboard", "view")
def analytics_data():
    """API endpoint providing filtered telemetry data and live auto-refresh updates."""
    range_type = request.args.get("range", "today")
    custom_start = request.args.get("start_date")
    custom_end = request.args.get("end_date")

    start_utc, end_utc, prev_start_utc, prev_end_utc, range_label = AnalyticsService.parse_date_range(
        range_type, custom_start, custom_end
    )

    metrics = AnalyticsService.get_summary_metrics(start_utc, end_utc, prev_start_utc, prev_end_utc)
    pages = AnalyticsService.get_most_visited_pages(start_utc, end_utc, limit=10)
    sections = AnalyticsService.get_most_engaged_sections(start_utc, end_utc, limit=10)
    feed = AnalyticsService.get_live_activity_feed(limit=35)
    now_ist = AnalyticsService.get_ist_now().strftime("%I:%M:%S %p")

    return jsonify({
        "status": "ok",
        "selected_range": range_type,
        "range_label": range_label,
        "metrics": metrics,
        "pages": pages,
        "sections": sections,
        "feed": feed,
        "last_updated_ist": now_ist,
    })


@dashboard_bp.route("/analytics/export")
@login_required
@permission_required("dashboard", "view")
def analytics_export():
    """Quick CSV export of filtered telemetry data."""
    range_type = request.args.get("range", "today")
    custom_start = request.args.get("start_date")
    custom_end = request.args.get("end_date")

    start_utc, end_utc, _, _, range_label = AnalyticsService.parse_date_range(
        range_type, custom_start, custom_end
    )

    csv_content = AnalyticsService.export_csv(start_utc, end_utc, range_label)
    now_stamp = AnalyticsService.get_ist_now().strftime("%Y%m%d_%H%M%S")
    filename = f"astroveda_analytics_{range_type}_{now_stamp}.csv"

    return Response(
        csv_content,
        mimetype="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8",
        },
    )
