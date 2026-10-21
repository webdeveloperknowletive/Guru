from decimal import Decimal
from datetime import datetime, timezone
from app.extensions import db
from app.models.commerce import Product, Category, InventoryAdjustment, Order, OrderItem, ProductReview
from app.models.operations import PaymentTransaction
from app.services.audit_service import AuditService


class CommerceService:
    @staticmethod
    def adjust_inventory(product_id: int, quantity_change: int, reason: str, admin_user, notes: str = None) -> Product:
        """
        Thread-safe stock adjustment using row-level locking (with_for_update).
        Prevents concurrency race conditions and logs to inventory audit history.
        """
        # Lock product row
        product = Product.query.filter_by(id=product_id).with_for_update().first()
        if not product:
            raise ValueError(f"Product ID {product_id} not found.")

        old_stock = product.stock_quantity
        new_stock = old_stock + quantity_change
        if new_stock < 0:
            raise ValueError(f"Cannot reduce stock below zero. Current stock is {old_stock}.")

        product.stock_quantity = new_stock

        adjustment = InventoryAdjustment(
            product_id=product.id,
            admin_user_id=admin_user.id if admin_user else None,
            quantity_change=quantity_change,
            previous_stock=old_stock,
            new_stock=new_stock,
            reason=reason,
            notes=notes,
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(adjustment)
        db.session.commit()

        AuditService.log(
            action="STOCK_ADJUSTMENT",
            module="commerce",
            actor_email=admin_user.email if admin_user else "system",
            actor_user_id=admin_user.id if admin_user else None,
            entity_type="Product",
            entity_id=str(product.id),
            details={
                "sku": product.sku,
                "product_name": product.name,
                "previous_stock": old_stock,
                "new_stock": new_stock,
                "change": quantity_change,
                "reason": reason,
            },
        )
        return product

    @staticmethod
    def update_order_status(order_id: int, new_status: str, admin_user, notes: str = None) -> Order:
        order = Order.query.filter_by(id=order_id).first()
        if not order:
            raise ValueError(f"Order ID {order_id} not found.")

        valid_statuses = {"pending", "processing", "shipped", "delivered", "cancelled"}
        if new_status.lower() not in valid_statuses:
            raise ValueError(f"Invalid order status: {new_status}")

        old_status = order.order_status
        order.order_status = new_status.lower()
        if notes:
            order.admin_notes = f"{order.admin_notes or ''}\n[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] {notes}".strip()

        db.session.commit()

        AuditService.log(
            action="ORDER_STATUS_CHANGE",
            module="commerce",
            actor_email=admin_user.email if admin_user else "system",
            actor_user_id=admin_user.id if admin_user else None,
            entity_type="Order",
            entity_id=str(order.id),
            details={
                "order_number": order.order_number,
                "old_status": old_status,
                "new_status": new_status,
            },
        )
        return order

    @staticmethod
    def process_refund(order_id: int, amount: Decimal, reason: str, admin_user) -> PaymentTransaction:
        order = Order.query.filter_by(id=order_id).first()
        if not order:
            raise ValueError(f"Order ID {order_id} not found.")

        if amount <= 0 or amount > order.total_amount:
            raise ValueError(f"Refund amount ₹{amount} is invalid for order total ₹{order.total_amount}.")

        order.payment_status = "refunded"
        order.order_status = "cancelled"

        txn = PaymentTransaction(
            transaction_number=f"REF-{order.order_number.replace('#', '')}-{int(datetime.now(timezone.utc).timestamp())}",
            order_id=order.id,
            amount=amount,
            currency="INR",
            gateway=order.payment_method or "Razorpay",
            status="refunded",
            customer_name=order.customer_name,
            customer_email=order.customer_email,
            error_message=f"Refund reason: {reason}",
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(txn)
        db.session.commit()

        AuditService.log(
            action="ORDER_REFUND",
            module="commerce",
            actor_email=admin_user.email if admin_user else "system",
            actor_user_id=admin_user.id if admin_user else None,
            entity_type="Order",
            entity_id=str(order.id),
            details={
                "order_number": order.order_number,
                "refund_amount": str(amount),
                "reason": reason,
            },
        )
        return txn

    @staticmethod
    def moderate_review(review_id: int, is_approved: bool, admin_user) -> ProductReview:
        review = ProductReview.query.filter_by(id=review_id).first()
        if not review:
            raise ValueError(f"Review ID {review_id} not found.")

        review.is_approved = is_approved
        db.session.commit()

        AuditService.log(
            action="REVIEW_MODERATION",
            module="commerce",
            actor_email=admin_user.email if admin_user else "system",
            actor_user_id=admin_user.id if admin_user else None,
            entity_type="ProductReview",
            entity_id=str(review.id),
            details={"approved": is_approved, "product_id": review.product_id},
        )
        return review

    @staticmethod
    def ingest_product_thumbnail(file_obj=None, raw_path_or_url: str = None) -> str:
        """
        Handles both direct file uploads and local path inputs (e.g. D:\\Downloads\\image.png).
        Ensures that any image is stored in app/static/uploads/products/ and returns a public URL:
        /static/uploads/products/<unique_name>
        """
        import os, shutil, uuid, re
        from flask import current_app
        from werkzeug.utils import secure_filename

        upload_dir = os.path.join(current_app.root_path, "static", "uploads", "products")
        os.makedirs(upload_dir, exist_ok=True)

        # 1. Direct file upload from folder
        if file_obj and hasattr(file_obj, "filename") and file_obj.filename:
            orig = secure_filename(file_obj.filename)
            if not orig:
                orig = "uploaded_image.png"
            filename = f"{uuid.uuid4().hex[:10]}_{orig}"
            dest_path = os.path.join(upload_dir, filename)
            file_obj.save(dest_path)
            return f"/static/uploads/products/{filename}"

        # 2. Path or URL string handling
        if not raw_path_or_url:
            return None

        path_str = str(raw_path_or_url).strip()
        if path_str.startswith("http://") or path_str.startswith("https://"):
            return path_str
        if path_str.startswith("/static/uploads/products/"):
            return path_str

        # Clean file:/// prefix if present
        if path_str.startswith("file:///"):
            path_str = path_str[8:]
        elif path_str.startswith("file://"):
            path_str = path_str[7:]

        # Check candidates for local file path
        candidates = [
            path_str,
            path_str.replace("/", "\\"),
            path_str.replace("\\", "/"),
        ]

        m2 = re.match(r"^([A-Za-z]):[\\/]?(Downloads|Desktop|Documents|Pictures|Users)[\\/]?(.*)$", path_str, re.IGNORECASE)
        if m2:
            candidates.append(f"{m2.group(1)}:\\{m2.group(2)}\\{m2.group(3)}")
            candidates.append(f"{m2.group(1)}:/{m2.group(2)}/{m2.group(3)}")

        basename = os.path.basename(path_str.replace("\\", "/"))
        user_home = os.path.expanduser("~")
        candidates.append(os.path.join(user_home, "Downloads", basename))
        candidates.append(os.path.join("D:\\Downloads", basename))

        found_src = None
        for cand in candidates:
            if cand and os.path.isfile(cand):
                found_src = cand
                break

        if found_src:
            orig = secure_filename(os.path.basename(found_src))
            if not orig:
                orig = "product_image.png"
            filename = f"{uuid.uuid4().hex[:10]}_{orig}"
            dest_path = os.path.join(upload_dir, filename)
            shutil.copy2(found_src, dest_path)
            return f"/static/uploads/products/{filename}"

        return path_str.replace("\\", "/")
