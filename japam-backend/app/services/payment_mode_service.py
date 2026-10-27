import logging
from datetime import datetime, timezone
from flask import current_app
from app.extensions import db
from app.models.operations import SystemSetting
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)

SETTING_KEY_PAYMENT_MODE = "payment_mode"
SETTING_KEY_OFFLINE_INSTRUCTIONS = "offline_payment_instructions"
SETTING_KEY_OFFLINE_QR_CODE = "offline_payment_qr_code"

DEFAULT_OFFLINE_QR_CODE = "/phonepe-qr.jpg"

DEFAULT_OFFLINE_INSTRUCTIONS = (
    "Offline Payment Instructions:\n"
    "1. Bank Transfer (NEFT/RTGS/IMPS):\n"
    "   Bank: Bank of Maharashtra\n"
    "   Account Name: Nagesh Vishwanath Shelgaonkar\n"
    "   Account Number: 60044303280\n"
    "   IFSC Code: MAHB0001169\n"
    "2. Direct UPI ID: astroveda@sbi (Scan PhonePe QR)\n"
    "3. After payment, share reference / transaction screenshot with your Order ID on WhatsApp at +91 96231 17545.\n"
    "Our team will verify the payment and confirm dispatch/booking."
)


class PaymentModeService:
    @staticmethod
    def get_payment_mode() -> str:
        """
        Authoritatively retrieve current payment mode ('online' or 'offline').
        Persisted in database (SystemSetting). Defaults to 'online'.
        """
        try:
            setting = SystemSetting.query.filter_by(key=SETTING_KEY_PAYMENT_MODE).first()
            if setting and setting.value in ("online", "offline"):
                return setting.value
        except Exception as e:
            logger.error("Error reading payment_mode from DB: %s", e)

        return "online"

    @staticmethod
    def set_payment_mode(new_mode: str, admin_user) -> tuple[bool, str]:
        """
        Atomically switch store payment mode ('online' or 'offline') with audit logging.
        Only authorized admin users can invoke this.
        """
        clean_mode = str(new_mode).strip().lower()
        if clean_mode not in ("online", "offline"):
            return False, f"Invalid payment mode '{new_mode}'. Allowed modes are 'online' or 'offline'."

        if not admin_user or not admin_user.is_active:
            return False, "Unauthorized: active admin session required."

        # Permission check: super_admin or user with system/dashboard manage permission
        is_authorized = False
        if admin_user.role and admin_user.role.code == "super_admin":
            is_authorized = True
        elif hasattr(admin_user, "has_permission"):
            is_authorized = admin_user.has_permission("system", "manage_settings") or admin_user.has_permission("dashboard", "edit")

        if not is_authorized:
            return False, "Forbidden: you lack permissions to switch system payment mode."

        try:
            setting = SystemSetting.query.filter_by(key=SETTING_KEY_PAYMENT_MODE).first()
            old_mode = setting.value if (setting and setting.value) else "online"

            if not setting:
                setting = SystemSetting(
                    key=SETTING_KEY_PAYMENT_MODE,
                    value=clean_mode,
                    group_name="payment",
                    description="Authoritative store payment mode: online or offline",
                    updated_at=datetime.now(timezone.utc),
                )
                db.session.add(setting)
            else:
                setting.value = clean_mode
                setting.updated_at = datetime.now(timezone.utc)

            db.session.commit()

            # Record audit log
            AuditService.log(
                action="PAYMENT_MODE_CHANGE",
                module="dashboard",
                actor_email=admin_user.email,
                actor_user_id=admin_user.id,
                entity_type="SystemSetting",
                entity_id="payment_mode",
                details={
                    "old_mode": old_mode,
                    "new_mode": clean_mode,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )

            logger.info(
                "Payment mode successfully changed from %s to %s by admin %s",
                old_mode, clean_mode, admin_user.email
            )
            return True, f"Payment mode successfully changed to {clean_mode.capitalize()} Mode."
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to update payment_mode: %s", e)
            return False, f"Failed to persist payment mode: {str(e)}"

    @staticmethod
    def get_offline_payment_instructions() -> str:
        """Retrieve configurable offline payment instructions for devotees."""
        try:
            setting = SystemSetting.query.filter_by(key=SETTING_KEY_OFFLINE_INSTRUCTIONS).first()
            if setting and setting.value.strip():
                return setting.value.strip()
        except Exception:
            pass
        return DEFAULT_OFFLINE_INSTRUCTIONS

    @staticmethod
    def set_offline_payment_instructions(instructions: str, admin_user) -> tuple[bool, str]:
        """Update offline payment instructions."""
        if not admin_user or not admin_user.is_active:
            return False, "Unauthorized."
        try:
            setting = SystemSetting.query.filter_by(key=SETTING_KEY_OFFLINE_INSTRUCTIONS).first()
            if not setting:
                setting = SystemSetting(
                    key=SETTING_KEY_OFFLINE_INSTRUCTIONS,
                    value=instructions.strip(),
                    group_name="payment",
                    description="Devotee instructions for offline payments",
                )
                db.session.add(setting)
            else:
                setting.value = instructions.strip()
            db.session.commit()
            return True, "Instructions updated successfully."
        except Exception as e:
            db.session.rollback()
            return False, str(e)

    @staticmethod
    def get_offline_qr_code() -> str:
        """Retrieve configurable offline payment QR code image URL."""
        try:
            setting = SystemSetting.query.filter_by(key=SETTING_KEY_OFFLINE_QR_CODE).first()
            if setting and setting.value.strip():
                return setting.value.strip()
        except Exception:
            pass
        return DEFAULT_OFFLINE_QR_CODE

    @staticmethod
    def set_offline_qr_code(qr_url: str, admin_user) -> tuple[bool, str]:
        """Update offline payment QR code image URL."""
        if not admin_user or not admin_user.is_active:
            return False, "Unauthorized."
        try:
            setting = SystemSetting.query.filter_by(key=SETTING_KEY_OFFLINE_QR_CODE).first()
            if not setting:
                setting = SystemSetting(
                    key=SETTING_KEY_OFFLINE_QR_CODE,
                    value=qr_url.strip(),
                    group_name="payment",
                    description="Devotee QR code image for offline payments",
                )
                db.session.add(setting)
            else:
                setting.value = qr_url.strip()
            db.session.commit()
            return True, "QR code URL updated successfully."
        except Exception as e:
            db.session.rollback()
            return False, str(e)

