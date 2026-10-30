import csv
import io
from datetime import datetime, timezone
from decimal import Decimal
from flask import Blueprint, render_template, request, redirect, url_for, flash, Response, jsonify
from sqlalchemy import or_
from app.extensions import db
from app.models.operations import PaymentTransaction, Coupon, ReturnRequest, CustomerEnquiry
from app.services.rbac_service import login_required, permission_required, get_current_admin
from app.services.audit_service import AuditService
from app.services.razorpay_service import RazorpayService
from app.utils.date_filter import apply_date_time_filters, extract_date_filter_context

operations_bp = Blueprint("operations", __name__, url_prefix="/admin/operations")


# -------------------------------------------------------------
# Payments & Transactions
# -------------------------------------------------------------
@operations_bp.route("/payments")
@login_required
@permission_required("operations", "view")
def payments_list():
    user = get_current_admin()
    status = request.args.get("status", "").strip()
    source_form = request.args.get("source_form", "").strip()
    payment_method = request.args.get("payment_method", "").strip()
    search_query = request.args.get("q", "").strip()

    q = PaymentTransaction.query

    if status and status != "all":
        q = q.filter(PaymentTransaction.status == status)

    if source_form and source_form != "all":
        q = q.filter(PaymentTransaction.source_form == source_form)

    if payment_method and payment_method != "all":
        q = q.filter(PaymentTransaction.payment_method == payment_method)

    if search_query:
        search_pattern = f"%{search_query}%"
        q = q.filter(
            or_(
                PaymentTransaction.transaction_number.ilike(search_pattern),
                PaymentTransaction.customer_name.ilike(search_pattern),
                PaymentTransaction.customer_email.ilike(search_pattern),
                PaymentTransaction.customer_phone.ilike(search_pattern),
                PaymentTransaction.form_submission_id.ilike(search_pattern),
                PaymentTransaction.gateway_payment_id.ilike(search_pattern),
                PaymentTransaction.gateway_order_id.ilike(search_pattern),
                PaymentTransaction.item_summary.ilike(search_pattern),
            )
        )

    q = apply_date_time_filters(q, PaymentTransaction.created_at, request.args)
    date_filter = extract_date_filter_context(request.args)
    transactions = q.order_by(PaymentTransaction.created_at.desc()).all()

    # Dynamic counts for summary chips
    total_count = PaymentTransaction.query.count()
    captured_count = PaymentTransaction.query.filter(PaymentTransaction.status.in_(["captured", "paid"])).count()
    pending_count = PaymentTransaction.query.filter(PaymentTransaction.status.in_(["pending", "initiated"])).count()
    cod_pending_count = PaymentTransaction.query.filter(PaymentTransaction.status == "cod_pending").count()
    refunded_count = PaymentTransaction.query.filter(or_(PaymentTransaction.status == "refunded", PaymentTransaction.refund_status.isnot(None))).count()

    counts = {
        "all": total_count,
        "captured": captured_count,
        "pending": pending_count,
        "cod_pending": cod_pending_count,
        "refunded": refunded_count,
    }

    return render_template(
        "operations/payments.html",
        current_user=user,
        transactions=transactions,
        selected_status=status or "all",
        selected_source_form=source_form or "all",
        selected_payment_method=payment_method or "all",
        search_query=search_query,
        counts=counts,
        active_page="payments",
        date_filter=date_filter,
    )


