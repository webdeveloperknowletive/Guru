import os
import json
import logging
import urllib.parse
from datetime import datetime, timezone
import requests
from flask import current_app
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class WhatsAppNotificationService:
    """
    Service for sending authoritative server-side WhatsApp notifications
    to the configured store administrator.
    Integrates with Meta WhatsApp Business Cloud API (or compatible gateway)
    when credentials are provided. Falls back gracefully with recorded status
    and direct dispatch link if unconfigured or unreachable.
    Never raises an uncaught exception or rolls back transactions.
    """

    @staticmethod
    def get_admin_phone() -> str:
        """Retrieve configured admin WhatsApp mobile number."""
        num = os.getenv("ADMIN_WHATSAPP_NUMBER")
        if not num:
            from app.models.operations import SystemSetting
            try:
                setting = SystemSetting.query.filter_by(key="admin_whatsapp_number").first()
                if setting and setting.value:
                    num = setting.value
            except Exception:
                pass
        return str(num or "919623117545").strip().replace("+", "").replace(" ", "").replace("-", "")

    @staticmethod
    def get_api_credentials() -> dict:
        """Fetch WhatsApp Cloud API configuration from environment."""
        return {
            "token": os.getenv("WHATSAPP_API_TOKEN") or os.getenv("WHATSAPP_ACCESS_TOKEN", ""),
            "phone_number_id": os.getenv("WHATSAPP_PHONE_NUMBER_ID", ""),
            "api_version": os.getenv("WHATSAPP_API_VERSION", "v19.0"),
        }

    @staticmethod
    def format_notification_message(
        module_name: str,
        reference_id: str,
        customer_name: str,
        customer_phone: str,
        customer_email: str,
        amount: str | float | None,
        payment_mode: str,
        payment_status: str,
        admin_url: str = None,
        extra_info: str = None,
    ) -> str:
        """
        Build a concise, structured administrative alert.
        Omits sensitive birth/astrological confidential notes and credentials.
        """
        ist_now = datetime.now(timezone.utc).strftime("%d-%b-%Y %I:%M %p UTC")
        amt_str = f"₹{amount}" if amount is not None else "N/A"
        mode_upper = str(payment_mode).upper()
        status_clean = str(payment_status).replace("_", " ").title()

        lines = [
            "🕉️ *AstroVeda Store Alert*",
            f"*Module:* {module_name}",
            f"*Ref ID:* {reference_id}",
            f"*Customer:* {customer_name}",
            f"*Phone:* {customer_phone or 'N/A'}",
            f"*Email:* {customer_email or 'N/A'}",
            f"*Amount:* {amt_str}",
            f"*Payment Mode:* {mode_upper}",
            f"*Status:* {status_clean}",
            f"*Timestamp:* {ist_now}",
        ]

        if extra_info:
            lines.append(f"*Details:* {extra_info}")

        if admin_url:
            lines.append(f"*Admin Link:* {admin_url}")

        return "\n".join(lines)

    @classmethod
    def send_admin_alert(
        cls,
        module_name: str,
        reference_id: str,
        customer_name: str,
        customer_phone: str,
        customer_email: str,
        amount: str | float | None,
        payment_mode: str,
        payment_status: str,
        admin_url: str = None,
        extra_info: str = None,
    ) -> dict:
        """
        Sends administrative WhatsApp notification.
        Returns a dict:
          {
            "status": "delivered" | "failed" | "not_configured",
            "message": str,
            "admin_phone": str,
            "text": str,
            "manual_link": str
          }
        """
        admin_phone = cls.get_admin_phone()
        msg_text = cls.format_notification_message(
            module_name=module_name,
            reference_id=reference_id,
            customer_name=customer_name,
            customer_phone=customer_phone,
            customer_email=customer_email,
            amount=amount,
            payment_mode=payment_mode,
            payment_status=payment_status,
            admin_url=admin_url,
            extra_info=extra_info,
        )

        encoded_text = urllib.parse.quote(msg_text)
        manual_wa_link = f"https://wa.me/{admin_phone}?text={encoded_text}"

        creds = cls.get_api_credentials()
        has_creds = bool(creds.get("token") and creds.get("phone_number_id"))

        if not has_creds:
            logger.info(
                "WhatsApp Business API credentials not configured. Admin alert recorded for %s (%s).",
                module_name, reference_id
            )
            return {
                "status": "not_configured",
                "message": "WhatsApp Business API credentials not configured in environment.",
                "admin_phone": admin_phone,
                "text": msg_text,
                "manual_link": manual_wa_link,
            }

        # Attempt API dispatch via Meta WhatsApp Business Cloud API
        endpoint = f"https://graph.facebook.com/{creds['api_version']}/{creds['phone_number_id']}/messages"
        headers = {
            "Authorization": f"Bearer {creds['token']}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": admin_phone,
            "type": "text",
            "text": {
                "preview_url": False,
                "body": msg_text,
            },
        }

        try:
            resp = requests.post(endpoint, json=payload, headers=headers, timeout=5)
            if resp.status_code in (200, 201):
                resp_json = resp.json()
                logger.info("Admin WhatsApp notification delivered successfully for %s", reference_id)
                return {
                    "status": "delivered",
                    "message": "WhatsApp notification delivered successfully.",
                    "response": resp_json,
                    "admin_phone": admin_phone,
                    "text": msg_text,
                    "manual_link": manual_wa_link,
                }
            else:
                logger.warning(
                    "WhatsApp API error (%d): %s", resp.status_code, resp.text
                )
                return {
                    "status": "failed",
                    "message": f"WhatsApp API responded with status {resp.status_code}",
                    "response": resp.text,
                    "admin_phone": admin_phone,
                    "text": msg_text,
                    "manual_link": manual_wa_link,
                }
        except Exception as e:
            logger.error("Exception during WhatsApp notification dispatch: %s", e)
            return {
                "status": "failed",
                "message": str(e),
                "admin_phone": admin_phone,
                "text": msg_text,
                "manual_link": manual_wa_link,
            }
