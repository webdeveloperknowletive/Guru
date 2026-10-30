import json
from decimal import Decimal
from datetime import datetime, timezone
from flask import Blueprint, render_template, request, redirect, url_for, flash, abort, jsonify
from sqlalchemy.orm.attributes import flag_modified
from app.extensions import db
from app.models.commerce import Product, Category, InventoryAdjustment, Order, OrderItem, Customer, ProductReview
from app.services.commerce_service import CommerceService
from app.services.rbac_service import login_required, permission_required, get_current_admin
from app.services.audit_service import AuditService
from app.utils.date_filter import apply_date_time_filters, extract_date_filter_context

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

    q = apply_date_time_filters(q, Product.created_at, request.args)
    date_filter = extract_date_filter_context(request.args)

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
        date_filter=date_filter,
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


@commerce_bp.route("/products/<int:product_id>/data", methods=["GET"])
@login_required
@permission_required("commerce", "view")
def product_data(product_id):
    product = Product.query.get_or_404(product_id)
    return jsonify({
        "success": True,
        "product": {
            "id": product.id,
            "name": product.name,
            "sku": product.sku,
            "slug": product.slug,
            "category_id": product.category_id,
            "category_name": product.category.name if product.category else "",
            "price": str(product.price),
            "compare_price": str(product.compare_price) if product.compare_price is not None else "",
            "stock_quantity": product.stock_quantity,
            "low_stock_threshold": product.low_stock_threshold,
            "certification_status": product.certification_status,
            "publishing_status": product.publishing_status,
            "thumbnail": product.thumbnail or "",
            "images": product.images or [],
            "attributes": product.attributes or {},
            "description": product.description or "",
            "display_rank": product.display_rank,
            "is_low_stock": product.is_low_stock,
            "is_archived": bool(product.is_archived or product.publishing_status == "archived"),
        }
    })


