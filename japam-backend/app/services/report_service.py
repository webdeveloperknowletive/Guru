import csv
import io
import zoneinfo
from datetime import datetime, date, time, timedelta, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy import func

from app.extensions import db
from app.models.commerce import Order, OrderItem, Product, Customer, ProductReview
from app.models.service import PujaBooking, JyotishConsultation
from app.models.operations import CustomerEnquiry, PaymentTransaction
from app.services.analytics_service import AnalyticsService, IST


class ReportService:

    @staticmethod
    def get_revenue_chart_data(timeframe: str = "30d") -> Dict[str, Any]:
        """Generate time-series revenue data for line/area chart without N+1 queries."""
        now_ist = datetime.now(IST)
        labels: List[str] = []
        values: List[float] = []

        if timeframe == "7d":
            # Last 7 calendar days
            days = 7
            start_ist = (now_ist - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
            start_utc = start_ist.astimezone(timezone.utc).replace(tzinfo=None)

            orders = Order.query.filter(
                Order.placed_at >= start_utc,
                Order.order_status != "cancelled",
                Order.payment_status.notin_(["failed", "refunded"])
            ).all()

            daily_sums = { (start_ist + timedelta(days=i)).strftime("%b %d"): Decimal("0.00") for i in range(days) }
            for o in orders:
                if o.placed_at:
                    o_ist = o.placed_at.replace(tzinfo=timezone.utc).astimezone(IST)
                    k = o_ist.strftime("%b %d")
                    if k in daily_sums:
                        daily_sums[k] += Decimal(str(o.total_amount or 0))

            labels = list(daily_sums.keys())
            values = [float(v) for v in daily_sums.values()]

        elif timeframe == "month":
            # Current month from 1st to today
            first_day = now_ist.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            days = (now_ist.date() - first_day.date()).days + 1
            start_utc = first_day.astimezone(timezone.utc).replace(tzinfo=None)

            orders = Order.query.filter(
                Order.placed_at >= start_utc,
                Order.order_status != "cancelled",
                Order.payment_status.notin_(["failed", "refunded"])
            ).all()

            daily_sums = { (first_day + timedelta(days=i)).strftime("%b %d"): Decimal("0.00") for i in range(days) }
            for o in orders:
                if o.placed_at:
                    o_ist = o.placed_at.replace(tzinfo=timezone.utc).astimezone(IST)
                    k = o_ist.strftime("%b %d")
                    if k in daily_sums:
                        daily_sums[k] += Decimal(str(o.total_amount or 0))

            labels = list(daily_sums.keys())
            values = [float(v) for v in daily_sums.values()]

        elif timeframe == "year":
            # 12 calendar months of current year
            current_year = now_ist.year
            start_year = datetime(current_year, 1, 1, 0, 0, 0, tzinfo=IST)
            start_utc = start_year.astimezone(timezone.utc).replace(tzinfo=None)

            orders = Order.query.filter(
                Order.placed_at >= start_utc,
                Order.order_status != "cancelled",
                Order.payment_status.notin_(["failed", "refunded"])
            ).all()

            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            month_sums = { m: Decimal("0.00") for m in months }
            for o in orders:
                if o.placed_at:
                    o_ist = o.placed_at.replace(tzinfo=timezone.utc).astimezone(IST)
                    if o_ist.year == current_year:
                        m_name = o_ist.strftime("%b")
                        if m_name in month_sums:
                            month_sums[m_name] += Decimal(str(o.total_amount or 0))

            labels = months
            values = [float(month_sums[m]) for m in months]

        else:
            # Default: Last 30 calendar days
            days = 30
            start_ist = (now_ist - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
            start_utc = start_ist.astimezone(timezone.utc).replace(tzinfo=None)

            orders = Order.query.filter(
                Order.placed_at >= start_utc,
                Order.order_status != "cancelled",
                Order.payment_status.notin_(["failed", "refunded"])
            ).all()

            daily_sums = { (start_ist + timedelta(days=i)).strftime("%b %d"): Decimal("0.00") for i in range(days) }
            for o in orders:
                if o.placed_at:
                    o_ist = o.placed_at.replace(tzinfo=timezone.utc).astimezone(IST)
                    k = o_ist.strftime("%b %d")
                    if k in daily_sums:
                        daily_sums[k] += Decimal(str(o.total_amount or 0))

            labels = list(daily_sums.keys())
            values = [float(v) for v in daily_sums.values()]

        return {"labels": labels, "values": values}

    @staticmethod
    def get_order_status_chart_data(timeframe: str = "30d") -> Dict[str, Any]:
        """Generate order status distribution metrics for donut chart."""
        if timeframe in ("all", "all_time"):
            base_q = Order.query
        else:
            s_utc, e_utc, _, _, _ = AnalyticsService.parse_date_range(timeframe)
            base_q = Order.query.filter(Order.placed_at >= s_utc, Order.placed_at <= e_utc)

        total_orders = base_q.count()
        valid_total = max(1, total_orders)

        status_counts = {
            "delivered": base_q.filter(Order.order_status == "delivered").count(),
            "processing": base_q.filter(Order.order_status == "processing").count(),
            "shipped": base_q.filter(Order.order_status == "shipped").count(),
            "cancelled": base_q.filter(Order.order_status == "cancelled").count(),
            "pending": base_q.filter(Order.order_status == "pending").count(),
        }

        order_status_stats = {
            "total": total_orders,
            "counts": status_counts,
            "percentages": {
                k: int(round((v / valid_total) * 100)) if total_orders > 0 else 0
                for k, v in status_counts.items()
            }
        }
        return order_status_stats

    @classmethod
    def get_dashboard_metrics(
        cls,
        range_type: str = "30d",
        custom_start: Optional[str] = None,
        custom_end: Optional[str] = None,
        revenue_timeframe: str = "30d",
        status_timeframe: str = "30d",
    ) -> Dict[str, Any]:
        """
        Calculate authoritative, dynamic metrics for the Overview Dashboard.
        Syncs truthfully with live orders, bookings, and consultations.
        """
        now_ist = datetime.now(IST)
        today_date = now_ist.date()

        start_utc, end_utc, prev_start_utc, prev_end_utc, range_label = AnalyticsService.parse_date_range(
            range_type, custom_start, custom_end
        )

        # 1. Orders Metric
        if range_type in ("all", "all_time"):
            orders_current = Order.query.count()
            orders_prev = 0
            orders_diff_pct = 0
        else:
            orders_current = Order.query.filter(Order.placed_at >= start_utc, Order.placed_at <= end_utc).count()
            orders_prev = Order.query.filter(Order.placed_at >= prev_start_utc, Order.placed_at < prev_end_utc).count()
            if orders_prev > 0:
                orders_diff_pct = int(round(((orders_current - orders_prev) / orders_prev) * 100))
            elif orders_current > 0:
                orders_diff_pct = 100
            else:
                orders_diff_pct = 0

        # 2. Revenue Metric
        valid_orders_filter = [
            Order.order_status != "cancelled",
            Order.payment_status.notin_(["failed", "refunded"])
        ]
        if range_type in ("all", "all_time"):
            rev_cur_val = db.session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
                *valid_orders_filter
            ).scalar()
            revenue_current = Decimal(str(rev_cur_val))
            revenue_prev = Decimal("0.00")
            rev_diff_pct = 0
        else:
            rev_cur_val = db.session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
                Order.placed_at >= start_utc,
                Order.placed_at <= end_utc,
                *valid_orders_filter
            ).scalar()
            revenue_current = Decimal(str(rev_cur_val))

            rev_prev_val = db.session.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
                Order.placed_at >= prev_start_utc,
                Order.placed_at < prev_end_utc,
                *valid_orders_filter
            ).scalar()
            revenue_prev = Decimal(str(rev_prev_val))

            if revenue_prev > 0:
                rev_diff_pct = int(round(((revenue_current - revenue_prev) / revenue_prev) * 100))
            elif revenue_current > 0:
                rev_diff_pct = 100
            else:
                rev_diff_pct = 0

        # 3. Puja Bookings Metric
        if range_type in ("all", "all_time"):
            puja_current = PujaBooking.query.count()
            puja_prev = 0
            puja_diff_pct = 0
        else:
            puja_current = PujaBooking.query.filter(
                PujaBooking.created_at >= start_utc,
                PujaBooking.created_at <= end_utc
            ).count()
            puja_prev = PujaBooking.query.filter(
                PujaBooking.created_at >= prev_start_utc,
                PujaBooking.created_at < prev_end_utc
            ).count()
            if puja_prev > 0:
                puja_diff_pct = int(round(((puja_current - puja_prev) / puja_prev) * 100))
            elif puja_current > 0:
                puja_diff_pct = 100
            else:
                puja_diff_pct = 0

        # 4. Consultation Requests Metric
        if range_type in ("all", "all_time"):
            consult_current = JyotishConsultation.query.count()
            consult_prev = 0
            consult_diff_pct = 0
        else:
            consult_current = JyotishConsultation.query.filter(
                JyotishConsultation.created_at >= start_utc,
                JyotishConsultation.created_at <= end_utc
            ).count()
            consult_prev = JyotishConsultation.query.filter(
                JyotishConsultation.created_at >= prev_start_utc,
                JyotishConsultation.created_at < prev_end_utc
            ).count()
            if consult_prev > 0:
                consult_diff_pct = int(round(((consult_current - consult_prev) / consult_prev) * 100))
            elif consult_current > 0:
                consult_diff_pct = 100
            else:
                consult_diff_pct = 0

        # Dynamic Trend Subtext
        trend_subtext = "vs. yesterday" if range_type == "today" else (
            "vs. prev day" if range_type == "yesterday" else (
                "vs. prev 7 days" if range_type == "7d" else (
                    "vs. prev 30 days" if range_type == "30d" else (
                        "vs. last month" if range_type in ("month", "this_month") else "vs. prev period"
                    )
                )
            )
        )

        # Revenue Chart Data
        rev_chart = cls.get_revenue_chart_data(revenue_timeframe)

        # Order Status Donut Chart Data
        order_status_stats = cls.get_order_status_chart_data(status_timeframe)

        # Upcoming Appointments: Real upcoming Puja bookings & Jyotish consultations
        pujas_upcoming = PujaBooking.query.filter(
            PujaBooking.status.in_(["confirmed", "pending"]),
            PujaBooking.booking_date >= today_date
        ).order_by(PujaBooking.booking_date.asc(), PujaBooking.created_at.desc()).limit(6).all()

        # If few future pujas, backfill with most recent confirmed/pending
        if len(pujas_upcoming) < 3:
            existing_ids = {p.id for p in pujas_upcoming}
            recent_pujas = PujaBooking.query.filter(
                PujaBooking.status.in_(["confirmed", "pending"]),
                PujaBooking.id.notin_(existing_ids)
            ).order_by(PujaBooking.booking_date.desc()).limit(3).all()
            pujas_to_display = sorted(pujas_upcoming + recent_pujas, key=lambda x: x.booking_date)
        else:
            pujas_to_display = pujas_upcoming

        consult_min_dt = datetime.combine(today_date, time.min)
        consults_upcoming = JyotishConsultation.query.filter(
            JyotishConsultation.status.in_(["confirmed", "pending"]),
            JyotishConsultation.scheduled_at >= consult_min_dt
        ).order_by(JyotishConsultation.scheduled_at.asc()).limit(6).all()

        if len(consults_upcoming) < 2:
            existing_c_ids = {c.id for c in consults_upcoming}
            recent_consults = JyotishConsultation.query.filter(
                JyotishConsultation.status.in_(["confirmed", "pending"]),
                JyotishConsultation.id.notin_(existing_c_ids)
            ).order_by(JyotishConsultation.created_at.desc()).limit(2).all()
            consults_to_display = consults_upcoming + recent_consults
        else:
            consults_to_display = consults_upcoming

        appointments: List[Dict[str, Any]] = []
        for p in pujas_to_display:
            b_date_str = p.booking_date.strftime("%b %d, %Y") if p.booking_date else "Scheduled"
            appointments.append({
                "type": "Puja",
                "service": p.service.name if p.service else "Vedic Puja",
                "customer": p.customer_name,
                "date_time": f"{b_date_str} {p.time_slot or '10:00 AM'}",
                "status": p.status.capitalize(),
                "id": p.id,
                "view_url": f"/admin/services/puja-bookings?q={p.customer_name}",
                "sort_key": p.booking_date or date.min,
            })

        for c in consults_to_display:
            c_date_str = c.scheduled_at.strftime("%b %d, %Y %I:%M %p") if c.scheduled_at else (
                f"{c.created_at.strftime('%b %d, %Y')} (Slot Requested)" if c.created_at else "Requested"
            )
            c_sort = c.scheduled_at.date() if c.scheduled_at else (c.created_at.date() if c.created_at else date.min)
            appointments.append({
                "type": "Consultation",
                "service": c.topic or "Jyotish Consultation",
                "customer": c.customer_name,
                "date_time": c_date_str,
                "status": c.status.capitalize(),
                "id": c.id,
                "view_url": f"/admin/services/consultations?q={c.customer_name}",
                "sort_key": c_sort,
            })

        appointments.sort(key=lambda x: x["sort_key"])

        # Recent Orders
        recent_orders = Order.query.order_by(Order.placed_at.desc()).limit(5).all()

        # Low Stock Alerts
        low_stock_items = Product.query.filter(
            Product.stock_quantity <= Product.low_stock_threshold,
            Product.publishing_status != "archived"
        ).order_by(Product.stock_quantity.asc()).limit(5).all()

        # Pending Actions
        pending_actions = [
            {
                "task": "Enquiries to Respond",
                "details": "New customer enquiries",
                "count": CustomerEnquiry.query.filter_by(status="open").count(),
                "action_label": "View",
                "url": "/admin/operations/enquiries",
            },
            {
                "task": "Consultation Requests",
                "details": "Awaiting confirmation",
                "count": JyotishConsultation.query.filter_by(status="pending").count(),
                "action_label": "View",
                "url": "/admin/services/consultations",
            },
            {
                "task": "Product Reviews",
                "details": "Pending moderation",
                "count": ProductReview.query.filter_by(is_approved=False).count(),
                "action_label": "Review",
                "url": "/admin/commerce/reviews",
            },
            {
                "task": "Payment Verifications",
                "details": "Awaiting manual review",
                "count": PaymentTransaction.query.filter_by(status="pending").count(),
                "action_label": "View",
                "url": "/admin/operations/payments",
            },
        ]

        card_title_period = "Today" if range_type == "today" else (
            "Yesterday" if range_type == "yesterday" else (
                f"({range_label})"
            )
        )

        return {
            "selected_range": range_type,
            "range_label": range_label,
            "card_title_period": card_title_period,
            "trend_subtext": trend_subtext,
            "orders_today": orders_current,
            "orders_diff_pct": orders_diff_pct,
            "revenue_today": revenue_current,
            "rev_diff_pct": rev_diff_pct,
            "puja_today": puja_current,
            "puja_diff_pct": puja_diff_pct,
            "consult_today": consult_current,
            "consult_diff_pct": consult_diff_pct,
            "chart_labels": rev_chart["labels"],
            "chart_values": rev_chart["values"],
            "order_status_stats": order_status_stats,
            "appointments": appointments[:6],
            "recent_orders": recent_orders,
            "low_stock_items": low_stock_items,
            "pending_actions": pending_actions,
        }

    @staticmethod
    def export_orders_csv() -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Order Number", "Customer Name", "Customer Email", "Status", "Total Amount", "Placed At"])
        orders = Order.query.order_by(Order.placed_at.desc()).all()
        for o in orders:
            writer.writerow([
                o.order_number,
                o.customer_name,
                o.customer_email,
                o.order_status,
                str(o.total_amount),
                o.placed_at.strftime("%Y-%m-%d %H:%M:%S") if o.placed_at else "",
            ])
        return output.getvalue()
