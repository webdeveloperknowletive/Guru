from datetime import datetime, timezone
from decimal import Decimal
from app.extensions import db


class PaymentTransaction(db.Model):
    __tablename__ = "payment_transactions"

    id = db.Column(db.Integer, primary_key=True)
    transaction_number = db.Column(db.String(64), unique=True, nullable=False, index=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("puja_bookings.id", ondelete="SET NULL"), nullable=True, index=True)

    amount = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    currency = db.Column(db.String(10), default="INR", nullable=False)
    gateway = db.Column(db.String(50), default="Razorpay", nullable=False)  # Razorpay, Stripe, BankTransfer, COD
    gateway_payment_id = db.Column(db.String(120), nullable=True, index=True)

    # captured, pending, failed, refunded
    status = db.Column(db.String(50), default="captured", nullable=False, index=True)
    customer_name = db.Column(db.String(150), nullable=True)
    customer_email = db.Column(db.String(255), nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    def __repr__(self):
        return f"<PaymentTransaction {self.transaction_number} {self.amount} {self.status}>"


class Coupon(db.Model):
    __tablename__ = "coupons"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    discount_type = db.Column(db.String(20), default="percentage", nullable=False)  # percentage, fixed
    discount_value = db.Column(db.Numeric(12, 2), nullable=False)
    min_order_amount = db.Column(db.Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    max_discount_amount = db.Column(db.Numeric(12, 2), nullable=True)
    max_uses = db.Column(db.Integer, default=100, nullable=False)
    used_count = db.Column(db.Integer, default=0, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def is_valid_for(self, order_amount: Decimal) -> bool:
        if not self.is_active:
            return False
        if self.expires_at and self.expires_at < datetime.now(timezone.utc):
            return False
        if self.max_uses and self.used_count >= self.max_uses:
            return False
        if order_amount < self.min_order_amount:
            return False
        return True

    def calculate_discount(self, order_amount: Decimal) -> Decimal:
        if self.discount_type == "percentage":
            discount = (order_amount * self.discount_value) / Decimal("100.00")
            if self.max_discount_amount and discount > self.max_discount_amount:
                discount = self.max_discount_amount
            return discount
        return min(self.discount_value, order_amount)

    def __repr__(self):
        return f"<Coupon {self.code}>"


class ReturnRequest(db.Model):
    __tablename__ = "return_requests"

    id = db.Column(db.Integer, primary_key=True)
    return_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_name = db.Column(db.String(150), nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    # requested, approved, rejected, completed
    status = db.Column(db.String(50), default="requested", nullable=False, index=True)
    refund_amount = db.Column(db.Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    admin_notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    order = db.relationship("Order")

    def __repr__(self):
        return f"<ReturnRequest {self.return_number}>"


class CustomerEnquiry(db.Model):
    __tablename__ = "customer_enquiries"

    id = db.Column(db.Integer, primary_key=True)
    enquiry_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(255), nullable=False, index=True)
    phone = db.Column(db.String(30), nullable=True)
    subject = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    # open, responded, closed
    status = db.Column(db.String(50), default="open", nullable=False, index=True)
    admin_response = db.Column(db.Text, nullable=True)
    responded_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    def __repr__(self):
        return f"<CustomerEnquiry {self.enquiry_number} - {self.name}>"


class SystemSetting(db.Model):
    __tablename__ = "system_settings"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False, index=True)
    value = db.Column(db.Text, nullable=False)
    description = db.Column(db.String(255), nullable=True)
    group_name = db.Column(db.String(50), default="general", nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<SystemSetting {self.key}>"
