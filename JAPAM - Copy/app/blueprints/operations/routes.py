from datetime import datetime, timezone
from decimal import Decimal
from flask import Blueprint, render_template, request, redirect, url_for, flash
from app.extensions import db
from app.models.operations import PaymentTransaction, Coupon, ReturnRequest, CustomerEnquiry
from app.services.rbac_service import login_required, permission_required, get_current_admin
from app.services.audit_service import AuditService

operations_bp = Blueprint("operations", __name__, url_prefix="/admin/operations")


# -------------------------------------------------------------
# Payments
# -------------------------------------------------------------
@operations_bp.route("/payments")
@login_required
@permission_required("operations", "view")
def payments_list():
    user = get_current_admin()
    status = request.args.get("status")
    q = PaymentTransaction.query
    if status:
        q = q.filter_by(status=status)

    transactions = q.order_by(PaymentTransaction.created_at.desc()).all()
    return render_template("operations/payments.html", current_user=user, transactions=transactions, selected_status=status, active_page="payments")


@operations_bp.route("/payments/<int:txn_id>/verify", methods=["POST"])
@login_required
@permission_required("operations", "edit")
def payment_verify(txn_id):
    user = get_current_admin()
    txn = PaymentTransaction.query.get_or_404(txn_id)
    txn.status = "captured"
    db.session.commit()

    AuditService.log(
        action="PAYMENT_VERIFIED",
        module="operations",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="PaymentTransaction",
        entity_id=str(txn.id),
        details={"transaction_number": txn.transaction_number, "amount": str(txn.amount)},
    )
    flash("Payment transaction verified successfully.", "success")
    return redirect(url_for("operations.payments_list"))


# -------------------------------------------------------------
# Coupons
# -------------------------------------------------------------
@operations_bp.route("/coupons")
@login_required
@permission_required("operations", "view")
def coupons_list():
    user = get_current_admin()
    coupons = Coupon.query.order_by(Coupon.created_at.desc()).all()
    return render_template("operations/coupons.html", current_user=user, coupons=coupons, active_page="coupons")


@operations_bp.route("/coupons/create", methods=["POST"])
@login_required
@permission_required("operations", "create")
def coupon_create():
    user = get_current_admin()
    code = request.form.get("code", "").strip().upper()
    dtype = request.form.get("discount_type", "percentage")
    val = request.form.get("discount_value", "0")
    min_order = request.form.get("min_order_amount", "0")
    max_discount = request.form.get("max_discount_amount")
    max_uses = request.form.get("max_uses", 100, type=int)

    if not code or not val:
        flash("Coupon code and discount value are required.", "danger")
        return redirect(url_for("operations.coupons_list"))

    coupon = Coupon(
        code=code,
        discount_type=dtype,
        discount_value=Decimal(val),
        min_order_amount=Decimal(min_order),
        max_discount_amount=Decimal(max_discount) if max_discount else None,
        max_uses=max_uses,
        is_active=True,
    )
    db.session.add(coupon)
    db.session.commit()

    AuditService.log(
        action="COUPON_CREATE",
        module="operations",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Coupon",
        entity_id=str(coupon.id),
        details={"code": code, "discount_value": str(val)},
    )
    flash(f"Coupon '{code}' created.", "success")
    return redirect(url_for("operations.coupons_list"))


@operations_bp.route("/coupons/<int:coupon_id>/edit", methods=["POST"])
@login_required
@permission_required("operations", "edit")
def coupon_update(coupon_id):
    user = get_current_admin()
    coupon = Coupon.query.get_or_404(coupon_id)

    code = request.form.get("code", "").strip().upper()
    dtype = request.form.get("discount_type", coupon.discount_type)
    val = request.form.get("discount_value")
    min_order = request.form.get("min_order_amount")
    max_discount = request.form.get("max_discount_amount")
    max_uses = request.form.get("max_uses", type=int)
    is_active = request.form.get("is_active") == "1" or request.form.get("is_active") == "on"

    if code:
        coupon.code = code
    coupon.discount_type = dtype
    if val:
        coupon.discount_value = Decimal(val)
    if min_order:
        coupon.min_order_amount = Decimal(min_order)
    coupon.max_discount_amount = Decimal(max_discount) if max_discount and max_discount.strip() else None
    if max_uses is not None:
        coupon.max_uses = max_uses
    coupon.is_active = is_active
    db.session.commit()

    AuditService.log(
        action="COUPON_UPDATE",
        module="operations",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Coupon",
        entity_id=str(coupon.id),
        details={"code": coupon.code, "is_active": coupon.is_active},
    )
    flash(f"Coupon '{coupon.code}' updated successfully.", "success")
    return redirect(url_for("operations.coupons_list"))


