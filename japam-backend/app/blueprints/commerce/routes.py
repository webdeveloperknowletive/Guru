from decimal import Decimal
from datetime import datetime, timezone
from flask import Blueprint, render_template, request, redirect, url_for, flash, abort, jsonify
from app.extensions import db
from app.models.commerce import Product, Category, InventoryAdjustment, Order, OrderItem, Customer, ProductReview
from app.services.commerce_service import CommerceService
from app.services.rbac_service import login_required, permission_required, get_current_admin
from app.services.audit_service import AuditService

commerce_bp = Blueprint("commerce", __name__, url_prefix="/admin/commerce")


# -------------------------------------------------------------
# Products
# -------------------------------------------------------------
@commerce_bp.route("/products")
@login_required
@permission_required("commerce", "view")
def products_list():
    user = get_current_admin()
    raw_cat = request.args.get("category_id") or request.args.get("category")
    category_id = None
    if raw_cat is not None and str(raw_cat).strip():
        raw_cat_str = str(raw_cat).strip()
        if raw_cat_str.isdigit():
            category_id = int(raw_cat_str)
        else:
            cat_obj = Category.query.filter(
                (db.func.lower(Category.name) == raw_cat_str.lower()) |
                (db.func.lower(Category.slug) == raw_cat_str.lower()) |
                (Category.name.ilike(f"%{raw_cat_str}%"))
            ).first()
            if cat_obj:
                category_id = cat_obj.id
    status = request.args.get("status", "").strip()
    archive_status = request.args.get("archive_status", "active").strip().lower()
    query_str = request.args.get("q", "").strip()
    page = request.args.get("page", 1, type=int)

    # Sync legacy status='archived' to archive_status
    if status == "archived":
        archive_status = "archived"
        status = ""

    # Dynamic counts for filter badges
    count_all = Product.query.count()
    count_active = Product.query.filter(
        (Product.is_archived.is_(False) | Product.is_archived.is_(None)) & (Product.publishing_status != "archived")
    ).count()
    count_archived = Product.query.filter(
        (Product.is_archived.is_(True)) | (Product.publishing_status == "archived")
    ).count()

    q = Product.query
    if category_id:
        q = q.filter_by(category_id=category_id)

    # Apply Active / Archived / All filter
    if archive_status == "active":
        q = q.filter((Product.is_archived.is_(False) | Product.is_archived.is_(None)) & (Product.publishing_status != "archived"))
    elif archive_status == "archived":
        q = q.filter((Product.is_archived.is_(True)) | (Product.publishing_status == "archived"))
    # 'all' shows all products without archive filter

    if status:
        q = q.filter(db.func.lower(Product.publishing_status) == status.lower())
    if query_str:
        q = q.filter((Product.name.ilike(f"%{query_str}%")) | (Product.sku.ilike(f"%{query_str}%")))

    products_pagination = q.order_by(Product.display_rank.asc(), Product.created_at.desc(), Product.id.asc()).paginate(page=page, per_page=15, error_out=False)
    categories = Category.query.filter_by(is_active=True).order_by(Category.name.asc()).all()

    return render_template(
        "commerce/products.html",
        current_user=user,
        products=products_pagination.items,
        pagination=products_pagination,
        categories=categories,
        selected_category=category_id,
        selected_status=status,
        archive_status=archive_status,
        count_all=count_all,
        count_active=count_active,
        count_archived=count_archived,
        search_query=query_str,
        active_page="products",
    )


