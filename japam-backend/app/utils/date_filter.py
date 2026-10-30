import calendar
import zoneinfo
from datetime import datetime, timedelta, timezone, date
from typing import Dict, Any, Optional, Tuple
from sqlalchemy import func, cast, Integer, or_, and_
from app.extensions import db

IST = zoneinfo.ZoneInfo("Asia/Kolkata")

DAY_NAME_TO_INT = {
    "sunday": 0, "sun": 0, "0": 0,
    "monday": 1, "mon": 1, "1": 1,
    "tuesday": 2, "tue": 2, "2": 2,
    "wednesday": 3, "wed": 3, "3": 3,
    "thursday": 4, "thu": 4, "4": 4,
    "friday": 5, "fri": 5, "5": 5,
    "saturday": 6, "sat": 6, "6": 6, "7": 0
}

DAY_INT_TO_NAME = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
}

TIME_PERIOD_HOURS = {
    "morning": (6, 12),    # 06:00 to 11:59 AM
    "afternoon": (12, 17), # 12:00 to 04:59 PM
    "evening": (17, 21),   # 05:00 to 08:59 PM
    "night": (21, 6),      # 09:00 PM to 05:59 AM
}

TIME_PERIOD_LABELS = {
    "morning": "Morning (6 AM - 12 PM)",
    "afternoon": "Afternoon (12 PM - 5 PM)",
    "evening": "Evening (5 PM - 9 PM)",
    "night": "Night (9 PM - 6 AM)",
}


def parse_time_slot_period(time_slot_str: Optional[str]) -> Optional[str]:
    """Helper to detect time period (morning/afternoon/evening/night) from strings like '10:00 AM'."""
    if not time_slot_str:
        return None
    raw = time_slot_str.strip().upper()
    try:
        parts = raw.split(":")
        hour = int(parts[0])
        is_pm = "PM" in raw
        is_am = "AM" in raw
        if is_pm and hour < 12:
            hour += 12
        elif is_am and hour == 12:
            hour = 0

        if 6 <= hour < 12:
            return "morning"
        elif 12 <= hour < 17:
            return "afternoon"
        elif 17 <= hour < 21:
            return "evening"
        else:
            return "night"
    except Exception:
        return None


def extract_date_filter_context(request_args: Any) -> Dict[str, Any]:
    """
    Extracts and standardizes date, time, day, and month query parameters.
    Returns cleaned values, active status, and human-readable badges.
    """
    args = request_args or {}

    date_preset = (args.get("date_preset") or "").strip().lower()
    filter_date = (args.get("filter_date") or args.get("date") or "").strip()
    filter_month = (args.get("filter_month") or args.get("month") or "").strip()
    filter_day = (args.get("filter_day") or args.get("day") or args.get("day_of_week") or "").strip().lower()
    filter_time = (args.get("filter_time") or args.get("time") or args.get("time_period") or "").strip().lower()
    start_date = (args.get("start_date") or "").strip()
    end_date = (args.get("end_date") or "").strip()

    active_badges = []

    if date_preset and date_preset != "all":
        preset_names = {
            "today": "Today",
            "yesterday": "Yesterday",
            "this_week": "This Week",
            "this_month": "This Month",
            "last_month": "Last Month",
        }
        active_badges.append({"key": "date_preset", "label": f"Preset: {preset_names.get(date_preset, date_preset.title())}"})

    if filter_date:
        try:
            parsed_d = datetime.strptime(filter_date, "%Y-%m-%d")
            active_badges.append({"key": "filter_date", "label": f"Date: {parsed_d.strftime('%d %b %Y')}"})
        except Exception:
            active_badges.append({"key": "filter_date", "label": f"Date: {filter_date}"})

    if filter_month:
        try:
            parsed_m = datetime.strptime(filter_month, "%Y-%m")
            active_badges.append({"key": "filter_month", "label": f"Month: {parsed_m.strftime('%B %Y')}"})
        except Exception:
            active_badges.append({"key": "filter_month", "label": f"Month: {filter_month}"})

    if filter_day and filter_day in DAY_NAME_TO_INT:
        dow_int = DAY_NAME_TO_INT[filter_day]
        active_badges.append({"key": "filter_day", "label": f"Day: {DAY_INT_TO_NAME[dow_int]}"})

    if filter_time and filter_time in TIME_PERIOD_LABELS:
        active_badges.append({"key": "filter_time", "label": f"Time: {TIME_PERIOD_LABELS[filter_time]}"})

    if start_date or end_date:
        active_badges.append({"key": "range", "label": f"Range: {start_date or '...'} to {end_date or '...'}"})

    has_active = len(active_badges) > 0

    return {
        "date_preset": date_preset,
        "filter_date": filter_date,
        "filter_month": filter_month,
        "filter_day": filter_day,
        "filter_time": filter_time,
        "start_date": start_date,
        "end_date": end_date,
        "has_active_filters": has_active,
        "active_badges": active_badges,
    }


