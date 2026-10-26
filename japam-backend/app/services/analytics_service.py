import csv
import io
import json
import zoneinfo
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import func, desc

from app.extensions import db
from app.models.analytics import AnalyticsVisitor, AnalyticsSession, AnalyticsEvent

IST = zoneinfo.ZoneInfo("Asia/Kolkata")


def format_duration(seconds: int) -> str:
    """Format seconds into readable format, e.g., '2m 45s' or '35s'."""
    if not seconds or seconds <= 0:
        return "0s"
    seconds = int(round(seconds))
    mins, secs = divmod(seconds, 60)
    hours, mins = divmod(mins, 60)
    if hours > 0:
        return f"{hours}h {mins}m"
    if mins > 0:
        return f"{mins}m {secs}s"
    return f"{secs}s"


def format_relative_time(dt_utc: datetime) -> str:
    """Return friendly relative time like 'Just now', '2m ago', '1h ago'."""
    if not dt_utc:
        return "Just now"
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    now_utc = datetime.now(timezone.utc)
    diff = (now_utc - dt_utc).total_seconds()
    if diff < 10:
        return "Just now"
    if diff < 60:
        return f"{int(diff)}s ago"
    if diff < 3600:
        return f"{int(diff // 60)}m ago"
    if diff < 86400:
        return f"{int(diff // 3600)}h ago"
    return f"{int(diff // 86400)}d ago"


SECTION_LABELS = {
    "hero-section": "Hero Banner (Vedic Intro)",
    "category-section": "Sacred Categories Grid",
    "jyotish-section": "Jyotish & Kundali Consultation",
    "puja-section": "Vedic Pujas & Ceremonies",
    "bracelets-section": "Healing Gemstone Bracelets",
    "rudraksha-section": "Divine Rudraksha & Malas",
    "ratna-section": "Energised Gemstones (Ratna)",
    "yantra-section": "Sacred Yantras & Idols",
    "puja-samagri-section": "Pure Puja Samagri",
    "video-section": "Devotional Videos & Darshan",
    "testimonials-section": "Devotee Experiences & Reviews",
    "blog-section": "Spiritual Wisdom & Blog",
    "why-section": "Why Choose AstroVeda",
    "about-section": "About Swami Guruji",
    "footer-section": "Footer Navigation & Contact",
    "cart-panel": "Cart & Basket Panel",
    "checkout-modal": "Checkout & Payment Flow",
    "puja-booking-modal": "Puja Booking Flow",
    "contact-modal": "Contact & Enquiry Form",
}


