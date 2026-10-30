import os
import hmac
import hashlib
from typing import Tuple, Dict, Any, Optional
from flask import current_app
import razorpay
from razorpay.errors import SignatureVerificationError, BadRequestError, GatewayError


class RazorpayService:
    """
    Spiritual Commerce Razorpay Service.
    Enforces server-side amount calculation, cryptographic HMAC-SHA256 signature verification,
    refund tracking, and webhook authentication.
    """

    @staticmethod
    def get_credentials() -> Tuple[str, str]:
        """
        Load and validate Razorpay credentials from secure environment configuration.
        Accepts valid Razorpay API keys (rzp_live_* or rzp_test_*).
        """
        key_id = (
            (current_app.config.get("RAZORPAY_KEY_ID") if current_app else None)
            or os.getenv("RAZORPAY_KEY_ID", "")
        )
        key_secret = (
            (current_app.config.get("RAZORPAY_KEY_SECRET") if current_app else None)
            or os.getenv("RAZORPAY_KEY_SECRET", "")
        )

        key_id = str(key_id or "").strip().strip("'\"")
        key_secret = str(key_secret or "").strip().strip("'\"")

        if not key_id or not key_secret:
            raise ValueError(
                "Razorpay credentials missing. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment."
            )

        if not key_id.startswith(("rzp_live_", "rzp_test_")):
            raise ValueError("Invalid Razorpay Key ID format. Key ID must start with rzp_live_ or rzp_test_.")

        return key_id, key_secret

    @staticmethod
    def get_client() -> razorpay.Client:
        """Initialize official Razorpay Client with validated credentials."""
        key_id, key_secret = RazorpayService.get_credentials()
        return razorpay.Client(auth=(key_id, key_secret))

    @staticmethod
    def create_order(
        amount_paise: int,
        receipt: str,
        notes: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Creates an authoritative Razorpay order via the official Python SDK.
        amount_paise: integer in paise (1 INR = 100 paise).
        """
        if amount_paise <= 0:
            raise ValueError("Payment amount must be greater than zero.")

        key_id, _ = RazorpayService.get_credentials()
        client = RazorpayService.get_client()

        order_data = {
            "amount": int(amount_paise),
            "currency": "INR",
            "receipt": receipt[:40] if receipt else "rcpt_order",
            "payment_capture": 1,
            "notes": {str(k): str(v) for k, v in (notes or {}).items()},
        }

        rzp_order = client.order.create(data=order_data)
        return {
            "razorpay_order_id": rzp_order.get("id"),
            "amount": rzp_order.get("amount"),
            "currency": rzp_order.get("currency", "INR"),
            "key_id": key_id,
        }

    @staticmethod
    def verify_payment_signature(
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Verifies Razorpay payment signature cryptographically using Razorpay SDK.
        Returns (True, None) if authentic, or (False, error_reason) if forged/invalid.
        """
        if not razorpay_payment_id or not razorpay_signature:
            return False, "Missing razorpay_payment_id or razorpay_signature."

        client = RazorpayService.get_client()
        try:
            client.utility.verify_payment_signature({
                "razorpay_order_id": (razorpay_order_id or "").strip(),
                "razorpay_payment_id": (razorpay_payment_id or "").strip(),
                "razorpay_signature": (razorpay_signature or "").strip(),
            })
            return True, None
        except SignatureVerificationError as sve:
            return False, f"Signature verification failed: {str(sve)}"
        except Exception as exc:
            return False, f"Signature verification error: {str(exc)}"

    @staticmethod
    def verify_webhook_signature(
        raw_payload: str,
        signature: str,
        webhook_secret: Optional[str] = None
    ) -> bool:
        """
        Verifies Razorpay webhook HMAC-SHA256 signature against the raw request body.
        """
        secret = webhook_secret or (
            current_app.config.get("PAYMENT_WEBHOOK_SECRET") if current_app else os.getenv("PAYMENT_WEBHOOK_SECRET")
        )
        if not secret or not signature or not raw_payload:
            return False

        expected_sig = hmac.new(
            secret.encode("utf-8"),
            raw_payload.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected_sig)

    @staticmethod
    def fetch_payment(payment_id: str) -> Dict[str, Any]:
        """Fetch real-time authoritative payment status from Razorpay API."""
        client = RazorpayService.get_client()
        return client.payment.fetch(payment_id)

    @staticmethod
    def capture_payment(payment_id: str, amount_paise: int) -> Dict[str, Any]:
        """Manually capture an authorized Razorpay payment."""
        client = RazorpayService.get_client()
        return client.payment.capture(payment_id, amount_paise)

    @staticmethod
    def create_refund(
        payment_id: str,
        amount_paise: Optional[int] = None,
        notes: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Initiates a partial or full refund for a captured payment via Razorpay.
        amount_paise: Optional amount in paise. If omitted, performs full refund.
        """
        client = RazorpayService.get_client()
        data = {}
        if amount_paise and amount_paise > 0:
            data["amount"] = int(amount_paise)
        if notes:
            data["notes"] = {str(k): str(v) for k, v in notes.items()}

        return client.payment.refund(payment_id, data)