@commerce_bp.route("/products/create", methods=["POST"])
@login_required
@permission_required("commerce", "create")
def product_create():
    user = get_current_admin()
    name = request.form.get("name", "").strip()
    sku = request.form.get("sku", "").strip().upper()
    raw_cat = request.form.get("category_id") or request.form.get("category")
    category_id = None
    if raw_cat is not None and str(raw_cat).strip():
        raw_cat_str = str(raw_cat).strip()
        if raw_cat_str.isdigit():
            category_id = int(raw_cat_str)
        else:
            cat_obj = Category.query.filter(
                (db.func.lower(Category.name) == raw_cat_str.lower()) |
                (db.func.lower(Category.slug) == raw_cat_str.lower()) |
                (Category.name.ilike(f"%{raw_cat_str}%"))
            ).first()
            if cat_obj:
                category_id = cat_obj.id
    price_val = request.form.get("price", "0")
    compare_price_val = request.form.get("compare_price")
    stock_qty = request.form.get("stock_quantity", 0, type=int)
    threshold = request.form.get("low_stock_threshold", 10, type=int)
    certification = request.form.get("certification_status", "certified")
    pub_status = (request.form.get("publishing_status") or "published").strip().lower()
    if pub_status not in ["published", "draft", "archived"]:
        pub_status = "published"
    description = request.form.get("description", "").strip()
    thumbnail = request.form.get("thumbnail", "").strip()
    thumb_file = request.files.get("thumbnail_file") or request.files.get("image") or request.files.get("file")
    resolved_thumb = CommerceService.ingest_product_thumbnail(file_obj=thumb_file, raw_path_or_url=thumbnail)
    if resolved_thumb:
        thumbnail = resolved_thumb
    display_rank = request.form.get("display_rank", 999, type=int)
    if not display_rank or display_rank < 1:
        display_rank = 999

    # Domain specific attributes (mukhi, origin, carat, metal)
    attributes = {}
    if request.form.get("attr_mukhi"):
        attributes["mukhi"] = request.form.get("attr_mukhi")
    if request.form.get("attr_origin"):
        attributes["origin"] = request.form.get("attr_origin")
    if request.form.get("attr_carat"):
        attributes["carat"] = request.form.get("attr_carat")
    if request.form.get("attr_metal"):
        attributes["metal"] = request.form.get("attr_metal")
    if request.form.get("attr_energized"):
        attributes["energized"] = request.form.get("attr_energized")

    if not category_id:
        lower_n = name.lower()
        if "yantra" in lower_n:
            y_cat = Category.query.filter((Category.slug == "yantra") | (Category.name.ilike("%yantra%"))).first()
            if y_cat: category_id = y_cat.id
        elif "rudraksha" in lower_n or "mukhi" in lower_n:
            r_cat = Category.query.filter(Category.slug == "rudraksha").first()
            if r_cat: category_id = r_cat.id
        elif "bracelet" in lower_n:
            b_cat = Category.query.filter(Category.slug == "bracelets").first()
            if b_cat: category_id = b_cat.id

    if not name or not sku or not category_id:
        flash("Name, SKU, and Category are required.", "danger")
        return redirect(url_for("commerce.products_list", category_id=category_id, archive_status="active"))

    existing_sku = Product.query.filter_by(sku=sku).first()
    if existing_sku:
        flash(f"SKU '{sku}' already exists. Please choose a unique SKU.", "danger")
        return redirect(url_for("commerce.products_list", category_id=category_id, archive_status="active"))

    slug = name.lower().replace(" ", "-").replace("/", "-") + f"-{sku.lower()}"

    product = Product(
        name=name,
        slug=slug,
        sku=sku,
        category_id=category_id,
        price=Decimal(price_val),
        compare_price=Decimal(compare_price_val) if compare_price_val else None,
        stock_quantity=stock_qty,
        low_stock_threshold=threshold,
        certification_status=certification,
        publishing_status=pub_status,
        description=description,
        display_rank=display_rank,
        thumbnail=thumbnail or "/static/img/product-default.png",
        attributes=attributes,
        is_archived=False,
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(product)
    db.session.commit()

    AuditService.log(
        action="PRODUCT_CREATE",
        module="commerce",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Product",
        entity_id=str(product.id),
        details={"sku": sku, "name": name, "price": str(price_val), "stock": stock_qty},
    )
    flash(f"Spiritual product '{name}' created successfully.", "success")
    return redirect(url_for("commerce.products_list", category_id=category_id, archive_status="active"))


@commerce_bp.route("/products/<int:product_id>/archive", methods=["POST"])
@login_required
@permission_required("commerce", "archive")
def product_archive(product_id):
    user = get_current_admin()
    product = Product.query.get_or_404(product_id)

    # Save previous publication status if it's currently known and not already archived
    if product.publishing_status in ("published", "draft"):
        product.previous_publishing_status = product.publishing_status
    elif not product.previous_publishing_status:
        product.previous_publishing_status = "draft"

    product.is_archived = True
    product.archived_at = datetime.now(timezone.utc)
    product.publishing_status = "archived"
    product.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    AuditService.log(
        action="PRODUCT_ARCHIVE",
        module="commerce",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Product",
        entity_id=str(product.id),
        details={
            "sku": product.sku,
            "name": product.name,
            "previous_publishing_status": product.previous_publishing_status,
        },
    )
    flash(f"Spiritual product '{product.name}' archived successfully.", "info")
    ret_archive = request.args.get("archive_status", "all")
    return redirect(url_for("commerce.products_list", archive_status=ret_archive))


@commerce_bp.route("/products/<int:product_id>/unarchive", methods=["POST"])
@login_required
@permission_required("commerce", "unarchive")
def product_unarchive(product_id):
    user = get_current_admin()
    product = Product.query.get_or_404(product_id)

    # Restoring must update the existing record and preserve its ID, images, variants, stock, prices, and order history.
    # Keep archive status separate from publication status.
    # Restore the product to its previous publication state; if that state is unknown, restore it as a draft.
    previous_state = product.previous_publishing_status
    if previous_state in ("published", "draft"):
        restored_status = previous_state
    else:
        restored_status = "draft"

    product.is_archived = False
    product.archived_at = None
    product.publishing_status = restored_status
    product.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    AuditService.log(
        action="PRODUCT_UNARCHIVE",
        module="commerce",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Product",
        entity_id=str(product.id),
        details={
            "sku": product.sku,
            "name": product.name,
            "restored_status": restored_status,
            "previous_publishing_status": previous_state,
        },
    )
    flash(f"Spiritual product '{product.name}' unarchived and restored successfully (Status: {restored_status.capitalize()}).", "success")
    ret_archive = request.args.get("archive_status", "archived")
    return redirect(url_for("commerce.products_list", archive_status=ret_archive))


@commerce_bp.route("/products/<int:product_id>/edit", methods=["POST"])
@login_required
@permission_required("commerce", "edit")
def product_update(product_id):
    user = get_current_admin()
    product = Product.query.get_or_404(product_id)

    name = request.form.get("name", "").strip()
    raw_cat = request.form.get("category_id") or request.form.get("category")
    category_id = None
    if raw_cat is not None and str(raw_cat).strip():
        raw_cat_str = str(raw_cat).strip()
        if raw_cat_str.isdigit():
            category_id = int(raw_cat_str)
        else:
            cat_obj = Category.query.filter(
                (db.func.lower(Category.name) == raw_cat_str.lower()) |
                (db.func.lower(Category.slug) == raw_cat_str.lower()) |
                (Category.name.ilike(f"%{raw_cat_str}%"))
            ).first()
            if cat_obj:
                category_id = cat_obj.id
    price_val = request.form.get("price")
    compare_price_val = request.form.get("compare_price")
    stock_qty = request.form.get("stock_quantity", type=int)
    threshold = request.form.get("low_stock_threshold", type=int)
    certification = request.form.get("certification_status")
    pub_status = request.form.get("publishing_status")
    description = request.form.get("description", "").strip()
    thumbnail = request.form.get("thumbnail", "").strip()
    display_rank = request.form.get("display_rank", 999, type=int)
    if not display_rank or display_rank < 1:
        display_rank = 999

    if name:
        product.name = name
    if category_id:
        product.category_id = category_id
    if price_val:
        product.price = Decimal(price_val)
    if compare_price_val is not None:
        product.compare_price = Decimal(compare_price_val) if compare_price_val.strip() else None
    if stock_qty is not None:
        product.stock_quantity = stock_qty
    if threshold is not None:
        product.low_stock_threshold = threshold
    if certification:
        product.certification_status = certification
    if pub_status:
        product.publishing_status = pub_status
    if description:
        product.description = description
    thumb_file = request.files.get("thumbnail_file") or request.files.get("image") or request.files.get("file")
    resolved_thumb = CommerceService.ingest_product_thumbnail(file_obj=thumb_file, raw_path_or_url=thumbnail)
    if resolved_thumb:
        product.thumbnail = resolved_thumb
    elif thumbnail:
        product.thumbnail = thumbnail
    raw_rank = request.form.get("display_rank") or request.form.get("displayRank") or request.form.get("rank")
    if raw_rank is not None and str(raw_rank).strip():
        try:
            rank_val = int(raw_rank)
            if rank_val >= 1:
                product.display_rank = rank_val
        except (ValueError, TypeError):
            pass
    display_rank = request.form.get("display_rank", type=int)
    if display_rank is not None and display_rank >= 1:
        product.display_rank = display_rank

    product.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    AuditService.log(
        action="PRODUCT_UPDATE",
        module="commerce",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Product",
        entity_id=str(product.id),
        details={"sku": product.sku, "name": product.name, "price": str(product.price), "stock": product.stock_quantity},
    )
    flash(f"Product '{product.name}' updated successfully.", "success")
    return redirect(url_for("commerce.products_list", category_id=category_id, archive_status="active"))


@commerce_bp.route("/upload-image", methods=["POST"])
@login_required
def upload_product_image():
    file = request.files.get("image") or request.files.get("file") or request.files.get("thumbnail_file")
    raw_path = request.form.get("path") or request.form.get("thumbnail")
    saved_url = CommerceService.ingest_product_thumbnail(file_obj=file, raw_path_or_url=raw_path)
    if saved_url:
        return jsonify({"success": True, "url": saved_url})
    return jsonify({"success": False, "error": "No valid file or path found"}), 400


@commerce_bp.route("/products/<int:product_id>/delete", methods=["POST", "DELETE"])
@login_required
@permission_required("commerce", "delete")
def product_delete(product_id):
    user = get_current_admin()
    product = Product.query.get_or_404(product_id)
    is_json = request.is_json or request.headers.get("Accept") == "application/json" or request.method == "DELETE"

    try:
        # Check if referenced in order items
        if product.order_items:
            # Preserve past order records safely by marking product archived and removing from storefront
            if product.publishing_status in ("published", "draft"):
                product.previous_publishing_status = product.publishing_status
            product.is_archived = True
            product.archived_at = datetime.now(timezone.utc)
            product.publishing_status = "archived"
            product.updated_at = datetime.now(timezone.utc)
            db.session.commit()

            AuditService.log(
                action="PRODUCT_DELETE",
                module="commerce",
                actor_email=user.email,
                actor_user_id=user.id,
                entity_type="Product",
                entity_id=str(product.id),
                details={
                    "sku": product.sku,
                    "name": product.name,
                    "action": "soft_deleted_archived",
                    "reason": "referenced_in_orders",
                },
            )
            msg = f"Product '{product.name}' is referenced in past orders; safely archived and removed from public storefront."
            if is_json:
                return jsonify({"success": True, "message": msg, "soft_deleted": True, "product_id": product.id}), 200
            flash(msg, "success")
        else:
            name = product.name
            sku = product.sku
            db.session.delete(product)
            db.session.commit()

            AuditService.log(
                action="PRODUCT_DELETE",
                module="commerce",
                actor_email=user.email,
                actor_user_id=user.id,
                entity_type="Product",
                entity_id=str(product_id),
                details={"sku": sku, "name": name, "action": "permanently_deleted"},
            )
            msg = f"Product '{name}' permanently deleted."
            if is_json:
                return jsonify({"success": True, "message": msg, "soft_deleted": False, "product_id": product_id}), 200
            flash(msg, "success")
    except Exception as e:
        db.session.rollback()
        err_msg = f"Failed to delete product: {str(e)}"
        if is_json:
            return jsonify({"error": err_msg}), 500
        flash(err_msg, "danger")

    return redirect(url_for("commerce.products_list", archive_status="active"))


# -------------------------------------------------------------
# Categories
# -------------------------------------------------------------
@commerce_bp.route("/categories")
@login_required
@permission_required("commerce", "view")
def categories_list():
    user = get_current_admin()
    categories = Category.query.order_by(Category.sort_order.asc(), Category.name.asc()).all()
    return render_template("commerce/categories.html", current_user=user, categories=categories, active_page="categories")


@commerce_bp.route("/categories/create", methods=["POST"])
@login_required
@permission_required("commerce", "create")
def category_create():
    user = get_current_admin()
    name = request.form.get("name", "").strip()
    icon = request.form.get("icon", "box").strip()
    description = request.form.get("description", "").strip()
    if not name:
        flash("Category name is required.", "danger")
        return redirect(url_for("commerce.categories_list"))

    slug = name.lower().replace(" ", "-")
    cat = Category(name=name, slug=slug, icon=icon, description=description)
    db.session.add(cat)
    db.session.commit()

    AuditService.log(
        action="CATEGORY_CREATE",
        module="commerce",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Category",
        entity_id=str(cat.id),
        details={"name": name},
    )
    flash(f"Category '{name}' created.", "success")
    return redirect(url_for("commerce.categories_list"))


@commerce_bp.route("/categories/<int:category_id>/edit", methods=["POST"])
@login_required
@permission_required("commerce", "edit")
def category_update(category_id):
    user = get_current_admin()
    cat = Category.query.get_or_404(category_id)
    name = request.form.get("name", "").strip()
    icon = request.form.get("icon", cat.icon or "box").strip()
    description = request.form.get("description", "").strip()
    is_active = request.form.get("is_active") == "1"

    if name:
        cat.name = name
    cat.icon = icon
    cat.description = description
    cat.is_active = is_active
    db.session.commit()

    AuditService.log(
        action="CATEGORY_UPDATE",
        module="commerce",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Category",
        entity_id=str(cat.id),
        details={"name": cat.name, "is_active": cat.is_active},
    )
    flash(f"Category '{cat.name}' updated successfully.", "success")
    return redirect(url_for("commerce.categories_list"))


@commerce_bp.route("/categories/<int:category_id>/delete", methods=["POST", "DELETE"])
@login_required
@permission_required("commerce", "delete")
def category_delete(category_id):
    user = get_current_admin()
    cat = Category.query.get_or_404(category_id)
    is_json = request.is_json or request.headers.get("Accept") == "application/json" or request.method == "DELETE"

    active_products = [p for p in cat.products if not p.is_archived and p.publishing_status != "archived"]
    if active_products:
        msg = f"Cannot delete category '{cat.name}' because {len(active_products)} active product(s) belong to it. Please reassign or remove them first."
        if is_json:
            return jsonify({"error": msg}), 400
        flash(msg, "danger")
        return redirect(url_for("commerce.categories_list"))

    try:
        name = cat.name
        db.session.delete(cat)
        db.session.commit()

        AuditService.log(
            action="CATEGORY_DELETE",
            module="commerce",
            actor_email=user.email,
            actor_user_id=user.id,
            entity_type="Category",
            entity_id=str(category_id),
            details={"name": name},
        )
        msg = f"Category '{name}' deleted successfully."
        if is_json:
            return jsonify({"success": True, "message": msg, "category_id": category_id}), 200
        flash(msg, "success")
    except Exception as e:
        db.session.rollback()
        err_msg = f"Failed to delete category: {str(e)}"
        if is_json:
            return jsonify({"error": err_msg}), 500
        flash(err_msg, "danger")

    return redirect(url_for("commerce.categories_list"))



# -------------------------------------------------------------
# Inventory & Stock Adjustments
# -------------------------------------------------------------
@commerce_bp.route("/inventory")
@login_required
@permission_required("inventory", "view")
def inventory_list():
    user = get_current_admin()
    low_stock_only = request.args.get("low_stock") == "1"
    q = Product.query.filter(Product.publishing_status != "archived")
    if low_stock_only:
        q = q.filter(Product.stock_quantity <= Product.low_stock_threshold)

    products = q.order_by(Product.stock_quantity.asc()).all()
    recent_adjustments = InventoryAdjustment.query.order_by(InventoryAdjustment.created_at.desc()).limit(15).all()

    return render_template(
        "commerce/inventory.html",
        current_user=user,
        products=products,
        adjustments=recent_adjustments,
        low_stock_only=low_stock_only,
        active_page="inventory",
    )


@commerce_bp.route("/inventory/adjust", methods=["POST"])
@login_required
@permission_required("inventory", "edit")
def inventory_adjust():
    user = get_current_admin()
    product_id = request.form.get("product_id", type=int)
    change = request.form.get("quantity_change", type=int)
    reason = request.form.get("reason", "Restock").strip()
    notes = request.form.get("notes", "").strip()

    if not product_id or change is None:
        flash("Product and quantity change are required.", "danger")
        return redirect(url_for("commerce.inventory_list"))

    try:
        product = CommerceService.adjust_inventory(product_id, change, reason, user, notes)
        flash(f"Updated inventory for {product.name}. New stock: {product.stock_quantity}", "success")
    except ValueError as e:
        flash(str(e), "danger")

    return redirect(url_for("commerce.inventory_list"))


# -------------------------------------------------------------
# Orders & Fulfillment
# -------------------------------------------------------------
@commerce_bp.route("/orders")
@login_required
@permission_required("orders", "view")
def orders_list():
    user = get_current_admin()
    status = request.args.get("status")
    query_str = request.args.get("q", "").strip()
    page = request.args.get("page", 1, type=int)

    q = Order.query
    if status:
        q = q.filter_by(order_status=status)
    if query_str:
        q = q.filter((Order.order_number.ilike(f"%{query_str}%")) | (Order.customer_name.ilike(f"%{query_str}%")))

    orders_paginated = q.order_by(Order.placed_at.desc()).paginate(page=page, per_page=15, error_out=False)
    return render_template(
        "commerce/orders.html",
        current_user=user,
        orders=orders_paginated.items,
        pagination=orders_paginated,
        selected_status=status,
        search_query=query_str,
        active_page="orders",
    )


@commerce_bp.route("/orders/<int:order_id>")
@login_required
@permission_required("orders", "view")
def order_detail(order_id):
    user = get_current_admin()
    order = Order.query.get_or_404(order_id)
    return render_template("commerce/order_detail.html", current_user=user, order=order, active_page="orders")


@commerce_bp.route("/orders/<int:order_id>/status", methods=["POST"])
@login_required
@permission_required("orders", "edit")
def order_update_status(order_id):
    user = get_current_admin()
    new_status = request.form.get("order_status")
    notes = request.form.get("notes")
    try:
        CommerceService.update_order_status(order_id, new_status, user, notes)
        flash(f"Order status updated to '{new_status}'.", "success")
    except ValueError as e:
        flash(str(e), "danger")
    return redirect(url_for("commerce.order_detail", order_id=order_id))


@commerce_bp.route("/orders/<int:order_id>/refund", methods=["POST"])
@login_required
@permission_required("orders", "refund")
def order_refund(order_id):
    user = get_current_admin()
    amount_str = request.form.get("amount")
    reason = request.form.get("reason", "Customer request").strip()
    try:
        amount = Decimal(amount_str)
        CommerceService.process_refund(order_id, amount, reason, user)
        flash(f"Refund of ₹{amount} processed successfully.", "success")
    except Exception as e:
        flash(str(e), "danger")
    return redirect(url_for("commerce.order_detail", order_id=order_id))


# -------------------------------------------------------------
# Customers
# -------------------------------------------------------------
@commerce_bp.route("/customers")
@login_required
@permission_required("commerce", "view")
def customers_list():
    user = get_current_admin()
    customers = Customer.query.order_by(Customer.total_spent.desc()).limit(50).all()
    return render_template("commerce/customers.html", current_user=user, customers=customers, active_page="customers")


@commerce_bp.route("/customers/<int:customer_id>/edit", methods=["POST"])
@login_required
@permission_required("commerce", "edit")
def customer_update(customer_id):
    user = get_current_admin()
    cust = Customer.query.get_or_404(customer_id)
    cust.full_name = request.form.get("full_name", cust.full_name).strip()
    cust.phone = request.form.get("phone", cust.phone).strip()
    cust.city = request.form.get("city", cust.city).strip()
    cust.state = request.form.get("state", cust.state).strip()
    cust.pincode = request.form.get("pincode", cust.pincode).strip()
    cust.address = request.form.get("address", cust.address).strip()
    cust.is_active = request.form.get("is_active") == "1"
    db.session.commit()

    AuditService.log(
        action="CUSTOMER_UPDATE",
        module="commerce",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Customer",
        entity_id=str(cust.id),
        details={"name": cust.full_name, "email": cust.email, "is_active": cust.is_active},
    )
    flash(f"Customer '{cust.full_name}' updated successfully.", "success")
    return redirect(url_for("commerce.customers_list"))



# -------------------------------------------------------------
# Reviews Moderation
# -------------------------------------------------------------
@commerce_bp.route("/reviews")
@login_required
@permission_required("reviews", "view")
def reviews_list():
    user = get_current_admin()
    reviews = ProductReview.query.order_by(ProductReview.created_at.desc()).all()
    return render_template("commerce/reviews.html", current_user=user, reviews=reviews, active_page="reviews")


@commerce_bp.route("/reviews/<int:review_id>/moderate", methods=["POST"])
@login_required
@permission_required("reviews", "approve")
def review_moderate(review_id):
    user = get_current_admin()
    action = request.form.get("action")  # 'approve' or 'reject'
    is_approved = (action == "approve")
    try:
        CommerceService.moderate_review(review_id, is_approved, user)
        flash(f"Review {'approved' if is_approved else 'rejected'}.", "success")
    except ValueError as e:
        flash(str(e), "danger")
    return redirect(url_for("commerce.reviews_list"))