@commerce_bp.route("/products/<int:product_id>/edit", methods=["POST"])
@login_required
@permission_required("commerce", "edit")
def product_update(product_id):
    user = get_current_admin()
    product = Product.query.get_or_404(product_id)
    is_ajax = (
        request.headers.get("X-Requested-With") == "XMLHttpRequest"
        or request.is_json
        or "application/json" in request.headers.get("Accept", "")
    )

    req_data = request.get_json() if request.is_json else request.form

    name = req_data.get("name", "").strip()
    if not name:
        if is_ajax:
            return jsonify({"success": False, "error": "Product name is required."}), 400
        flash("Product name is required.", "danger")
        return redirect(request.referrer or url_for("commerce.products_list"))

    raw_cat = req_data.get("category_id") or req_data.get("category")
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

    price_val = req_data.get("price")
    if price_val is not None:
        try:
            parsed_price = Decimal(str(price_val).strip())
            if parsed_price < 0:
                raise ValueError("Price cannot be negative")
            product.price = parsed_price
        except Exception:
            if is_ajax:
                return jsonify({"success": False, "error": "Please enter a valid non-negative selling price."}), 400
            flash("Please enter a valid price.", "danger")
            return redirect(request.referrer or url_for("commerce.products_list"))

    compare_price_val = req_data.get("compare_price")
    if compare_price_val is None:
        compare_price_val = req_data.get("compare_at_price")
    if compare_price_val is not None:
        str_comp = str(compare_price_val).strip()
        if str_comp:
            try:
                comp_num = Decimal(str_comp)
                if comp_num < 0:
                    raise ValueError("Compare-at price cannot be negative")
                product.compare_price = comp_num
            except Exception:
                if is_ajax:
                    return jsonify({"success": False, "error": "Compare-at price must be a valid non-negative number."}), 400
        else:
            product.compare_price = None

    stock_val = req_data.get("stock_quantity")
    if stock_val is not None and str(stock_val).strip() != "":
        try:
            stock_int = int(stock_val)
            if stock_int < 0:
                raise ValueError("Stock quantity cannot be negative")
            product.stock_quantity = stock_int
        except (ValueError, TypeError):
            if is_ajax:
                return jsonify({"success": False, "error": "Stock quantity must be a non-negative integer."}), 400

    threshold_val = req_data.get("low_stock_threshold")
    if threshold_val is not None and str(threshold_val).strip() != "":
        try:
            thresh_int = int(threshold_val)
            if thresh_int < 0:
                thresh_int = 0
            product.low_stock_threshold = thresh_int
        except (ValueError, TypeError):
            pass

    certification = req_data.get("certification_status")
    if certification:
        product.certification_status = certification.strip()

    pub_status = req_data.get("publishing_status")
    if pub_status:
        product.publishing_status = pub_status.strip()
        if product.publishing_status == "archived":
            product.is_archived = True
            product.archived_at = datetime.now(timezone.utc)
        elif product.is_archived:
            product.is_archived = False
            product.archived_at = None

    if "description" in req_data:
        product.description = req_data.get("description", "").strip()

    thumbnail = req_data.get("thumbnail", "").strip()
    thumb_file = request.files.get("thumbnail_file") or request.files.get("image") or request.files.get("file")
    resolved_thumb = CommerceService.ingest_product_thumbnail(file_obj=thumb_file, raw_path_or_url=thumbnail)
    if resolved_thumb:
        product.thumbnail = resolved_thumb
    elif thumbnail:
        product.thumbnail = thumbnail

    # Gallery images
    current_images = list(product.images or [])
    if hasattr(req_data, "getlist") and req_data.getlist("gallery_images"):
        raw_list = req_data.getlist("gallery_images")
        if len(raw_list) == 1 and str(raw_list[0]).strip().startswith("["):
            try:
                current_images = [str(x).strip() for x in json.loads(raw_list[0]) if str(x).strip()]
            except Exception:
                current_images = [str(x).strip() for x in raw_list if str(x).strip()]
        else:
            current_images = [str(x).strip() for x in raw_list if str(x).strip()]
    elif "gallery_images" in req_data:
        raw_gallery = req_data.get("gallery_images")
        if isinstance(raw_gallery, list):
            current_images = [str(x).strip() for x in raw_gallery if str(x).strip()]
        elif isinstance(raw_gallery, str):
            rg_str = raw_gallery.strip()
            if rg_str.startswith("["):
                try:
                    current_images = [str(x).strip() for x in json.loads(rg_str) if str(x).strip()]
                except Exception:
                    current_images = [x.strip() for x in rg_str.split(",") if x.strip()]
            elif rg_str:
                current_images = [x.strip() for x in rg_str.split(",") if x.strip()]
            else:
                current_images = []

    # Uploaded gallery files
    gallery_files = request.files.getlist("gallery_files")
    for g_file in gallery_files:
        if g_file and getattr(g_file, "filename", ""):
            uploaded_url = CommerceService.ingest_product_thumbnail(file_obj=g_file)
            if uploaded_url and uploaded_url not in current_images:
                current_images.append(uploaded_url)

    product.images = current_images
    flag_modified(product, "images")

    # Attributes dictionary
    attrs = dict(product.attributes or {})
    attr_fields = [
        "material", "size", "mukhi", "origin", "carat", "metal", "bead_size",
        "energized", "installation", "significance_en", "significance_mr",
        "how_to_wear_mr", "mantra", "care_mr", "shipping_mr", "cert_label"
    ]
    for k in attr_fields:
        if k in req_data:
            val = req_data.get(k)
            attrs[k] = str(val).strip() if val is not None else ""

    product.attributes = attrs
    flag_modified(product, "attributes")

    raw_rank = req_data.get("display_rank") or req_data.get("displayRank") or req_data.get("rank")
    if raw_rank is not None and str(raw_rank).strip():
        try:
            rank_val = int(raw_rank)
            if rank_val >= 1:
                product.display_rank = rank_val
        except (ValueError, TypeError):
            pass

    product.name = name
    if category_id:
        product.category_id = category_id

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

    if is_ajax:
        return jsonify({
            "success": True,
            "message": f"Product '{product.name}' updated successfully.",
            "product": {
                "id": product.id,
                "name": product.name,
                "sku": product.sku,
                "slug": product.slug,
                "category_id": product.category_id,
                "category_name": product.category.name if product.category else "-",
                "price": str(product.price),
                "price_num": float(product.price),
                "compare_price": str(product.compare_price) if product.compare_price is not None else "",
                "stock_quantity": product.stock_quantity,
                "low_stock_threshold": product.low_stock_threshold,
                "certification_status": product.certification_status,
                "publishing_status": product.publishing_status,
                "thumbnail": product.thumbnail or "/static/img/product-default.png",
                "images": product.images or [],
                "attributes": product.attributes or {},
                "description": product.description or "",
                "display_rank": product.display_rank,
                "is_low_stock": product.is_low_stock,
                "is_archived": bool(product.is_archived or product.publishing_status == "archived"),
            }
        })

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
    image_url = request.form.get("image_url", "").strip()
    image_file = request.files.get("image_file") or request.files.get("image") or request.files.get("file")
    resolved_img = CommerceService.ingest_product_thumbnail(file_obj=image_file, raw_path_or_url=image_url)
    if resolved_img:
        image_url = resolved_img

    if not name:
        flash("Category name is required.", "danger")
        return redirect(url_for("commerce.categories_list"))

    slug = name.lower().replace(" ", "-")
    cat = Category(name=name, slug=slug, icon=icon, description=description, image_url=image_url)
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

    image_url = request.form.get("image_url", "").strip()
    image_file = request.files.get("image_file") or request.files.get("image") or request.files.get("file")
    resolved_img = CommerceService.ingest_product_thumbnail(file_obj=image_file, raw_path_or_url=image_url)
    if resolved_img:
        cat.image_url = resolved_img
    elif "image_url" in request.form:
        cat.image_url = image_url

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