class AnalyticsService:

    @staticmethod
    def get_ist_now() -> datetime:
        return datetime.now(IST)

    @staticmethod
    def parse_date_range(range_type: str = "today", custom_start: Optional[str] = None, custom_end: Optional[str] = None) -> Tuple[datetime, datetime, datetime, datetime, str]:
        """
        Calculates UTC start and end dates based on Asia/Kolkata calendar days.
        Also returns comparison period (prev_start, prev_end) and human label.
        All database queries use UTC datetimes (naive in SQLite).
        """
        now_ist = datetime.now(IST)
        today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end_ist = now_ist.replace(hour=23, minute=59, second=59, microsecond=999999)

        if range_type == "today":
            start_ist = today_start_ist
            end_ist = now_ist
            # Comparison: Yesterday from 00:00 to current time of day
            prev_start_ist = today_start_ist - timedelta(days=1)
            prev_end_ist = now_ist - timedelta(days=1)
            label = "Today"

        elif range_type == "yesterday":
            start_ist = today_start_ist - timedelta(days=1)
            end_ist = start_ist.replace(hour=23, minute=59, second=59, microsecond=999999)
            # Comparison: Day before yesterday
            prev_start_ist = start_ist - timedelta(days=1)
            prev_end_ist = prev_start_ist.replace(hour=23, minute=59, second=59, microsecond=999999)
            label = "Yesterday"

        elif range_type == "7d":
            start_ist = (today_start_ist - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
            end_ist = now_ist
            prev_start_ist = (start_ist - timedelta(days=7))
            prev_end_ist = start_ist
            label = "Last 7 Days"

        elif range_type == "30d":
            start_ist = (today_start_ist - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
            end_ist = now_ist
            prev_start_ist = (start_ist - timedelta(days=30))
            prev_end_ist = start_ist
            label = "Last 30 Days"

        elif range_type == "custom" and custom_start and custom_end:
            try:
                cs_dt = datetime.strptime(custom_start, "%Y-%m-%d")
                ce_dt = datetime.strptime(custom_end, "%Y-%m-%d")
                start_ist = cs_dt.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=IST)
                end_ist = ce_dt.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=IST)
                duration = end_ist - start_ist
                prev_start_ist = start_ist - duration
                prev_end_ist = start_ist
                label = f"{custom_start} to {custom_end}"
            except Exception:
                # Fallback to today
                start_ist = today_start_ist
                end_ist = now_ist
                prev_start_ist = today_start_ist - timedelta(days=1)
                prev_end_ist = now_ist - timedelta(days=1)
                label = "Today"
        else:
            start_ist = today_start_ist
            end_ist = now_ist
            prev_start_ist = today_start_ist - timedelta(days=1)
            prev_end_ist = now_ist - timedelta(days=1)
            label = "Today"

        # Convert IST to UTC naive datetime for DB queries
        start_utc = start_ist.astimezone(timezone.utc).replace(tzinfo=None)
        end_utc = end_ist.astimezone(timezone.utc).replace(tzinfo=None)
        prev_start_utc = prev_start_ist.astimezone(timezone.utc).replace(tzinfo=None)
        prev_end_utc = prev_end_ist.astimezone(timezone.utc).replace(tzinfo=None)

        return start_utc, end_utc, prev_start_utc, prev_end_utc, label

    @staticmethod
    def get_summary_metrics(start_utc: datetime, end_utc: datetime, prev_start_utc: datetime, prev_end_utc: datetime) -> Dict[str, Any]:
        """Calculates the 6 clearly defined primary summary metrics."""
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        five_min_ago = now_utc - timedelta(minutes=5)

        # 1. Active Now (5 minutes): distinct visitors with a qualifying foreground heartbeat or activity in last 5 minutes.
        # INDEPENDENT of historical date filter!
        active_now = db.session.query(func.count(func.distinct(AnalyticsSession.visitor_id))).filter(
            AnalyticsSession.last_heartbeat_at >= five_min_ago
        ).scalar() or 0

        # Also fallback/check recent events within last 5 minutes
        if active_now == 0:
            active_events = db.session.query(func.count(func.distinct(AnalyticsEvent.visitor_id))).filter(
                AnalyticsEvent.created_at >= five_min_ago
            ).scalar() or 0
            active_now = active_events

        # 2. Visitors Today: distinct visitor IDs active today in Asia/Kolkata
        today_start_ist = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_utc = today_start_ist.astimezone(timezone.utc).replace(tzinfo=None)
        visitors_today = db.session.query(func.count(func.distinct(AnalyticsSession.visitor_id))).filter(
            AnalyticsSession.last_active_at >= today_start_utc
        ).scalar() or 0
        if visitors_today == 0:
            visitors_today = db.session.query(func.count(func.distinct(AnalyticsEvent.visitor_id))).filter(
                AnalyticsEvent.created_at >= today_start_utc
            ).scalar() or 0

        # 3. Total Visits: number of sessions started in selected period
        total_visits = db.session.query(func.count(AnalyticsSession.id)).filter(
            AnalyticsSession.started_at >= start_utc,
            AnalyticsSession.started_at <= end_utc
        ).scalar() or 0

        prev_visits = db.session.query(func.count(AnalyticsSession.id)).filter(
            AnalyticsSession.started_at >= prev_start_utc,
            AnalyticsSession.started_at <= prev_end_utc
        ).scalar() or 0

        visits_diff_pct = AnalyticsService._calc_diff_pct(total_visits, prev_visits)

        # 4. Unique Visitors: distinct visitor IDs in the selected period
        unique_visitors = db.session.query(func.count(func.distinct(AnalyticsSession.visitor_id))).filter(
            AnalyticsSession.started_at >= start_utc,
            AnalyticsSession.started_at <= end_utc
        ).scalar() or 0

        prev_unique = db.session.query(func.count(func.distinct(AnalyticsSession.visitor_id))).filter(
            AnalyticsSession.started_at >= prev_start_utc,
            AnalyticsSession.started_at <= prev_end_utc
        ).scalar() or 0

        unique_diff_pct = AnalyticsService._calc_diff_pct(unique_visitors, prev_unique)

        # 5. Page Views: valid page-view events in the selected period
        page_views = db.session.query(func.count(AnalyticsEvent.id)).filter(
            AnalyticsEvent.event_type == "pageview",
            AnalyticsEvent.created_at >= start_utc,
            AnalyticsEvent.created_at <= end_utc
        ).scalar() or 0

        prev_page_views = db.session.query(func.count(AnalyticsEvent.id)).filter(
            AnalyticsEvent.event_type == "pageview",
            AnalyticsEvent.created_at >= prev_start_utc,
            AnalyticsEvent.created_at <= prev_end_utc
        ).scalar() or 0

        page_views_diff_pct = AnalyticsService._calc_diff_pct(page_views, prev_page_views)

        # 6. Average Engaged Session Time: average foreground, non-idle engagement time per session
        avg_engaged_raw = db.session.query(func.avg(AnalyticsSession.engaged_seconds)).filter(
            AnalyticsSession.started_at >= start_utc,
            AnalyticsSession.started_at <= end_utc,
            AnalyticsSession.engaged_seconds > 0
        ).scalar() or 0

        avg_engaged_sec = int(round(float(avg_engaged_raw))) if avg_engaged_raw else 0

        prev_avg_raw = db.session.query(func.avg(AnalyticsSession.engaged_seconds)).filter(
            AnalyticsSession.started_at >= prev_start_utc,
            AnalyticsSession.started_at <= prev_end_utc,
            AnalyticsSession.engaged_seconds > 0
        ).scalar() or 0
        prev_avg_sec = int(round(float(prev_avg_raw))) if prev_avg_raw else 0

        avg_engaged_diff_pct = AnalyticsService._calc_diff_pct(avg_engaged_sec, prev_avg_sec)

        return {
            "active_now": active_now,
            "visitors_today": visitors_today,
            "total_visits": total_visits,
            "visits_diff_pct": visits_diff_pct,
            "unique_visitors": unique_visitors,
            "unique_diff_pct": unique_diff_pct,
            "page_views": page_views,
            "page_views_diff_pct": page_views_diff_pct,
            "avg_engaged_seconds": avg_engaged_sec,
            "avg_engaged_formatted": format_duration(avg_engaged_sec),
            "avg_engaged_diff_pct": avg_engaged_diff_pct,
        }

    @staticmethod
    def _calc_diff_pct(current: float, previous: float) -> int:
        if previous > 0:
            diff = ((current - previous) / previous) * 100
            return int(round(diff))
        elif current > 0:
            return 100
        return 0

    @staticmethod
    def get_most_visited_pages(start_utc: datetime, end_utc: datetime, limit: int = 10) -> List[Dict[str, Any]]:
        """Returns top visited pages ordered by pageview volume."""
        # Query pageviews grouped by path
        results = db.session.query(
            AnalyticsEvent.path,
            func.max(AnalyticsEvent.title).label("title"),
            func.count(AnalyticsEvent.id).label("views_count"),
            func.count(func.distinct(AnalyticsEvent.visitor_id)).label("unique_visitors"),
            func.avg(AnalyticsEvent.duration_seconds).label("avg_duration")
        ).filter(
            AnalyticsEvent.event_type == "pageview",
            AnalyticsEvent.created_at >= start_utc,
            AnalyticsEvent.created_at <= end_utc
        ).group_by(AnalyticsEvent.path).order_by(desc("views_count")).limit(limit).all()

        total_pv = sum(r.views_count for r in results) or 1

        pages = []
        for r in results:
            avg_sec = int(round(float(r.avg_duration or 0)))
            pct = round((r.views_count / total_pv) * 100, 1)
            pages.append({
                "path": r.path or "/",
                "title": r.title or r.path or "Home",
                "views_count": r.views_count,
                "unique_visitors": r.unique_visitors,
                "avg_duration": avg_sec,
                "avg_duration_formatted": format_duration(avg_sec),
                "pct_of_total": pct,
            })
        return pages

    @staticmethod
    def get_most_engaged_sections(start_utc: datetime, end_utc: datetime, limit: int = 10) -> List[Dict[str, Any]]:
        """Returns most engaged storefront sections ordered by engagement volume & time."""
        results = db.session.query(
            AnalyticsEvent.section_name,
            func.count(AnalyticsEvent.id).label("engagement_count"),
            func.sum(AnalyticsEvent.duration_seconds).label("total_duration"),
            func.count(func.distinct(AnalyticsEvent.visitor_id)).label("unique_visitors"),
            func.avg(AnalyticsEvent.duration_seconds).label("avg_duration")
        ).filter(
            AnalyticsEvent.event_type.in_(["section_engagement", "section_view"]),
            AnalyticsEvent.section_name.isnot(None),
            AnalyticsEvent.section_name != "",
            AnalyticsEvent.created_at >= start_utc,
            AnalyticsEvent.created_at <= end_utc
        ).group_by(AnalyticsEvent.section_name).order_by(desc("total_duration"), desc("engagement_count")).limit(limit).all()

        sections = []
        for r in results:
            total_sec = int(round(float(r.total_duration or 0)))
            avg_sec = int(round(float(r.avg_duration or 0)))
            sec_name = r.section_name
            friendly_label = SECTION_LABELS.get(sec_name, sec_name.replace("-", " ").title())
            sections.append({
                "section_id": sec_name,
                "section_label": friendly_label,
                "engagement_count": r.engagement_count,
                "unique_visitors": r.unique_visitors,
                "total_duration": total_sec,
                "total_duration_formatted": format_duration(total_sec),
                "avg_duration": avg_sec,
                "avg_duration_formatted": format_duration(avg_sec),
            })
        return sections

    @staticmethod
    def get_live_activity_feed(limit: int = 35) -> List[Dict[str, Any]]:
        """Returns the most recent visitor actions for the live feed."""
        events = AnalyticsEvent.query.order_by(AnalyticsEvent.created_at.desc()).limit(limit).all()
        feed = []
        for ev in events:
            ev_dt_ist = ev.created_at.replace(tzinfo=timezone.utc).astimezone(IST)
            meta = ev.get_metadata()
            # Generate friendly action description
            action_desc = AnalyticsService._describe_event(ev, meta)
            
            feed.append({
                "id": ev.id,
                "visitor_short_id": f"#{ev.visitor_id[-6:]}" if ev.visitor_id else "#visitor",
                "visitor_id": ev.visitor_id,
                "event_type": ev.event_type,
                "path": ev.path or "/",
                "section_name": ev.section_name or "",
                "section_label": SECTION_LABELS.get(ev.section_name, ev.section_name or ""),
                "action_desc": action_desc,
                "duration_seconds": ev.duration_seconds,
                "duration_formatted": format_duration(ev.duration_seconds) if ev.duration_seconds else None,
                "timestamp_ist": ev_dt_ist.strftime("%I:%M:%S %p"),
                "relative_time": format_relative_time(ev.created_at),
                "device_info": meta.get("device_type", "web"),
                "city": meta.get("city") or "India",
            })
        return feed

    @staticmethod
    def _describe_event(ev: AnalyticsEvent, meta: dict) -> str:
        t = ev.event_type
        if t == "pageview":
            return f"Viewed {ev.title or ev.path or 'page'}"
        elif t == "section_engagement":
            lbl = SECTION_LABELS.get(ev.section_name, ev.section_name or "section")
            dur = format_duration(ev.duration_seconds)
            return f"Engaged with {lbl} ({dur})"
        elif t == "section_view":
            lbl = SECTION_LABELS.get(ev.section_name, ev.section_name or "section")
            return f"Scrolled into view: {lbl}"
        elif t == "modal_open":
            m_name = meta.get("modal_name") or ev.section_name or "modal"
            return f"Opened {m_name.replace('-', ' ').title()}"
        elif t == "heartbeat":
            return f"Active in foreground ({ev.path})"
        elif t == "action":
            act = meta.get("action_name") or "User Action"
            return f"Interacted: {act}"
        return f"{t.replace('_', ' ').title()}"

    @staticmethod
    def ingest_tracking_data(payload: dict, ip_address: str, user_agent_str: str) -> bool:
        """
        Ingest client tracking payload: visitors, sessions, and events.
        """
        try:
            visitor_id = payload.get("visitor_id")
            session_id = payload.get("session_id")
            if not visitor_id or not session_id:
                return False

            now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
            device_info = payload.get("device", {})
            device_type = device_info.get("type", "desktop")
            browser = device_info.get("browser", "Unknown")
            os_name = device_info.get("os", "Unknown")

            # 1. Visitor Upsert
            visitor = AnalyticsVisitor.query.filter_by(id=visitor_id).first()
            if not visitor:
                visitor = AnalyticsVisitor(
                    id=visitor_id,
                    first_seen_at=now_utc,
                    last_seen_at=now_utc,
                    device_type=device_type,
                    browser=browser,
                    os=os_name,
                    city=payload.get("city") or "India",
                    country="India",
                    total_sessions=1,
                    total_pageviews=0,
                )
                db.session.add(visitor)
            else:
                visitor.last_seen_at = now_utc
                if device_type:
                    visitor.device_type = device_type
                if browser:
                    visitor.browser = browser

            # 2. Session Upsert
            session = AnalyticsSession.query.filter_by(id=session_id).first()
            entry_path = payload.get("path") or payload.get("entry_path") or "/"
            referrer = payload.get("referrer")

            if not session:
                session = AnalyticsSession(
                    id=session_id,
                    visitor_id=visitor_id,
                    started_at=now_utc,
                    last_active_at=now_utc,
                    last_heartbeat_at=now_utc,
                    engaged_seconds=0,
                    entry_path=entry_path,
                    referrer=referrer,
                    pageviews_count=0,
                    is_active=True,
                )
                db.session.add(session)
                visitor.total_sessions = (visitor.total_sessions or 0) + 1
            else:
                session.last_active_at = now_utc
                session.last_heartbeat_at = now_utc
                session.exit_path = entry_path

            # 3. Events Ingestion
            events_data = payload.get("events", [])
            for ed in events_data:
                ev_type = ed.get("type", "pageview")
                ev_path = ed.get("path") or entry_path
                sec_name = ed.get("section")
                duration = int(round(float(ed.get("duration") or 0)))
                ev_title = ed.get("title")

                # Accumulate session metrics
                if ev_type == "pageview":
                    session.pageviews_count = (session.pageviews_count or 0) + 1
                    visitor.total_pageviews = (visitor.total_pageviews or 0) + 1
                if duration > 0:
                    session.engaged_seconds = (session.engaged_seconds or 0) + duration

                event = AnalyticsEvent(
                    session_id=session_id,
                    visitor_id=visitor_id,
                    event_type=ev_type,
                    path=ev_path,
                    section_name=sec_name,
                    title=ev_title,
                    duration_seconds=duration,
                    created_at=now_utc,
                )
                event.set_metadata({
                    **ed.get("metadata", {}),
                    "device_type": device_type,
                    "browser": browser,
                })
                db.session.add(event)

            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            return False

    @staticmethod
    def ingest_heartbeat(payload: dict) -> bool:
        """Lightweight heartbeat updating session foreground time and active timestamp."""
        try:
            visitor_id = payload.get("visitor_id")
            session_id = payload.get("session_id")
            if not visitor_id or not session_id:
                return False

            now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
            delta = int(round(float(payload.get("engaged_delta") or 0)))
            # Cap delta to max 60s per heartbeat to prevent anomalies
            delta = max(0, min(delta, 60))

            session = AnalyticsSession.query.filter_by(id=session_id).first()
            if session:
                session.last_heartbeat_at = now_utc
                session.last_active_at = now_utc
                session.engaged_seconds = (session.engaged_seconds or 0) + delta
                if payload.get("current_path"):
                    session.exit_path = payload.get("current_path")
            else:
                # Create session if heartbeat received for new session
                session = AnalyticsSession(
                    id=session_id,
                    visitor_id=visitor_id,
                    started_at=now_utc,
                    last_active_at=now_utc,
                    last_heartbeat_at=now_utc,
                    engaged_seconds=delta,
                    entry_path=payload.get("current_path") or "/",
                    pageviews_count=1,
                    is_active=True,
                )
                db.session.add(session)

            visitor = AnalyticsVisitor.query.filter_by(id=visitor_id).first()
            if visitor:
                visitor.last_seen_at = now_utc

            # If section duration included, record a section engagement event
            curr_sec = payload.get("current_section")
            if curr_sec and delta > 0:
                ev = AnalyticsEvent(
                    session_id=session_id,
                    visitor_id=visitor_id,
                    event_type="section_engagement",
                    path=payload.get("current_path") or "/",
                    section_name=curr_sec,
                    duration_seconds=delta,
                    created_at=now_utc,
                )
                db.session.add(ev)

            db.session.commit()
            return True
        except Exception:
            db.session.rollback()
            return False

    @staticmethod
    def export_csv(start_utc: datetime, end_utc: datetime, range_label: str) -> str:
        """Generates a comprehensive CSV export containing KPIs, top pages, sections, and recent events."""
        metrics = AnalyticsService.get_summary_metrics(start_utc, end_utc, start_utc, end_utc)
        pages = AnalyticsService.get_most_visited_pages(start_utc, end_utc, limit=50)
        sections = AnalyticsService.get_most_engaged_sections(start_utc, end_utc, limit=50)
        events = AnalyticsEvent.query.filter(
            AnalyticsEvent.created_at >= start_utc,
            AnalyticsEvent.created_at <= end_utc
        ).order_by(AnalyticsEvent.created_at.desc()).limit(200).all()

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow(["=== ASTROVEDA WEBSITE ANALYTICS & LIVE ACTIVITY REPORT ==="])
        writer.writerow(["Report Range:", range_label])
        writer.writerow(["Timezone:", "Asia/Kolkata (IST)"])
        writer.writerow(["Generated At:", datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")])
        writer.writerow([])

        # Summary KPIs
        writer.writerow(["--- SUMMARY METRICS ---"])
        writer.writerow(["Metric", "Value", "Notes"])
        writer.writerow(["Active Now (5 minutes)", metrics["active_now"], "Distinct visitors with qualifying foreground heartbeat"])
        writer.writerow(["Visitors Today", metrics["visitors_today"], "Distinct visitor IDs today in Asia/Kolkata"])
        writer.writerow(["Total Visits", metrics["total_visits"], "Total sessions in selected period"])
        writer.writerow(["Unique Visitors", metrics["unique_visitors"], "Distinct visitor IDs in selected period"])
        writer.writerow(["Page Views", metrics["page_views"], "Valid page-view events in selected period"])
        writer.writerow(["Average Engaged Session Time", metrics["avg_engaged_formatted"], f"{metrics['avg_engaged_seconds']} seconds"])
        writer.writerow([])

        # Most Visited Pages
        writer.writerow(["--- MOST VISITED PAGES ---"])
        writer.writerow(["Path", "Page Title", "Page Views", "Unique Visitors", "Avg Time on Page (sec)", "Avg Time Formatted", "% of Total"])
        for p in pages:
            writer.writerow([p["path"], p["title"], p["views_count"], p["unique_visitors"], p["avg_duration"], p["avg_duration_formatted"], f"{p['pct_of_total']}%"])
        writer.writerow([])

        # Most Engaged Sections
        writer.writerow(["--- MOST ENGAGED SECTIONS ---"])
        writer.writerow(["Section ID", "Section Label", "Engagements", "Unique Visitors", "Total Engaged Time (sec)", "Total Formatted", "Avg Time Formatted"])
        for s in sections:
            writer.writerow([s["section_id"], s["section_label"], s["engagement_count"], s["unique_visitors"], s["total_duration"], s["total_duration_formatted"], s["avg_duration_formatted"]])
        writer.writerow([])

        # Detailed Event Log
        writer.writerow(["--- RECENT ACTIVITY LOG (Up to 200) ---"])
        writer.writerow(["Event ID", "Timestamp (IST)", "Visitor ID", "Event Type", "Path", "Section", "Duration (sec)"])
        for ev in events:
            dt_ist = ev.created_at.replace(tzinfo=timezone.utc).astimezone(IST).strftime("%Y-%m-%d %H:%M:%S")
            writer.writerow([ev.id, dt_ist, ev.visitor_id, ev.event_type, ev.path, ev.section_name or "", ev.duration_seconds])

        return output.getvalue()
