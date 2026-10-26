import json
from datetime import datetime, timezone
from app.extensions import db


class AnalyticsVisitor(db.Model):
    __tablename__ = "analytics_visitors"

    id = db.Column(db.String(64), primary_key=True)  # Client generated UUID or hash: av_vid_...
    first_seen_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    last_seen_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    device_type = db.Column(db.String(32), default="desktop", nullable=False)  # desktop, mobile, tablet
    browser = db.Column(db.String(64), nullable=True)
    os = db.Column(db.String(64), nullable=True)
    ip_hash = db.Column(db.String(64), nullable=True, index=True)
    country = db.Column(db.String(64), default="India", nullable=False)
    city = db.Column(db.String(64), nullable=True)
    total_sessions = db.Column(db.Integer, default=1, nullable=False)
    total_pageviews = db.Column(db.Integer, default=1, nullable=False)

    sessions = db.relationship("AnalyticsSession", backref="visitor", lazy="dynamic", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<AnalyticsVisitor {self.id} {self.device_type}>"


class AnalyticsSession(db.Model):
    __tablename__ = "analytics_sessions"

    id = db.Column(db.String(64), primary_key=True)  # Client generated UUID or hash: av_sid_...
    visitor_id = db.Column(db.String(64), db.ForeignKey("analytics_visitors.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    last_active_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    last_heartbeat_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    ended_at = db.Column(db.DateTime, nullable=True)
    engaged_seconds = db.Column(db.Integer, default=0, nullable=False)  # foreground, non-idle time
    entry_path = db.Column(db.String(255), default="/", nullable=False)
    exit_path = db.Column(db.String(255), nullable=True)
    referrer = db.Column(db.String(500), nullable=True)
    utm_source = db.Column(db.String(100), nullable=True)
    utm_medium = db.Column(db.String(100), nullable=True)
    utm_campaign = db.Column(db.String(100), nullable=True)
    pageviews_count = db.Column(db.Integer, default=0, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    events = db.relationship("AnalyticsEvent", backref="session", lazy="dynamic", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<AnalyticsSession {self.id} visitor={self.visitor_id} engaged={self.engaged_seconds}s>"


class AnalyticsEvent(db.Model):
    __tablename__ = "analytics_events"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    session_id = db.Column(db.String(64), db.ForeignKey("analytics_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    visitor_id = db.Column(db.String(64), nullable=False, index=True)
    event_type = db.Column(db.String(50), nullable=False, index=True)  # pageview, section_view, section_engagement, modal_open, action
    path = db.Column(db.String(255), default="/", nullable=False, index=True)
    section_name = db.Column(db.String(100), nullable=True, index=True)
    title = db.Column(db.String(255), nullable=True)
    duration_seconds = db.Column(db.Integer, default=0, nullable=False)
    metadata_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    def set_metadata(self, data: dict):
        if data:
            self.metadata_json = json.dumps(data)
        else:
            self.metadata_json = None

    def get_metadata(self) -> dict:
        if self.metadata_json:
            try:
                return json.loads(self.metadata_json)
            except Exception:
                return {}
        return {}

    def __repr__(self):
        return f"<AnalyticsEvent {self.id} {self.event_type} {self.path} {self.section_name}>"