@operations_bp.route("/payments/export", methods=["GET"])
@login_required
@permission_required("operations", "view")
def payments_export():
    """Exports payment transactions to CSV matching current search/filter parameters."""
    status = request.args.get("status", "").strip()
    source_form = request.args.get("source_form", "").strip()
    payment_method = request.args.get("payment_method", "").strip()
    search_query = request.args.get("q", "").strip()

    q = PaymentTransaction.query
    if status and status != "all":
        q = q.filter(PaymentTransaction.status == status)
    if source_form and source_form != "all":
        q = q.filter(PaymentTransaction.source_form == source_form)
    if payment_method and payment_method != "all":
        q = q.filter(PaymentTransaction.payment_method == payment_method)
    if search_query:
        search_pattern = f"%{search_query}%"
        q = q.filter(
            or_(
                PaymentTransaction.transaction_number.ilike(search_pattern),
                PaymentTransaction.customer_name.ilike(search_pattern),
                PaymentTransaction.customer_email.ilike(search_pattern),
                PaymentTransaction.customer_phone.ilike(search_pattern),
                PaymentTransaction.form_submission_id.ilike(search_pattern),
                PaymentTransaction.gateway_payment_id.ilike(search_pattern),
            )
        )
    q = apply_date_time_filters(q, PaymentTransaction.created_at, request.args)
    transactions = q.order_by(PaymentTransaction.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Transaction Number",
        "Form Submission ID",
        "Source Form",
        "Customer Name",
        "Customer Email",
        "Customer Phone",
        "Item / Service Summary",
        "Amount (INR)",
        "Currency",
        "Gateway",
        "Payment Method",
        "Status",
        "Gateway Order ID",
        "Gateway Payment ID",
        "Refund Status",
        "Refund Amount (INR)",
        "Created At",
    ])

    for t in transactions:
        writer.writerow([
            t.transaction_number,
            t.form_submission_id or (t.order.order_number if t.order else (t.booking.booking_number if t.booking else (t.consultation.consultation_number if t.consultation else ""))),
            t.source_form or ("Store Checkout" if t.order_id else ("Puja Booking" if t.booking_id else ("Consultation Booking" if t.consultation_id else "Direct"))),
            t.customer_name or "",
            t.customer_email or "",
            t.customer_phone or "",
            t.item_summary or "",
            f"{float(t.amount):.2f}" if t.amount else "0.00",
            t.currency or "INR",
            t.gateway or "",
            t.payment_method or "",
            t.status or "",
            t.gateway_order_id or "",
            t.gateway_payment_id or "",
            t.refund_status or "None",
            f"{float(t.refund_amount):.2f}" if t.refund_amount else "0.00",
            t.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if t.created_at else "",
        ])

    csv_data = output.getvalue()
    filename = f"payment_transactions_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@operations_bp.route("/payments/<int:txn_id>/verify", methods=["POST"])
@login_required
@permission_required("operations", "edit")
def payment_verify(txn_id):
    user = get_current_admin()
    txn = PaymentTransaction.query.get_or_404(txn_id)
    txn.status = "captured"
    txn.updated_at = datetime.now(timezone.utc)
    if txn.order:
        txn.order.payment_status = "paid"
        if txn.order.order_status == "pending":
            txn.order.order_status = "processing"
    elif txn.booking:
        txn.booking.status = "confirmed"
    elif txn.consultation:
        txn.consultation.status = "confirmed"

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
    flash(f"Transaction {txn.transaction_number} marked as Captured & Verified.", "success")
    return redirect(url_for("operations.payments_list"))


@operations_bp.route("/payments/<int:txn_id>/cod-status", methods=["POST"])
@login_required
@permission_required("operations", "edit")
def payment_cod_status_update(txn_id):
    user = get_current_admin()
    txn = PaymentTransaction.query.get_or_404(txn_id)
    new_cod_status = request.form.get("cod_status", "cod_collected").strip()

    if new_cod_status == "cod_collected":
        txn.status = "cod_collected"
        txn.updated_at = datetime.now(timezone.utc)
        if txn.order:
            txn.order.payment_status = "paid"
            txn.order.cod_status = "cod_collected"
            if txn.order.order_status == "delivered":
                txn.order.order_status = "completed"
        flash(f"Transaction {txn.transaction_number} COD collected and order marked Paid.", "success")
    elif new_cod_status == "cod_failed_returned":
        txn.status = "cod_failed_returned"
        txn.updated_at = datetime.now(timezone.utc)
        if txn.order:
            txn.order.payment_status = "failed"
            txn.order.cod_status = "cod_failed_returned"
            txn.order.order_status = "cancelled"
        flash(f"Transaction {txn.transaction_number} marked COD Returned/Failed.", "warning")

    db.session.commit()

    AuditService.log(
        action="COD_STATUS_UPDATE",
        module="operations",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="PaymentTransaction",
        entity_id=str(txn.id),
        details={"cod_status": new_cod_status, "transaction_number": txn.transaction_number},
    )
    return redirect(url_for("operations.payments_list"))


