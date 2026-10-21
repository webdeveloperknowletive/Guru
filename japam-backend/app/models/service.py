from datetime import datetime, timezone
from decimal import Decimal
from app.extensions import db


class PujaService(db.Model):
    __tablename__ = "puja_services"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, index=True)
    slug = db.Column(db.String(220), unique=True, nullable=False, index=True)
    deity = db.Column(db.String(100), nullable=True)  # e.g., Lord Ganesha, Navagraha, Shiva, Lakshmi
    icon = db.Column(db.String(50), default="🪔", nullable=True)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))

    duration_minutes = db.Column(db.Integer, default=60, nullable=False)

    is_online_available = db.Column(db.Boolean, default=True, nullable=False)
    is_offline_available = db.Column(db.Boolean, default=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)

    inclusions = db.Column(db.JSON, default=list)  # list of strings: ["Samagri included", "Prasad delivery", "Live stream"]
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    bookings = db.relationship("PujaBooking", back_populates="service")

    @property
    def title(self):
        return self.name

    @property
    def base_price(self):
        return self.price

    def __repr__(self):
        return f"<PujaService {self.name}>"


class PujaBooking(db.Model):
    __tablename__ = "puja_bookings"

    id = db.Column(db.Integer, primary_key=True)
    booking_number = db.Column(db.String(50), unique=True, nullable=False, index=True)  # e.g. #PUJ-2024-001
    service_id = db.Column(db.Integer, db.ForeignKey("puja_services.id"), nullable=False, index=True)

    customer_name = db.Column(db.String(150), nullable=False, index=True)
    customer_email = db.Column(db.String(255), nullable=False)
    customer_phone = db.Column(db.String(30), nullable=True)

    # Spiritual particulars
    gotra = db.Column(db.String(80), nullable=True)
    nakshatra = db.Column(db.String(80), nullable=True)
    rashi = db.Column(db.String(80), nullable=True)
    sankalp_text = db.Column(db.Text, nullable=True)

    booking_date = db.Column(db.Date, nullable=False, index=True)
    time_slot = db.Column(db.String(50), nullable=False)  # e.g., '10:00 AM'
    booking_type = db.Column(db.String(50), default="online", nullable=False)  # online, offline
    priest_name = db.Column(db.String(150), nullable=True)

    # pending, confirmed, completed, cancelled
    status = db.Column(db.String(50), default="pending", nullable=False, index=True)
    amount_paid = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    meeting_link_or_venue = db.Column(db.String(500), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    service = db.relationship("PujaService", back_populates="bookings")

    def __repr__(self):
        return f"<PujaBooking {self.booking_number} - {self.customer_name}>"


class JyotishConsultation(db.Model):
    __tablename__ = "jyotish_consultations"

    id = db.Column(db.Integer, primary_key=True)
    consultation_number = db.Column(db.String(50), unique=True, nullable=False, index=True)  # e.g. #JYT-2024-001

    customer_name = db.Column(db.String(150), nullable=False, index=True)
    customer_email = db.Column(db.String(255), nullable=False)
    customer_phone = db.Column(db.String(30), nullable=True)

    # Birth Details
    dob = db.Column(db.Date, nullable=False)
    tob = db.Column(db.String(30), nullable=False)  # '07:35 AM'
    pob = db.Column(db.String(150), nullable=False)  # 'Pune, Maharashtra'

    # Kundali Consultation, Career Guidance, Marriage Matchmaking, Health, Gemstone Recommendation
    topic = db.Column(db.String(150), nullable=False, index=True)
    consultation_type = db.Column(db.String(50), default="online_video", nullable=False)  # online_video, phone, offline
    scheduled_at = db.Column(db.DateTime, nullable=True, index=True)

    # pending, confirmed, completed, cancelled
    status = db.Column(db.String(50), default="pending", nullable=False, index=True)
    astrologer_name = db.Column(db.String(150), default="Acharya Shastri Ji", nullable=True)
    astrologer_notes = db.Column(db.Text, nullable=True)  # Confidential to authorized roles

    amount_paid = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    meeting_link = db.Column(db.String(500), nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<JyotishConsultation {self.consultation_number} - {self.customer_name}>"


class AvailabilitySlot(db.Model):
    __tablename__ = "availability_slots"

    id = db.Column(db.Integer, primary_key=True)
    service_type = db.Column(db.String(50), nullable=False, index=True)  # 'puja' or 'jyotish'
    slot_date = db.Column(db.Date, nullable=False, index=True)
    start_time = db.Column(db.String(20), nullable=False)  # '10:00 AM'
    end_time = db.Column(db.String(20), nullable=False)    # '11:30 AM'
    max_capacity = db.Column(db.Integer, default=1, nullable=False)
    booked_count = db.Column(db.Integer, default=0, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    assigned_priest_or_astrologer = db.Column(db.String(150), nullable=True)
    notes = db.Column(db.String(255), nullable=True)

    @property
    def is_available(self) -> bool:
        return self.is_active and (self.booked_count < self.max_capacity)

    def __repr__(self):
        return f"<AvailabilitySlot {self.service_type} {self.slot_date} {self.start_time}>"