@commerce_bp.route("/categories/<int:category_id>/toggle-status", methods=["POST"])
@login_required
@permission_required("commerce", "edit")
def category_toggle_status(category_id):
    user = get_current_admin()
    cat = Category.query.get_or_404(category_id)
    cat.is_active = not cat.is_active
    db.session.commit()

    AuditService.log(
        action="CATEGORY_UPDATE",
        module="commerce",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Category",
        entity_id=str(cat.id),
        details={"name": cat.name, "is_active": cat.is_active, "field": "toggle_status"},
    )

    is_ajax = (
        request.is_json
        or request.headers.get("Accept") == "application/json"
        or request.headers.get("X-Requested-With") == "XMLHttpRequest"
    )

    if is_ajax:
        return jsonify({
            "success": True,
            "category_id": cat.id,
            "name": cat.name,
            "is_active": cat.is_active,
            "status_text": "Active" if cat.is_active else "Inactive",
            "message": f"Category '{cat.name}' is now {'Active' if cat.is_active else 'Inactive'}."
        })

    flash(f"Category '{cat.name}' is now {'Active' if cat.is_active else 'Inactive'}.", "success")
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
    adj_q = InventoryAdjustment.query
    adj_q = apply_date_time_filters(adj_q, InventoryAdjustment.created_at, request.args)
    recent_adjustments = adj_q.order_by(InventoryAdjustment.created_at.desc()).limit(25).all()
    date_filter = extract_date_filter_context(request.args)

    return render_template(
        "commerce/inventory.html",
        current_user=user,
        products=products,
        adjustments=recent_adjustments,
        low_stock_only=low_stock_only,
        active_page="inventory",
        date_filter=date_filter,
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
        return redirect(request.referrer or url_for("commerce.inventory_list"))

    try:
        product = CommerceService.adjust_inventory(product_id, change, reason, user, notes)
        flash(f"Updated inventory for {product.name}. New stock: {product.stock_quantity}", "success")
    except ValueError as e:
        flash(str(e), "danger")

    return redirect(request.referrer or url_for("commerce.inventory_list"))


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
        clean_num = query_str.lstrip('#').strip()
        q = q.filter(
            (Order.order_number.ilike(f"%{query_str}%")) |
            (Order.order_number.ilike(f"%{clean_num}%")) |
            (Order.customer_name.ilike(f"%{query_str}%")) |
            (Order.customer_email.ilike(f"%{query_str}%"))
        )

    q = apply_date_time_filters(q, Order.placed_at, request.args)
    date_filter = extract_date_filter_context(request.args)

    orders_paginated = q.order_by(Order.placed_at.desc()).paginate(page=page, per_page=15, error_out=False)
    return render_template(
        "commerce/orders.html",
        current_user=user,
        orders=orders_paginated.items,
        pagination=orders_paginated,
        selected_status=status,
        search_query=query_str,
        active_page="orders",
        date_filter=date_filter,
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


@commerce_bp.route("/orders/<int:order_id>/verify-payment", methods=["POST"])
@login_required
@permission_required("orders", "edit")
def order_verify_payment(order_id):
    user = get_current_admin()
    ref = request.form.get("transaction_reference", "").strip()
    notes = request.form.get("notes", "").strip()
    try:
        CommerceService.verify_offline_payment(order_id, user, transaction_reference=ref, notes=notes)
        flash("Offline payment verified and recorded. Order moved to processing.", "success")
    except Exception as e:
        flash(f"Failed to verify payment: {str(e)}", "danger")
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


@commerce_bp.route("/orders/<int:order_id>/invoice")
@login_required
@permission_required("orders", "view")
def order_invoice(order_id):
    user = get_current_admin()
    order = Order.query.get_or_404(order_id)
    return render_template("commerce/invoice.html", current_user=user, order=order)


@commerce_bp.route("/orders/<int:order_id>/packing-slip")
@login_required
@permission_required("orders", "view")
def order_packing_slip(order_id):
    user = get_current_admin()
    order = Order.query.get_or_404(order_id)
    return render_template("commerce/packing_slip.html", current_user=user, order=order)


# -------------------------------------------------------------
# Customers
# -------------------------------------------------------------
@commerce_bp.route("/customers")
@login_required
@permission_required("commerce", "view")
def customers_list():
    user = get_current_admin()
    q = Customer.query
    q = apply_date_time_filters(q, Customer.created_at, request.args)
    date_filter = extract_date_filter_context(request.args)
    customers = q.order_by(Customer.total_spent.desc()).limit(50).all()
    return render_template("commerce/customers.html", current_user=user, customers=customers, active_page="customers", date_filter=date_filter)


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
    q = ProductReview.query
    q = apply_date_time_filters(q, ProductReview.created_at, request.args)
    date_filter = extract_date_filter_context(request.args)
    reviews = q.order_by(ProductReview.created_at.desc()).all()
    return render_template("commerce/reviews.html", current_user=user, reviews=reviews, active_page="reviews", date_filter=date_filter)


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