@operations_bp.route("/payments/<int:txn_id>/refund", methods=["POST"])
@login_required
@permission_required("operations", "edit")
def payment_refund(txn_id):
    user = get_current_admin()
    txn = PaymentTransaction.query.get_or_404(txn_id)
    refund_amount_raw = request.form.get("refund_amount")
    notes = request.form.get("notes", "Customer requested refund via admin panel").strip()

    try:
        ref_amt = Decimal(refund_amount_raw) if refund_amount_raw else txn.amount
    except Exception:
        ref_amt = txn.amount

    # If transaction has a Razorpay payment ID, initiate through Gateway API
    if txn.gateway == "Razorpay" and txn.gateway_payment_id and not txn.gateway_payment_id.startswith("pay_sim_"):
        try:
            amount_paise = int(ref_amt * 100) if ref_amt else None
            rzp_refund = RazorpayService.create_refund(
                payment_id=txn.gateway_payment_id,
                amount_paise=amount_paise,
                notes={"admin_user": user.email, "reason": notes, "transaction_number": txn.transaction_number}
            )
            txn.refund_status = "refunded"
            txn.refund_amount = ref_amt
            txn.status = "refunded"
            txn.updated_at = datetime.now(timezone.utc)
            if txn.order:
                txn.order.payment_status = "refunded"
            db.session.commit()
            flash(f"Refund of ₹{ref_amt:.2f} processed successfully via Razorpay (Refund ID: {rzp_refund.get('id', 'N/A')}).", "success")
        except Exception as e:
            flash(f"Razorpay refund API call failed: {str(e)}. Recording manual refund.", "warning")
            txn.refund_status = "refunded"
            txn.refund_amount = ref_amt
            txn.status = "refunded"
            txn.updated_at = datetime.now(timezone.utc)
            if txn.order:
                txn.order.payment_status = "refunded"
            db.session.commit()
    else:
        # Offline or simulation refund
        txn.refund_status = "refunded"
        txn.refund_amount = ref_amt
        txn.status = "refunded"
        txn.updated_at = datetime.now(timezone.utc)
        if txn.order:
            txn.order.payment_status = "refunded"
        db.session.commit()
        flash(f"Transaction {txn.transaction_number} marked as Refunded (₹{ref_amt:.2f}).", "success")

    AuditService.log(
        action="PAYMENT_REFUND",
        module="operations",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="PaymentTransaction",
        entity_id=str(txn.id),
        details={"amount": str(ref_amt), "notes": notes},
    )
    return redirect(url_for("operations.payments_list"))


