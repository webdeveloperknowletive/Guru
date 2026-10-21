from datetime import datetime, timezone
from app.extensions import db


class BlogPost(db.Model):
    __tablename__ = "blog_posts"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    slug = db.Column(db.String(280), unique=True, nullable=False, index=True)
    excerpt = db.Column(db.Text, nullable=True)
    content = db.Column(db.Text, nullable=False)
    cover_image = db.Column(db.String(500), nullable=True)
    author_name = db.Column(db.String(150), default="Spiritual Editorial Team", nullable=False)
    category = db.Column(db.String(100), default="Vedic Wisdom", nullable=False)
    tags = db.Column(db.String(255), nullable=True)
    is_published = db.Column(db.Boolean, default=True, nullable=False, index=True)
    views_count = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<BlogPost {self.title}>"


class Testimonial(db.Model):
    __tablename__ = "testimonials"

    id = db.Column(db.Integer, primary_key=True)
    devotee_name = db.Column(db.String(150), nullable=False)
    devotee_city = db.Column(db.String(100), nullable=True)
    rating = db.Column(db.Integer, default=5, nullable=False)
    photo_url = db.Column(db.String(500), nullable=True)
    service_or_product = db.Column(db.String(150), nullable=True)
    blessing_text = db.Column(db.Text, nullable=False)
    is_approved = db.Column(db.Boolean, default=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<Testimonial {self.devotee_name}>"


class GurujiProfile(db.Model):
    __tablename__ = "guruji_profile"

    id = db.Column(db.Integer, primary_key=True)
    full_title = db.Column(db.String(255), nullable=False)
    spiritual_lineage = db.Column(db.String(255), nullable=True)
    bio = db.Column(db.Text, nullable=False)
    secondary_bio = db.Column(db.Text, nullable=True)
    experience_years = db.Column(db.String(50), default="25+", nullable=True)
    consultations_count = db.Column(db.String(50), default="10K+", nullable=True)
    pujas_count = db.Column(db.String(50), default="5000+", nullable=True)
    button_text = db.Column(db.String(100), default="Book Consultation →", nullable=True)
    button_url = db.Column(db.String(255), default="#jyotish", nullable=True)
    darshan_timings = db.Column(db.String(255), nullable=True)
    ashram_address = db.Column(db.Text, nullable=True)
    contact_phone = db.Column(db.String(50), nullable=True)
    contact_email = db.Column(db.String(255), nullable=True)
    profile_image = db.Column(db.String(500), nullable=True)
    visibility_settings = db.Column(db.JSON, default=dict, nullable=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    @property
    def visibility(self):
        defaults = {
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
        if self.visibility_settings and isinstance(self.visibility_settings, dict):
            defaults.update(self.visibility_settings)
        return defaults

    def __repr__(self):
        return f"<GurujiProfile {self.full_title}>"



class MediaFile(db.Model):
    __tablename__ = "media_files"

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)  # in bytes
    mime_type = db.Column(db.String(100), nullable=False)
    file_category = db.Column(db.String(50), default="general", nullable=False)  # product, puja, blog, guruji
    uploaded_by_id = db.Column(db.Integer, db.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    def __repr__(self):
        return f"<MediaFile {self.filename}>"


class Banner(db.Model):
    __tablename__ = "banners"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    subtitle = db.Column(db.String(300), nullable=True)
    image_url = db.Column(db.String(500), nullable=True)
    link_url = db.Column(db.String(500), nullable=True)
    position = db.Column(db.String(50), default="hero", nullable=False, index=True)  # hero, announcement, promo
    button_text = db.Column(db.String(100), nullable=True)
    sort_order = db.Column(db.Integer, default=0, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<Banner {self.title}>"


class WelcomePopupSetting(db.Model):
    __tablename__ = "welcome_popup_settings"

    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.String(20), default="published", nullable=False, index=True)  # 'published' or 'draft'
    campaign_id = db.Column(db.String(50), default="camp_1", nullable=False)
    is_enabled = db.Column(db.Boolean, default=True, nullable=False)

    # Text and offer
    heading = db.Column(db.String(255), default="Your Cosmic Welcome", nullable=False)
    description = db.Column(db.Text, default="Enjoy a special offer on your first order.", nullable=False)
    offer_highlight = db.Column(db.String(100), default="10% OFF", nullable=True)
    coupon_code = db.Column(db.String(50), default="WELCOME10", nullable=True)
    button_label = db.Column(db.String(100), default="Claim My Offer", nullable=False)
    button_action = db.Column(db.String(50), default="claim_coupon", nullable=False)  # 'claim_coupon' or 'open_link'
    target_url = db.Column(db.String(255), default="", nullable=True)
    terms = db.Column(db.Text, default="*Valid on eligible items on your first order. Cannot be combined with other offers. Discount verified and calculated on the server at checkout.", nullable=True)

    # Image
    image_url = db.Column(db.String(500), default="/hero/hero-astrology.jpg", nullable=True)
    image_alt = db.Column(db.String(255), default="Cosmic Vedic Astrology Welcome", nullable=True)
    image_position = db.Column(db.String(50), default="center", nullable=False)  # 'center', 'top', 'bottom', 'left', 'right'

    # Timing and Schedule
    delay_seconds = db.Column(db.Integer, default=5, nullable=False)
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        discount_text = self.offer_highlight or ""
        coupon_obj = None
        if self.coupon_code:
            from app.models.operations import Coupon
            coupon_obj = Coupon.query.filter_by(code=self.coupon_code, is_active=True).first()
            if coupon_obj and not discount_text:
                if coupon_obj.discount_type == "percentage":
                    discount_text = f"{int(coupon_obj.discount_value)}% OFF"
                else:
                    discount_text = f"₹{int(coupon_obj.discount_value)} OFF"

        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "is_enabled": self.is_enabled,
            "heading": self.heading,
            "description": self.description,
            "offer_highlight": discount_text or self.offer_highlight or "Special Welcome Gift",
            "coupon_code": self.coupon_code or "",
            "button_label": self.button_label or "Claim My Offer",
            "button_action": self.button_action or "claim_coupon",
            "target_url": self.target_url or "",
            "terms": self.terms or "",
            "image_url": self.image_url or "/hero/hero-astrology.jpg",
            "image_alt": self.image_alt or "Cosmic Astrology Welcome Offer",
            "image_position": self.image_position or "center",
            "delay_seconds": self.delay_seconds or 5,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<WelcomePopupSetting {self.status}:{self.campaign_id}>"