@operations_bp.route("/coupons/<int:coupon_id>/delete", methods=["POST"])
@login_required
@permission_required("operations", "delete")
def coupon_delete(coupon_id):
    user = get_current_admin()
    coupon = Coupon.query.get_or_404(coupon_id)
    code = coupon.code
    db.session.delete(coupon)
    db.session.commit()

    AuditService.log(
        action="COUPON_DELETE",
        module="operations",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Coupon",
        entity_id=str(coupon_id),
        details={"code": code},
    )
    flash(f"Coupon '{code}' deleted.", "success")
    return redirect(url_for("operations.coupons_list"))


# -------------------------------------------------------------
# Shipping & Returns
# -------------------------------------------------------------

@operations_bp.route("/shipping")
@login_required
@permission_required("operations", "view")
def shipping_list():
    user = get_current_admin()
    returns = ReturnRequest.query.order_by(ReturnRequest.created_at.desc()).all()
    return render_template("operations/shipping.html", current_user=user, returns=returns, active_page="shipping")


@operations_bp.route("/returns/<int:ret_id>/status", methods=["POST"])
@login_required
@permission_required("operations", "edit")
def return_status_update(ret_id):
    user = get_current_admin()
    ret = ReturnRequest.query.get_or_404(ret_id)
    status = request.form.get("status")
    notes = request.form.get("admin_notes", "").strip()
    ret.status = status
    if notes:
        ret.admin_notes = notes
    db.session.commit()

    AuditService.log(
        action="RETURN_STATUS_UPDATE",
        module="operations",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="ReturnRequest",
        entity_id=str(ret.id),
        details={"status": status},
    )
    flash("Return request status updated.", "success")
    return redirect(url_for("operations.shipping_list"))


# -------------------------------------------------------------
# Customer Enquiries
# -------------------------------------------------------------
@operations_bp.route("/enquiries")
@login_required
@permission_required("enquiries", "view")
def enquiries_list():
    user = get_current_admin()
    status = request.args.get("status")
    q = CustomerEnquiry.query
    if status:
        q = q.filter_by(status=status)

    enquiries = q.order_by(CustomerEnquiry.created_at.desc()).all()
    return render_template("operations/enquiries.html", current_user=user, enquiries=enquiries, selected_status=status, active_page="enquiries")


@operations_bp.route("/enquiries/<int:enquiry_id>/respond", methods=["POST"])
@login_required
@permission_required("enquiries", "edit")
def enquiry_respond(enquiry_id):
    user = get_current_admin()
    enquiry = CustomerEnquiry.query.get_or_404(enquiry_id)
    response_text = request.form.get("response_text", "").strip()

    if not response_text:
        flash("Response text is required.", "danger")
        return redirect(url_for("operations.enquiries_list"))

    enquiry.admin_response = response_text
    enquiry.status = "responded"
    enquiry.responded_at = datetime.now(timezone.utc)
    db.session.commit()

    AuditService.log(
        action="ENQUIRY_RESPONDED",
        module="operations",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="CustomerEnquiry",
        entity_id=str(enquiry.id),
        details={"enquiry_number": enquiry.enquiry_number},
    )
    flash(f"Reply recorded and dispatched for #{enquiry.enquiry_number}.", "success")
    return redirect(url_for("operations.enquiries_list"))


@operations_bp.route("/enquiries/<int:enquiry_id>/delete", methods=["POST"])
@login_required
@permission_required("enquiries", "delete")
def enquiry_delete(enquiry_id):
    user = get_current_admin()
    enquiry = CustomerEnquiry.query.get_or_404(enquiry_id)
    enq_num = enquiry.enquiry_number
    db.session.delete(enquiry)
    db.session.commit()

    AuditService.log(
        action="ENQUIRY_DELETE",
        module="operations",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="CustomerEnquiry",
        entity_id=str(enquiry_id),
        details={"enquiry_number": enq_num},
    )
    flash(f"Enquiry {enq_num} deleted.", "success")
    return redirect(url_for("operations.enquiries_list"))