def apply_date_time_filters(query, model_col, request_args=None, extra_time_col=None, date_is_date_only: bool = False):
    """
    Filters a SQLAlchemy query by:
      - Date preset ('today', 'yesterday', 'this_week', 'this_month', 'last_month')
      - Specific Date ('filter_date' or 'date', YYYY-MM-DD)
      - Date Range ('start_date' and 'end_date', YYYY-MM-DD)
      - Month ('filter_month' or 'month', YYYY-MM)
      - Day of Week ('filter_day' or 'day', Monday - Sunday)
      - Time of Day ('filter_time' or 'time', Morning, Afternoon, Evening, Night)

    Handles both naive/UTC datetimes (converted to IST) and pure Date columns.
    Cross-dialect support: SQLite strftime and PostgreSQL extract/timezone.
    """
    ctx = extract_date_filter_context(request_args)
    date_preset = ctx["date_preset"]
    filter_date = ctx["filter_date"]
    filter_month = ctx["filter_month"]
    filter_day = ctx["filter_day"]
    filter_time = ctx["filter_time"]
    start_date_str = ctx["start_date"]
    end_date_str = ctx["end_date"]

    now_ist = datetime.now(IST)
    is_sqlite = db.engine.dialect.name == "sqlite"

    # -------------------------------------------------------------------------
    # 1. Date Presets & Explicit Date / Date Ranges
    # -------------------------------------------------------------------------
    range_start_ist: Optional[datetime] = None
    range_end_ist: Optional[datetime] = None

    if date_preset == "today":
        range_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        range_end_ist = now_ist.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif date_preset == "yesterday":
        yest_ist = now_ist - timedelta(days=1)
        range_start_ist = yest_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        range_end_ist = yest_ist.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif date_preset == "this_week":
        # Monday = 0, Sunday = 6 in python weekday()
        cur_weekday = now_ist.weekday()
        mon_ist = now_ist - timedelta(days=cur_weekday)
        sun_ist = mon_ist + timedelta(days=6)
        range_start_ist = mon_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        range_end_ist = sun_ist.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif date_preset == "this_month":
        range_start_ist = now_ist.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        _, last_day = calendar.monthrange(now_ist.year, now_ist.month)
        range_end_ist = now_ist.replace(day=last_day, hour=23, minute=59, second=59, microsecond=999999)
    elif date_preset == "last_month":
        first_this_month = now_ist.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_prev_month = first_this_month - timedelta(days=1)
        _, last_day_prev = calendar.monthrange(last_prev_month.year, last_prev_month.month)
        range_start_ist = last_prev_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        range_end_ist = last_prev_month.replace(day=last_day_prev, hour=23, minute=59, second=59, microsecond=999999)

    # Specific single date takes precedence if supplied
    if filter_date:
        try:
            d_obj = datetime.strptime(filter_date, "%Y-%m-%d")
            range_start_ist = d_obj.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=IST)
            range_end_ist = d_obj.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=IST)
        except Exception:
            pass
    elif start_date_str or end_date_str:
        try:
            if start_date_str:
                s_obj = datetime.strptime(start_date_str, "%Y-%m-%d")
                range_start_ist = s_obj.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=IST)
            if end_date_str:
                e_obj = datetime.strptime(end_date_str, "%Y-%m-%d")
                range_end_ist = e_obj.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=IST)
        except Exception:
            pass

    # Apply range filter if resolved
    if range_start_ist or range_end_ist:
        if date_is_date_only:
            # model_col is a Date type
            if range_start_ist and range_end_ist and range_start_ist.date() == range_end_ist.date():
                query = query.filter(model_col == range_start_ist.date())
            else:
                if range_start_ist:
                    query = query.filter(model_col >= range_start_ist.date())
                if range_end_ist:
                    query = query.filter(model_col <= range_end_ist.date())
        else:
            # model_col is a DateTime type stored in UTC / naive
            if range_start_ist:
                start_utc = range_start_ist.astimezone(timezone.utc).replace(tzinfo=None)
                query = query.filter(model_col >= start_utc)
            if range_end_ist:
                end_utc = range_end_ist.astimezone(timezone.utc).replace(tzinfo=None)
                query = query.filter(model_col <= end_utc)

    # -------------------------------------------------------------------------
    # 2. Month Filter (e.g. YYYY-MM or MM)
    # -------------------------------------------------------------------------
    if filter_month:
        try:
            if "-" in filter_month:
                parts = filter_month.split("-")
                m_year = int(parts[0])
                m_num = int(parts[1])
                _, m_last_day = calendar.monthrange(m_year, m_num)
                m_start_ist = datetime(m_year, m_num, 1, 0, 0, 0, tzinfo=IST)
                m_end_ist = datetime(m_year, m_num, m_last_day, 23, 59, 59, 999999, tzinfo=IST)
                if date_is_date_only:
                    query = query.filter(model_col >= m_start_ist.date(), model_col <= m_end_ist.date())
                else:
                    m_start_utc = m_start_ist.astimezone(timezone.utc).replace(tzinfo=None)
                    m_end_utc = m_end_ist.astimezone(timezone.utc).replace(tzinfo=None)
                    query = query.filter(model_col >= m_start_utc, model_col <= m_end_utc)
            else:
                # Just month number 1..12 across any year
                m_num = int(filter_month)
                m_str = f"{m_num:02d}"
                if is_sqlite:
                    if date_is_date_only:
                        query = query.filter(func.strftime("%m", model_col) == m_str)
                    else:
                        query = query.filter(func.strftime("%m", model_col, "+5 hours", "+30 minutes") == m_str)
                else:
                    if date_is_date_only:
                        query = query.filter(func.extract("month", model_col) == m_num)
                    else:
                        query = query.filter(func.extract("month", func.timezone("Asia/Kolkata", model_col)) == m_num)
        except Exception:
            pass

    # -------------------------------------------------------------------------
    # 3. Day of Week Filter (Monday - Sunday)
    # -------------------------------------------------------------------------
    if filter_day and filter_day in DAY_NAME_TO_INT:
        dow_target = DAY_NAME_TO_INT[filter_day]  # 0=Sunday, 1=Monday, ..., 6=Saturday
        if is_sqlite:
            if date_is_date_only:
                query = query.filter(func.strftime("%w", model_col) == str(dow_target))
            else:
                query = query.filter(func.strftime("%w", model_col, "+5 hours", "+30 minutes") == str(dow_target))
        else:
            if date_is_date_only:
                query = query.filter(func.extract("dow", model_col) == dow_target)
            else:
                query = query.filter(func.extract("dow", func.timezone("Asia/Kolkata", model_col)) == dow_target)

    # -------------------------------------------------------------------------
    # 4. Time Period Filter (Morning, Afternoon, Evening, Night)
    # -------------------------------------------------------------------------
    if filter_time and filter_time in TIME_PERIOD_HOURS:
        if date_is_date_only and extra_time_col is not None:
            # model_col is Date, but extra_time_col is e.g. '10:00 AM'
            if filter_time == "morning":
                # 06..11 AM
                patterns = ["06:% AM", "07:% AM", "08:% AM", "09:% AM", "10:% AM", "11:% AM", "6:% AM", "7:% AM", "8:% AM", "9:% AM"]
            elif filter_time == "afternoon":
                # 12 PM, 01..04 PM
                patterns = ["12:% PM", "01:% PM", "02:% PM", "03:% PM", "04:% PM", "1:% PM", "2:% PM", "3:% PM", "4:% PM"]
            elif filter_time == "evening":
                # 05..08 PM
                patterns = ["05:% PM", "06:% PM", "07:% PM", "08:% PM", "5:% PM", "6:% PM", "7:% PM", "8:% PM"]
            else: # night
                patterns = ["09:% PM", "10:% PM", "11:% PM", "9:% PM", "12:% AM", "01:% AM", "02:% AM", "03:% AM", "04:% AM", "05:% AM"]
            conds = [extra_time_col.ilike(f"%{p}%") for p in patterns]
            query = query.filter(or_(*conds))
        else:
            # Apply hour condition on model_col
            if is_sqlite:
                hour_col = cast(func.strftime("%H", model_col, "+5 hours", "+30 minutes"), Integer)
            else:
                hour_col = cast(func.extract("hour", func.timezone("Asia/Kolkata", model_col)), Integer)

            if filter_time == "morning":
                query = query.filter(and_(hour_col >= 6, hour_col < 12))
            elif filter_time == "afternoon":
                query = query.filter(and_(hour_col >= 12, hour_col < 17))
            elif filter_time == "evening":
                query = query.filter(and_(hour_col >= 17, hour_col < 21))
            elif filter_time == "night":
                query = query.filter(or_(hour_col >= 21, hour_col < 6))

    return query
