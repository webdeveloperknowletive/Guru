import json
import copy
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from flask import current_app
from app.extensions import db
from app.models.operations import CheckoutFormConfig, SystemSetting
from app.services.audit_service import AuditService


class CheckoutBuilderService:
    """
    Spiritual Commerce Dynamic Checkout Form Builder Service.
    Authoritative server-side management for checkout layout, dynamic fields,
    payment method controls, policy cards, CAPTCHA, and order summary.
    """

    SETTING_KEY_PUBLISHED = "checkout_form_config_published"
    SETTING_KEY_DRAFT = "checkout_form_config_draft"

    @classmethod
    def get_default_config(cls) -> Dict[str, Any]:
        """Canonical default checkout configuration matching the Swami Guruji storefront screenshots."""
        return {
            "version": 1,
            "status": "published",
            "page_config": {
                "kicker": "SECURE CHECKOUT",
                "kicker_visible": True,
                "title": "DEVOTEE & SHIPPING DETAILS",
                "subtitle": "डिलिव्हरीसाठी आवश्यक माहिती भरा — सुरक्षित आणि जलद डिस्पॅच.",
                "subtitle_en": "Fill delivery details for sacred and fast dispatch.",
                "close_btn_visible": True,
                "order_summary_title": "ORDER SUMMARY",
                "footer_trust_note": "सर्व वस्तू शास्त्रोक्त पद्धतीने अभिमंत्रित करून वाराणसी/हरिद्वार आश्रमातून पाठवल्या जातात. 100% Consecrated & Lab Certified Sacred Products.",
                "footer_trust_visible": True,
                "ssl_message": "100% Secure Checkout · SSL 256-bit Encrypted",
                "ssl_message_visible": True,
            },
            "sections": [
                {
                    "id": "devotee_details",
                    "name": "Devotee & Shipping Details",
                    "title": "Devotee & Shipping Details",
                    "subtitle": "डिलिव्हरीसाठी आवश्यक माहिती भरा — सुरक्षित आणि जलद डिस्पॅच.",
                    "enabled": True,
                    "order": 1,
                    "visibility": "all",  # all, desktop, mobile
                },
                {
                    "id": "payment_method",
                    "name": "Payment Method",
                    "title": "Payment Method · पेमेंट पर्याय",
                    "enabled": True,
                    "order": 2,
                    "visibility": "all",
                },
                {
                    "id": "return_policy",
                    "name": "Return & Product Policy",
                    "title": "Return & Product Policy:",
                    "enabled": True,
                    "order": 3,
                    "visibility": "all",
                },
                {
                    "id": "agreement",
                    "name": "Terms and Conditions Agreement",
                    "enabled": True,
                    "order": 4,
                    "visibility": "all",
                },
                {
                    "id": "captcha",
                    "name": "CAPTCHA Verification",
                    "enabled": True,
                    "order": 5,
                    "visibility": "all",
                },
                {
                    "id": "submit_button",
                    "name": "Checkout Submit / Place Order Button",
                    "enabled": True,
                    "order": 6,
                    "visibility": "all",
                },
                {
                    "id": "order_summary",
                    "name": "Order Summary",
                    "title": "ORDER SUMMARY",
                    "enabled": True,
                    "order": 7,
                    "visibility": "all",
                },
                {
                    "id": "coupon_section",
                    "name": "Coupon Section",
                    "enabled": True,
                    "order": 8,
                    "visibility": "all",
                },
                {
                    "id": "trust_message",
                    "name": "Trust Message",
                    "enabled": True,
                    "order": 9,
                    "visibility": "all",
                },
            ],
            "fields": [
                {
                    "id": "name",
                    "key": "name",
                    "label": "Full Name · पूर्ण नाव",
                    "placeholder": "e.g. Rahul Sharma",
                    "type": "text",
                    "required": True,
                    "enabled": True,
                    "order": 1,
                    "width": "full",
                    "help_text": "Enter devotee name for consecration & delivery",
                    "min_length": 2,
                    "max_length": 150,
                    "section_id": "devotee_details",
                    "is_custom": False,
                },
                {
                    "id": "email",
                    "key": "email",
                    "label": "Email Address",
                    "placeholder": "devotee@example.com",
                    "type": "email",
                    "required": True,
                    "enabled": True,
                    "order": 2,
                    "width": "half",
                    "help_text": "Order confirmation and tracking details will be sent here",
                    "min_length": 5,
                    "max_length": 255,
                    "section_id": "devotee_details",
                    "is_custom": False,
                },
                {
                    "id": "phone",
                    "key": "phone",
                    "label": "Mobile / WhatsApp Number",
                    "placeholder": "+91 98765 43210",
                    "type": "tel",
                    "required": True,
                    "enabled": True,
                    "order": 3,
                    "width": "half",
                    "help_text": "Courier tracking SMS and WhatsApp alerts will be sent here",
                    "min_length": 10,
                    "max_length": 15,
                    "section_id": "devotee_details",
                    "is_custom": False,
                },
                {
                    "id": "address",
                    "key": "address",
                    "label": "Shipping Address · पत्ता",
                    "placeholder": "House / Flat No., Society, Landmark, Street",
                    "type": "textarea",
                    "required": True,
                    "enabled": True,
                    "order": 4,
                    "width": "full",
                    "rows": 2,
                    "help_text": "Full address for sacred package delivery",
                    "min_length": 5,
                    "max_length": 500,
                    "section_id": "devotee_details",
                    "is_custom": False,
                },
                {
                    "id": "city",
                    "key": "city",
                    "label": "City / Town · शहर",
                    "placeholder": "Pune, Mumbai, etc.",
                    "type": "text",
                    "required": False,
                    "enabled": True,
                    "order": 5,
                    "width": "half",
                    "min_length": 2,
                    "max_length": 80,
                    "section_id": "devotee_details",
                    "is_custom": False,
                },
                {
                    "id": "pincode",
                    "key": "pincode",
                    "label": "Pincode · पिनकोड",
                    "placeholder": "e.g. 411001",
                    "type": "text",
                    "required": False,
                    "enabled": True,
                    "order": 6,
                    "width": "half",
                    "min_length": 6,
                    "max_length": 6,
                    "section_id": "devotee_details",
                    "is_custom": False,
                },
            ],
            "payment_methods": {
                "razorpay": {
                    "id": "razorpay",
                    "enabled": True,
                    "title": "Razorpay Secure Payment",
                    "description": "UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, Net Banking",
                    "badge": "✓ Instant",
                    "order": 1,
                    "enable_upi": True,
                    "enable_cards": True,
                    "enable_netbanking": True,
                },
                "cod": {
                    "id": "cod",
                    "enabled": True,
                    "title": "Cash on Delivery (COD)",
                    "description": "Pay in cash upon doorstep delivery · COD Available",
                    "badge": "✓ Available",
                    "order": 2,
                    "min_order_value": 0,
                    "max_order_value": 50000,
                    "allowed_pincodes": "",
                },
            },
            "policy": {
                "enabled": True,
                "heading": "📜 Return & Product Policy:",
                "content": "Products listed on this website are offered under the applicable payment options. Products are generally non-returnable and non-exchangeable once purchased. However, customers should contact customer support regarding products that are delivered damaged, defective, incorrect, counterfeit, or materially different from their advertised description. Any refunds, replacements, or other remedies will be handled in accordance with applicable consumer protection laws and the published product policy.",
                "agreement_checkbox_enabled": True,
                "agreement_checkbox_required": True,
                "agreement_text": "I have read and agree to the Return Policy, Terms of Service, and understand that sacred consecrated products are non-returnable except for damaged, defective, or incorrect deliveries.",
                "agreement_error_message": "कृपया पुढे जाण्यासाठी रिटर्न व रिफंड पॉलिसी मान्य करा (Please accept the Return and Refund policy to proceed).",
            },
            "captcha": {
                "enabled": True,
                "provider": "recaptcha_v2",
                "site_key": "6LccCwUuAAAAAOn2sQ18qW5bVrqiWlS1sJ_o8xQ3",
                "label": "I'm not a robot",
                "error_message": "Please complete the CAPTCHA verification (कृपया कॅप्चा पूर्ण करा).",
                "fallback_text": "कॅप्चा समस्या येत आहे? येथे क्लिक करा (CAPTCHA not working? Click here)",
                "rate_limit_per_minute": 10,
            },
            "buttons": {
                "place_order_online": "💳 Pay with Razorpay / ऑनलाइन पे करा → ₹{total}",
                "place_order_cod": "📦 Confirm COD Order / कॅश ऑन डिलिव्हरी → ₹{total}",
                "place_order_offline": "💬 Order via WhatsApp / व्हॉट्सॲपवर ऑर्डर करा → ₹{total}",
                "loading_text": "Processing Sacred Order...",
                "mode_loading_text": "Loading Checkout Mode...",
                "apply_coupon": "Apply",
                "close_btn_aria": "Close checkout",
                "continue_shopping": "Continue Shopping",
                "track_order": "📦 Track This Order",
                "whatsapp_updates": "📲 WhatsApp Updates",
            },
            "coupon": {
                "enabled": True,
                "placeholder": "Coupon (e.g. DIWALI108)",
                "apply_button_label": "Apply",
            },
            "order_summary": {
                "title": "Order Summary",
                "show_item_count": True,
                "show_product_image": True,
                "show_product_name": True,
                "show_quantity": True,
                "show_unit_price": True,
                "show_thumbnails": True,
                "show_coupon_row": True,
                "show_trust_note": True,
                "subtotal_label": "Subtotal",
                "show_tax_row": True,
                "tax_label": "Vedic Goods GST (3%)",
                "gst_percentage": 3.0,
                "show_shipping_row": True,
                "shipping_label": "Shipping",
                "shipping_charge": 99.0,
                "free_shipping_threshold": 999.0,
                "free_shipping_text": "FREE (Orders > ₹999)",
                "coupon_discount_label": "Coupon Discount",
                "total_label": "Total Amount",
            },
            "trust_messages": [
                {
                    "id": "sacred_blessing",
                    "text": "🌿 सर्व वस्तू शास्त्रोक्त पद्धतीने अभिमंत्रित करून वाराणसी/हरिद्वार आश्रमातून पाठवल्या जातात. 100% Consecrated & Lab Certified Sacred Products.",
                    "icon": "🌿",
                    "enabled": True,
                    "placement": "order_summary_bottom",
                },
                {
                    "id": "ssl_secure",
                    "text": "🔒 100% Secure Checkout · SSL 256-bit Encrypted",
                    "icon": "🔒",
                    "enabled": True,
                    "placement": "checkout_form_bottom",
                },
            ],
        }

    @classmethod
    def get_published_record(cls) -> Optional[CheckoutFormConfig]:
        """Fetch active published record from database."""
        return CheckoutFormConfig.query.filter_by(status="published").order_by(CheckoutFormConfig.version.desc()).first()

    @classmethod
    def get_published_config(cls) -> Dict[str, Any]:
        """
        Retrieves active published configuration.
        Auto-seeds Version 1 defaults if database has no record yet.
        """
        record = cls.get_published_record()
        if record:
            try:
                cfg = json.loads(record.config_data)
                cfg["version"] = record.version
                cfg["published_at"] = record.published_at.isoformat() if record.published_at else None
                return cfg
            except Exception as e:
                if current_app:
                    current_app.logger.warning(f"Error parsing published checkout config: {e}")

        # Fallback to SystemSetting cached value if available
        cached = SystemSetting.query.filter_by(key=cls.SETTING_KEY_PUBLISHED).first()
        if cached and cached.value:
            try:
                return json.loads(cached.value)
            except Exception:
                pass

        # Auto-initialize canonical default configuration as Version 1
        default_cfg = cls.get_default_config()
        new_record = CheckoutFormConfig(
            version=1,
            status="published",
            config_data=json.dumps(default_cfg, ensure_ascii=False),
            publish_notes="Initial baseline checkout configuration",
            published_at=datetime.now(timezone.utc),
        )
        db.session.add(new_record)

        # Cache in SystemSetting
        if not cached:
            cached = SystemSetting(
                key=cls.SETTING_KEY_PUBLISHED,
                value=json.dumps(default_cfg, ensure_ascii=False),
                group_name="checkout",
                description="Published Checkout Form Configuration",
            )
            db.session.add(cached)
        else:
            cached.value = json.dumps(default_cfg, ensure_ascii=False)

        db.session.commit()
        return default_cfg

    @classmethod
    def get_public_config(cls) -> Dict[str, Any]:
        """
        Returns sanitized published checkout configuration for client storefront consumption.
        Never exposes admin emails, internal secrets, or server keys.
        """
        cfg = copy.deepcopy(cls.get_published_config())
        # Ensure captcha configuration only exposes the public site key
        if "captcha" in cfg:
            cfg["captcha"].pop("secret_key", None)
        return cfg

    @classmethod
    def get_draft_record(cls) -> Optional[CheckoutFormConfig]:
        """Fetch the latest draft record."""
        return CheckoutFormConfig.query.filter_by(status="draft").order_by(CheckoutFormConfig.id.desc()).first()

    @classmethod
    def get_draft_config(cls) -> Dict[str, Any]:
        """
        Returns the current draft configuration.
        If no draft exists, returns the current published configuration so editing begins from live state.
        """
        draft = cls.get_draft_record()
        if draft:
            try:
                cfg = json.loads(draft.config_data)
                cfg["draft_id"] = draft.id
                cfg["is_draft"] = True
                cfg["updated_at"] = draft.created_at.isoformat() if draft.created_at else None
                return cfg
            except Exception as e:
                if current_app:
                    current_app.logger.warning(f"Error parsing draft checkout config: {e}")

        # No draft found; use published config as starting draft
        published = copy.deepcopy(cls.get_published_config())
        published["is_draft"] = False
        return published

    @classmethod
    def save_draft(cls, config_dict: Dict[str, Any], admin_user=None) -> Dict[str, Any]:
        """
        Saves or updates a draft checkout configuration.
        Does not affect the public storefront until published.
        """
        cls._validate_config_structure(config_dict)

        existing_draft = cls.get_draft_record()
        config_json = json.dumps(config_dict, ensure_ascii=False)

        admin_id = getattr(admin_user, "id", None)
        admin_email = getattr(admin_user, "email", "admin")

        if existing_draft:
            existing_draft.config_data = config_json
            existing_draft.created_by_id = admin_id
            existing_draft.created_by_email = admin_email
            existing_draft.created_at = datetime.now(timezone.utc)
            record = existing_draft
        else:
            published = cls.get_published_record()
            next_version = (published.version + 1) if published else 1
            record = CheckoutFormConfig(
                version=next_version,
                status="draft",
                config_data=config_json,
                created_by_id=admin_id,
                created_by_email=admin_email,
                publish_notes="Draft working copy",
            )
            db.session.add(record)

        # Cache draft in SystemSetting
        cached = SystemSetting.query.filter_by(key=cls.SETTING_KEY_DRAFT).first()
        if not cached:
            cached = SystemSetting(
                key=cls.SETTING_KEY_DRAFT,
                value=config_json,
                group_name="checkout",
                description="Draft Checkout Form Configuration",
            )
            db.session.add(cached)
        else:
            cached.value = config_json

        db.session.commit()

        AuditService.log(
            action="CHECKOUT_BUILDER_DRAFT_SAVED",
            module="system",
            actor_email=admin_email,
            entity_type="CheckoutFormConfig",
            entity_id=str(record.id),
            details={"version": record.version},
        )

        return record.to_dict()

    @classmethod
    def publish_config(cls, publish_notes: str = "", admin_user=None) -> Dict[str, Any]:
        """
        Promotes the current draft (or specified config) to Published.
        Archives previous published version, increments version number,
        updates public cache, and logs an authoritative audit trail.
        """
        admin_id = getattr(admin_user, "id", None)
        admin_email = getattr(admin_user, "email", "admin")

        draft = cls.get_draft_record()
        if draft:
            config_to_publish = json.loads(draft.config_data)
            # Delete draft record since it is promoted
            db.session.delete(draft)
        else:
            # Re-publishing current or baseline
            config_to_publish = cls.get_published_config()

        # Archive current published version
        current_published = cls.get_published_record()
        next_version = (current_published.version + 1) if current_published else 1

        if current_published:
            current_published.status = "archived"

        config_to_publish["version"] = next_version
        config_to_publish["status"] = "published"
        config_to_publish["updated_at"] = datetime.now(timezone.utc).isoformat()

        config_json = json.dumps(config_to_publish, ensure_ascii=False)

        new_published = CheckoutFormConfig(
            version=next_version,
            status="published",
            config_data=config_json,
            publish_notes=publish_notes or f"Published version {next_version}",
            created_by_id=admin_id,
            created_by_email=admin_email,
            published_at=datetime.now(timezone.utc),
        )
        db.session.add(new_published)

        # Update cached SystemSetting
        cached = SystemSetting.query.filter_by(key=cls.SETTING_KEY_PUBLISHED).first()
        if not cached:
            cached = SystemSetting(
                key=cls.SETTING_KEY_PUBLISHED,
                value=config_json,
                group_name="checkout",
                description="Published Checkout Form Configuration",
            )
            db.session.add(cached)
        else:
            cached.value = config_json

        # Clear draft cache
        draft_cache = SystemSetting.query.filter_by(key=cls.SETTING_KEY_DRAFT).first()
        if draft_cache:
            db.session.delete(draft_cache)

        db.session.commit()

        AuditService.log(
            action="CHECKOUT_BUILDER_PUBLISHED",
            module="system",
            actor_email=admin_email,
            entity_type="CheckoutFormConfig",
            entity_id=str(new_published.id),
            details={"version": next_version, "publish_notes": publish_notes},
        )

        return new_published.to_dict()

    @classmethod
    def restore_version(cls, version_id: int, admin_user=None) -> Dict[str, Any]:
        """Clones a historical version into the active draft."""
        target = CheckoutFormConfig.query.get(version_id)
        if not target:
            raise ValueError(f"Version with ID {version_id} not found.")

        config_dict = json.loads(target.config_data)
        config_dict["publish_notes"] = f"Restored from version {target.version}"
        return cls.save_draft(config_dict, admin_user=admin_user)

    @classmethod
    def restore_defaults(cls, admin_user=None) -> Dict[str, Any]:
        """Resets the draft configuration to default canonical configuration."""
        default_cfg = cls.get_default_config()
        return cls.save_draft(default_cfg, admin_user=admin_user)

    @classmethod
    def get_version_history(cls, limit: int = 15) -> List[Dict[str, Any]]:
        """Returns version history list."""
        records = (
            CheckoutFormConfig.query.order_by(CheckoutFormConfig.version.desc())
            .limit(limit)
            .all()
        )
        return [r.to_dict() for r in records]

    @classmethod
    def _validate_config_structure(cls, cfg: Dict[str, Any]) -> None:
        """Validates that configuration dict contains required sections and fields structure."""
        if not isinstance(cfg, dict):
            raise ValueError("Configuration must be a valid JSON object.")

        if "fields" not in cfg or not isinstance(cfg["fields"], list):
            raise ValueError("Configuration must contain a 'fields' list.")

        # Ensure every field has an id, key, label, and type
        seen_keys = set()
        for idx, f in enumerate(cfg["fields"]):
            if not isinstance(f, dict):
                raise ValueError(f"Field at index {idx} must be an object.")
            key = f.get("key") or f.get("id")
            if not key:
                raise ValueError(f"Field at index {idx} is missing a key/id.")
            if key in seen_keys:
                raise ValueError(f"Duplicate field key '{key}' found.")
            seen_keys.add(key)
            if "label" not in f or not str(f["label"]).strip():
                raise ValueError(f"Field '{key}' must have a label.")