@operations_bp.route("/payments/<int:txn_id>/detail", methods=["GET"])
@login_required
@permission_required("operations", "view")
def payment_detail_json(txn_id):
    txn = PaymentTransaction.query.get_or_404(txn_id)
    payload = {
        "id": txn.id,
        "transaction_number": txn.transaction_number,
        "amount": float(txn.amount) if txn.amount else 0.0,
        "currency": txn.currency,
        "gateway": txn.gateway,
        "payment_method": txn.payment_method,
        "status": txn.status,
        "customer_name": txn.customer_name,
        "customer_email": txn.customer_email,
        "customer_phone": txn.customer_phone,
        "item_summary": txn.item_summary,
        "source_form": txn.source_form,
        "form_submission_id": txn.form_submission_id,
        "gateway_order_id": txn.gateway_order_id,
        "gateway_payment_id": txn.gateway_payment_id,
        "refund_status": txn.refund_status,
        "refund_amount": float(txn.refund_amount) if txn.refund_amount else 0.0,
        "created_at": txn.created_at.strftime("%d %b %Y, %I:%M %p") if txn.created_at else "",
        "updated_at": txn.updated_at.strftime("%d %b %Y, %I:%M %p") if txn.updated_at else "",
        "error_message": txn.error_message,
        "order": {
            "order_number": txn.order.order_number,
            "total_amount": float(txn.order.total_amount),
            "payment_status": txn.order.payment_status,
            "order_status": txn.order.order_status,
            "cod_status": txn.order.cod_status,
            "shipping_address": txn.order.shipping_address,
            "policy_version": txn.order.policy_version,
            "policy_accepted_at": txn.order.policy_accepted_at.strftime("%d %b %Y, %I:%M %p") if txn.order.policy_accepted_at else None,
        } if txn.order else None,
        "booking": {
            "booking_number": txn.booking.booking_number,
            "service_name": txn.booking.service.name if txn.booking.service else "",
            "booking_date": str(txn.booking.booking_date),
            "time_slot": txn.booking.time_slot,
            "status": txn.booking.status,
        } if txn.booking else None,
        "consultation": {
            "consultation_number": txn.consultation.consultation_number,
            "topic": txn.consultation.topic,
            "status": txn.consultation.status,
            "consultation_type": txn.consultation.consultation_type,
        } if txn.consultation else None,
    }
    return jsonify(payload), 200


# -------------------------------------------------------------
# Coupons
# -------------------------------------------------------------
@operations_bp.route("/coupons")
@login_required
@permission_required("operations", "view")
def coupons_list():
    user = get_current_admin()
    q = Coupon.query
    q = apply_date_time_filters(q, Coupon.created_at, request.args)
    date_filter = extract_date_filter_context(request.args)
    coupons = q.order_by(Coupon.created_at.desc()).all()
    return render_template("operations/coupons.html", current_user=user, coupons=coupons, active_page="coupons", date_filter=date_filter)


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
    q = ReturnRequest.query
    q = apply_date_time_filters(q, ReturnRequest.created_at, request.args)
    date_filter = extract_date_filter_context(request.args)
    returns = q.order_by(ReturnRequest.created_at.desc()).all()
    return render_template("operations/shipping.html", current_user=user, returns=returns, active_page="shipping", date_filter=date_filter)


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

    counts = {
        "all": CustomerEnquiry.query.count(),
        "open": CustomerEnquiry.query.filter_by(status="open").count(),
        "responded": CustomerEnquiry.query.filter_by(status="responded").count(),
        "closed": CustomerEnquiry.query.filter_by(status="closed").count(),
    }

    q = apply_date_time_filters(q, CustomerEnquiry.created_at, request.args)
    date_filter = extract_date_filter_context(request.args)
    enquiries = q.order_by(CustomerEnquiry.created_at.desc()).all()
    return render_template(
        "operations/enquiries.html",
        current_user=user,
        enquiries=enquiries,
        selected_status=status or "all",
        counts=counts,
        active_page="enquiries",
        date_filter=date_filter,
    )


@operations_bp.route("/enquiries/<int:enquiry_id>/status", methods=["POST"])
@login_required
@permission_required("enquiries", "edit")
def enquiry_status_update(enquiry_id):
    user = get_current_admin()
    enquiry = CustomerEnquiry.query.get_or_404(enquiry_id)
    new_status = request.form.get("status", "").strip().lower()
    if new_status in ["open", "responded", "closed"]:
        old_status = enquiry.status
        enquiry.status = new_status
        db.session.commit()
        AuditService.log(
            action="ENQUIRY_STATUS_UPDATE",
            module="operations",
            actor_email=user.email,
            actor_user_id=user.id,
            entity_type="CustomerEnquiry",
            entity_id=str(enquiry.id),
            details={"enquiry_number": enquiry.enquiry_number, "old_status": old_status, "new_status": new_status},
        )
        flash(f"Enquiry #{enquiry.enquiry_number} status updated to {new_status.title()}.", "success")
    return redirect(url_for("operations.enquiries_list"))


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

