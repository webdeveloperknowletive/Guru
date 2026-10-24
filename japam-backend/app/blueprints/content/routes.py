import os
import uuid
import zoneinfo
from datetime import datetime, timezone
from werkzeug.utils import secure_filename
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app, jsonify
from app.extensions import db
from app.models.content import BlogPost, Testimonial, GurujiProfile, MediaFile, Banner, WelcomePopupSetting, AdBanner
from app.models.operations import Coupon
from app.services.rbac_service import login_required, permission_required, get_current_admin
from app.services.audit_service import AuditService
from app.services.section_service import SectionService

content_bp = Blueprint("content", __name__, url_prefix="/admin/content")


# -------------------------------------------------------------
# Blog
# -------------------------------------------------------------
@content_bp.route("/blog")
@login_required
@permission_required("content", "view")
def blog_list():
    user = get_current_admin()
    posts = BlogPost.query.order_by(BlogPost.created_at.desc()).all()
    return render_template("content/blog.html", current_user=user, posts=posts, active_page="blog")


@content_bp.route("/blog/create", methods=["POST"])
@login_required
@permission_required("content", "create")
def blog_create():
    user = get_current_admin()
    title = request.form.get("title", "").strip()
    category = request.form.get("category", "Vedic Wisdom").strip()
    content = request.form.get("content", "").strip()
    excerpt = request.form.get("excerpt", "").strip()
    cover_image = request.form.get("cover_image", "").strip()
    author_name = request.form.get("author_name", "").strip() or user.full_name
    tags = request.form.get("tags", "").strip()
    is_published = request.form.get("is_published") in ("1", "true", "on", "True", True) or ("is_published" not in request.form)

    if not title or not content:
        flash("Title and content are required.", "danger")
        return redirect(url_for("content.blog_list"))

    # Handle image file upload if provided
    cover_file = request.files.get("cover_image_file")
    if cover_file and cover_file.filename != "":
        orig_name = secure_filename(cover_file.filename)
        ext = orig_name.rsplit(".", 1)[-1].lower() if "." in orig_name else ""
        allowed = current_app.config.get("ALLOWED_IMAGE_EXTENSIONS", {"jpg", "jpeg", "png", "webp", "svg"})
        if ext in allowed:
            unique_filename = f"blog_{uuid.uuid4().hex[:8]}_{orig_name}"
            upload_folder = os.path.join(current_app.root_path, "static", "uploads")
            os.makedirs(upload_folder, exist_ok=True)
            cover_file.save(os.path.join(upload_folder, unique_filename))
            cover_image = f"/static/uploads/{unique_filename}"

    slug_base = "".join(c if c.isalnum() or c in (" ", "-", "_") else "" for c in title.lower())
    slug_base = slug_base.strip().replace(" ", "-")[:60]
    if not slug_base:
        slug_base = "vedic-article"
    slug = f"{slug_base}-{int(datetime.now(timezone.utc).timestamp())}"

    post = BlogPost(
        title=title,
        slug=slug,
        category=category,
        content=content,
        excerpt=excerpt or content[:160],
        cover_image=cover_image or None,
        author_name=author_name,
        tags=tags or None,
        is_published=is_published,
    )
    db.session.add(post)
    db.session.commit()

    AuditService.log(
        action="BLOG_POST_CREATE",
        module="content",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="BlogPost",
        entity_id=str(post.id),
        details={"title": title, "slug": slug},
    )
    flash("Blog article published successfully.", "success")
    return redirect(url_for("content.blog_list"))


@content_bp.route("/blog/<int:post_id>/edit", methods=["POST"])
@login_required
@permission_required("content", "edit")
def blog_update(post_id):
    user = get_current_admin()
    post = BlogPost.query.get_or_404(post_id)

    title = request.form.get("title", "").strip()
    category = request.form.get("category", post.category).strip()
    content = request.form.get("content", "").strip()
    excerpt = request.form.get("excerpt", "").strip()
    cover_image = request.form.get("cover_image", "").strip()
    author_name = request.form.get("author_name", "").strip()
    tags = request.form.get("tags", "").strip()
    is_published = request.form.get("is_published") in ("1", "true", "on", "True", True)

    # Handle image file upload if provided
    cover_file = request.files.get("cover_image_file")
    if cover_file and cover_file.filename != "":
        orig_name = secure_filename(cover_file.filename)
        ext = orig_name.rsplit(".", 1)[-1].lower() if "." in orig_name else ""
        allowed = current_app.config.get("ALLOWED_IMAGE_EXTENSIONS", {"jpg", "jpeg", "png", "webp", "svg"})
        if ext in allowed:
            unique_filename = f"blog_{uuid.uuid4().hex[:8]}_{orig_name}"
            upload_folder = os.path.join(current_app.root_path, "static", "uploads")
            os.makedirs(upload_folder, exist_ok=True)
            cover_file.save(os.path.join(upload_folder, unique_filename))
            post.cover_image = f"/static/uploads/{unique_filename}"
    elif cover_image:
        post.cover_image = cover_image

    if title:
        post.title = title
    if content:
        post.content = content
    post.category = category
    if excerpt:
        post.excerpt = excerpt
    if author_name:
        post.author_name = author_name
    if tags is not None:
        post.tags = tags
    post.is_published = is_published
    post.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    AuditService.log(
        action="BLOG_POST_UPDATE",
        module="content",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="BlogPost",
        entity_id=str(post.id),
        details={"title": post.title, "is_published": post.is_published},
    )
    flash("Blog article updated successfully.", "success")
    return redirect(url_for("content.blog_list"))


@content_bp.route("/blog/<int:post_id>/delete", methods=["POST", "DELETE"])
@login_required
@permission_required("content", "delete")
def blog_delete(post_id):
    user = get_current_admin()
    post = BlogPost.query.get_or_404(post_id)
    is_json = request.is_json or request.headers.get("Accept") == "application/json" or request.method == "DELETE"
    title = post.title
    try:
        db.session.delete(post)
        db.session.commit()

        AuditService.log(
            action="BLOG_POST_DELETE",
            module="content",
            actor_email=user.email,
            actor_user_id=user.id,
            entity_type="BlogPost",
            entity_id=str(post_id),
            details={"title": title},
        )
        msg = f"Article '{title}' deleted."
        if is_json:
            return jsonify({"success": True, "message": msg, "post_id": post_id}), 200
        flash(msg, "success")
    except Exception as e:
        db.session.rollback()
        err_msg = f"Failed to delete article: {str(e)}"
        if is_json:
            return jsonify({"error": err_msg}), 500
        flash(err_msg, "danger")

    return redirect(url_for("content.blog_list"))


# -------------------------------------------------------------
# Testimonials
# -------------------------------------------------------------
@content_bp.route("/testimonials")
@login_required
@permission_required("content", "view")
def testimonials_list():
    user = get_current_admin()
    testimonials = Testimonial.query.order_by(Testimonial.sort_order.asc(), Testimonial.created_at.desc()).all()
    return render_template("content/testimonials.html", current_user=user, testimonials=testimonials, active_page="testimonials")


@content_bp.route("/testimonials/create", methods=["POST"])
@login_required
@permission_required("content", "create")
def testimonial_create():
    user = get_current_admin()
    name = request.form.get("devotee_name", "").strip()
    city = request.form.get("devotee_city", "").strip()
    rating = request.form.get("rating", 5, type=int)
    service = request.form.get("service_or_product", "").strip()
    blessing = request.form.get("blessing_text", "").strip()
    is_video = request.form.get("is_video") == "1" or request.form.get("is_video") == "on"
    video_url = request.form.get("video_url", "").strip() or None
    poster_url = request.form.get("poster_url", "").strip() or None
    badge = request.form.get("badge", "").strip() or None
    duration = request.form.get("duration", "").strip() or None
    sort_order = request.form.get("sort_order", 0, type=int)
    is_approved = request.form.get("is_approved", "1") in ["1", "on", "true", "True"]

    if not name or not blessing:
        flash("Devotee name and blessing text are required.", "danger")
        return redirect(url_for("content.testimonials_list"))

    t = Testimonial(
        devotee_name=name,
        devotee_city=city,
        rating=rating,
        service_or_product=service,
        blessing_text=blessing,
        is_video=is_video or bool(video_url),
        video_url=video_url,
        poster_url=poster_url,
        badge=badge,
        duration=duration,
        sort_order=sort_order,
        is_approved=is_approved,
    )
    db.session.add(t)
    db.session.commit()
    flash("Testimonial added.", "success")
    return redirect(url_for("content.testimonials_list"))


@content_bp.route("/testimonials/<int:testimonial_id>/edit", methods=["POST"])
@login_required
@permission_required("content", "edit")
def testimonial_update(testimonial_id):
    user = get_current_admin()
    t = Testimonial.query.get_or_404(testimonial_id)
    t.devotee_name = request.form.get("devotee_name", t.devotee_name).strip()
    t.devotee_city = request.form.get("devotee_city", t.devotee_city).strip()
    t.rating = request.form.get("rating", t.rating, type=int)
    t.service_or_product = request.form.get("service_or_product", t.service_or_product).strip()
    t.blessing_text = request.form.get("blessing_text", t.blessing_text).strip()
    is_video = request.form.get("is_video") == "1" or request.form.get("is_video") == "on"
    video_url = request.form.get("video_url", "").strip() or None
    t.is_video = is_video or bool(video_url)
    t.video_url = video_url
    t.poster_url = request.form.get("poster_url", "").strip() or None
    t.badge = request.form.get("badge", "").strip() or None
    t.duration = request.form.get("duration", "").strip() or None
    t.sort_order = request.form.get("sort_order", t.sort_order, type=int)
    t.is_approved = request.form.get("is_approved") in ["1", "on", "true", "True"]
    db.session.commit()

    AuditService.log(
        action="TESTIMONIAL_UPDATE",
        module="content",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Testimonial",
        entity_id=str(t.id),
        details={"name": t.devotee_name, "is_approved": t.is_approved, "is_video": t.is_video},
    )
    flash("Testimonial updated.", "success")
    return redirect(url_for("content.testimonials_list"))


@content_bp.route("/testimonials/<int:testimonial_id>/delete", methods=["POST", "DELETE"])
@login_required
@permission_required("content", "delete")
def testimonial_delete(testimonial_id):
    user = get_current_admin()
    t = Testimonial.query.get_or_404(testimonial_id)
    is_json = request.is_json or request.headers.get("Accept") == "application/json" or request.method == "DELETE"
    name = t.devotee_name
    try:
        db.session.delete(t)
        db.session.commit()

        AuditService.log(
            action="TESTIMONIAL_DELETE",
            module="content",
            actor_email=user.email,
            actor_user_id=user.id,
            entity_type="Testimonial",
            entity_id=str(testimonial_id),
            details={"devotee_name": name},
        )
        msg = f"Testimonial from '{name}' deleted."
        if is_json:
            return jsonify({"success": True, "message": msg, "testimonial_id": testimonial_id}), 200
        flash(msg, "success")
    except Exception as e:
        db.session.rollback()
        err_msg = f"Failed to delete testimonial: {str(e)}"
        if is_json:
            return jsonify({"error": err_msg}), 500
        flash(err_msg, "danger")

    return redirect(url_for("content.testimonials_list"))


# -------------------------------------------------------------
# Banners & Hero Announcements
# -------------------------------------------------------------
@content_bp.route("/banners")
@login_required
@permission_required("content", "view")
def banners_list():
    user = get_current_admin()
    banners = Banner.query.order_by(Banner.sort_order.asc(), Banner.created_at.desc()).all()
    return render_template("content/banners.html", current_user=user, banners=banners, active_page="banners")


@content_bp.route("/banners/create", methods=["POST"])
@login_required
@permission_required("content", "create")
def banner_create():
    user = get_current_admin()
    title = request.form.get("title", "").strip()
    subtitle = request.form.get("subtitle", "").strip()
    position = request.form.get("position", "hero").strip()
    image_url = request.form.get("image_url", "").strip()
    link_url = request.form.get("link_url", "#shop").strip()
    button_text = request.form.get("button_text", "Explore Collection →").strip()
    sort_order = request.form.get("sort_order", 0, type=int)

    if not title:
        flash("Banner title is required.", "danger")
        return redirect(url_for("content.banners_list"))

    # Handle image upload if provided
    if "banner_image" in request.files:
        file = request.files["banner_image"]
        if file and file.filename != "":
            orig_name = secure_filename(file.filename)
            ext = orig_name.rsplit(".", 1)[-1].lower() if "." in orig_name else ""
            allowed = current_app.config.get("ALLOWED_IMAGE_EXTENSIONS", {"jpg", "jpeg", "png", "webp", "svg"})
            if ext in allowed:
                prefix = "logo" if position == "logo" else ("bg" if "bg" in position else "banner")
                unique_filename = f"{prefix}_{uuid.uuid4().hex[:8]}_{orig_name}"
                upload_folder = os.path.join(current_app.root_path, "static", "uploads")
                os.makedirs(upload_folder, exist_ok=True)
                save_path = os.path.join(upload_folder, unique_filename)
                file.save(save_path)
                image_url = f"/static/uploads/{unique_filename}"

    banner = Banner(
        title=title,
        subtitle=subtitle,
        position=position,
        image_url=image_url or None,
        link_url=link_url,
        button_text=button_text,
        sort_order=sort_order,
        is_active=True,
    )
    db.session.add(banner)
    db.session.commit()

    AuditService.log(
        action="BANNER_CREATE",
        module="content",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Banner",
        entity_id=str(banner.id),
        details={"title": title, "position": position},
    )
    flash(f"Asset / Banner '{title}' created successfully.", "success")
    return redirect(url_for("content.banners_list"))


@content_bp.route("/banners/<int:banner_id>/edit", methods=["POST"])
@login_required
@permission_required("content", "edit")
def banner_update(banner_id):
    user = get_current_admin()
    banner = Banner.query.get_or_404(banner_id)

    if request.form.get("title"):
        banner.title = request.form.get("title").strip()
    if request.form.get("subtitle") is not None:
        banner.subtitle = request.form.get("subtitle").strip() or None
    if request.form.get("position"):
        banner.position = request.form.get("position").strip()

    # Handle image file upload or direct URL
    if "banner_image" in request.files:
        file = request.files["banner_image"]
        if file and file.filename != "":
            orig_name = secure_filename(file.filename)
            ext = orig_name.rsplit(".", 1)[-1].lower() if "." in orig_name else ""
            allowed = current_app.config.get("ALLOWED_IMAGE_EXTENSIONS", {"jpg", "jpeg", "png", "webp", "svg"})
            if ext in allowed:
                prefix = "logo" if banner.position == "logo" else ("bg" if "bg" in banner.position else "banner")
                unique_filename = f"{prefix}_{uuid.uuid4().hex[:8]}_{orig_name}"
                upload_folder = os.path.join(current_app.root_path, "static", "uploads")
                os.makedirs(upload_folder, exist_ok=True)
                save_path = os.path.join(upload_folder, unique_filename)
                file.save(save_path)
                banner.image_url = f"/static/uploads/{unique_filename}"
    elif request.form.get("image_url") is not None:
        banner.image_url = request.form.get("image_url").strip() or None

    if request.form.get("link_url") is not None:
        banner.link_url = request.form.get("link_url").strip() or "#shop"
    if request.form.get("button_text") is not None:
        banner.button_text = request.form.get("button_text").strip() or "Explore"
    if request.form.get("sort_order") is not None:
        banner.sort_order = request.form.get("sort_order", banner.sort_order, type=int)
    banner.is_active = request.form.get("is_active") == "1" or request.form.get("is_active") == "on"

    db.session.commit()

    AuditService.log(
        action="BANNER_UPDATE",
        module="content",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="Banner",
        entity_id=str(banner.id),
        details={"title": banner.title, "is_active": banner.is_active},
    )
    flash("Banner updated successfully.", "success")
    return redirect(url_for("content.banners_list"))


@content_bp.route("/banners/<int:banner_id>/delete", methods=["POST", "DELETE"])
@login_required
@permission_required("content", "delete")
def banner_delete(banner_id):
    user = get_current_admin()
    banner = Banner.query.get_or_404(banner_id)
    is_json = request.is_json or request.headers.get("Accept") == "application/json" or request.method == "DELETE"
    title = banner.title
    try:
        db.session.delete(banner)
        db.session.commit()

        AuditService.log(
            action="BANNER_DELETE",
            module="content",
            actor_email=user.email,
            actor_user_id=user.id,
            entity_type="Banner",
            entity_id=str(banner_id),
            details={"title": title},
        )
        msg = f"Banner '{title}' deleted."
        if is_json:
            return jsonify({"success": True, "message": msg, "banner_id": banner_id}), 200
        flash(msg, "success")
    except Exception as e:
        db.session.rollback()
        err_msg = f"Failed to delete banner: {str(e)}"
        if is_json:
            return jsonify({"error": err_msg}), 500
        flash(err_msg, "danger")

    return redirect(url_for("content.banners_list"))



# -------------------------------------------------------------
# Guruji Profile
# -------------------------------------------------------------
@content_bp.route("/guruji", methods=["GET", "POST"])
@login_required
@permission_required("content", "view")
def guruji_profile():
    user = get_current_admin()
    profile = GurujiProfile.query.first()
    if not profile:
        profile = GurujiProfile(
            full_title="Param Pujya Swami Dayanand Saraswati Ji",
            spiritual_lineage="Advaita Vedanta & Rig Vedic Tradition",
            bio="Guiding millions across the globe in spiritual wisdom, sacred Vedic pujas, and astrological alignment for peace and prosperity.",
            darshan_timings="Tuesday & Saturday: 09:00 AM - 12:30 PM",
            ashram_address="Shanti Dham Ashram, Rishikesh, Uttarakhand",
            contact_phone="+91 98765 43210",
            contact_email="seva@spiritualcommerce.org",
        )
        db.session.add(profile)
        db.session.commit()

    if request.method == "POST":
        if not user.has_permission("content", "edit") and not (user.role and user.role.code == "super_admin"):
            abort(403)
        profile.full_title = request.form.get("full_title", profile.full_title).strip()
        profile.spiritual_lineage = request.form.get("spiritual_lineage", profile.spiritual_lineage or "").strip()
        profile.bio = request.form.get("bio", profile.bio).strip()
        profile.secondary_bio = request.form.get("secondary_bio", profile.secondary_bio or "").strip()
        profile.experience_years = request.form.get("experience_years", profile.experience_years or "25+").strip()
        profile.consultations_count = request.form.get("consultations_count", profile.consultations_count or "10K+").strip()
        profile.pujas_count = request.form.get("pujas_count", profile.pujas_count or "5000+").strip()
        profile.button_text = request.form.get("button_text", profile.button_text or "Book Consultation →").strip()
        profile.button_url = request.form.get("button_url", profile.button_url or "#jyotish").strip()
        profile.darshan_timings = request.form.get("darshan_timings", profile.darshan_timings or "").strip()
        profile.ashram_address = request.form.get("ashram_address", profile.ashram_address or "").strip()
        profile.contact_phone = request.form.get("contact_phone", profile.contact_phone or "").strip()
        profile.contact_email = request.form.get("contact_email", profile.contact_email or "").strip()

        # Handle Profile Image: File upload takes precedence, then image URL
        if "profile_photo" in request.files:
            file = request.files["profile_photo"]
            if file and file.filename != "":
                orig_name = secure_filename(file.filename)
                ext = orig_name.rsplit(".", 1)[-1].lower() if "." in orig_name else ""
                allowed = current_app.config.get("ALLOWED_IMAGE_EXTENSIONS", {"jpg", "jpeg", "png", "webp", "svg"})
                if ext in allowed:
                    unique_filename = f"guruji_{uuid.uuid4().hex[:8]}_{orig_name}"
                    upload_folder = os.path.join(current_app.root_path, "static", "uploads")
                    os.makedirs(upload_folder, exist_ok=True)
                    save_path = os.path.join(upload_folder, unique_filename)
                    file.save(save_path)
                    profile.profile_image = f"/static/uploads/{unique_filename}"
        
        img_url = request.form.get("profile_image", "").strip()
        if img_url and ("profile_photo" not in request.files or not request.files["profile_photo"].filename):
            profile.profile_image = img_url

        # Visibility settings map & custom labels
        def is_on(key):
            return request.form.get(key) in ("1", "true", "on")

        existing_vis = profile.visibility_settings or {}
        visibility = {
            **existing_vis,
            "show_photo": is_on("show_photo"),
            "show_lineage": is_on("show_lineage"),
            "show_bio": is_on("show_bio"),
            "show_secondary_bio": is_on("show_secondary_bio"),
            "show_stats": is_on("show_stats"),
            "show_experience": is_on("show_experience"),
            "show_consultations": is_on("show_consultations"),
            "show_pujas": is_on("show_pujas"),
            "show_cta_button": is_on("show_cta_button"),
            "show_darshan": is_on("show_darshan"),
            "show_ashram": is_on("show_ashram"),
            "show_contact": is_on("show_contact"),
            "section_kicker": request.form.get("section_kicker", existing_vis.get("section_kicker", "About Guruji")).strip(),
            "experience_label": request.form.get("experience_label", existing_vis.get("experience_label", "Years Experience")).strip(),
            "consultations_label": request.form.get("consultations_label", existing_vis.get("consultations_label", "Consultations")).strip(),
            "pujas_label": request.form.get("pujas_label", existing_vis.get("pujas_label", "Pujas Performed")).strip(),
            "darshan_label": request.form.get("darshan_label", existing_vis.get("darshan_label", "Meeting Time:")).strip(),
            "address_label": request.form.get("address_label", existing_vis.get("address_label", "Address:")).strip(),
            "contact_label": request.form.get("contact_label", existing_vis.get("contact_label", "Contact:")).strip(),
            "email_label": request.form.get("email_label", existing_vis.get("email_label", "Email:")).strip(),
        }
        profile.visibility_settings = visibility

        db.session.commit()

        AuditService.log(
            action="GURUJI_PROFILE_UPDATE",
            module="content",
            actor_email=user.email,
            actor_user_id=user.id,
            entity_type="GurujiProfile",
            entity_id=str(profile.id),
        )
        flash("Guruji's profile and display visibility updated successfully.", "success")

    return render_template("content/guruji.html", current_user=user, profile=profile, active_page="guruji")


# -------------------------------------------------------------
# Media Library
# -------------------------------------------------------------
@content_bp.route("/media")
@login_required
@permission_required("media", "view")
def media_list():
    user = get_current_admin()
    media_files = MediaFile.query.order_by(MediaFile.created_at.desc()).all()
    return render_template("content/media.html", current_user=user, media_files=media_files, active_page="media")


@content_bp.route("/media/upload", methods=["POST"])
@login_required
@permission_required("media", "upload")
def media_upload():
    user = get_current_admin()
    if "file" not in request.files:
        flash("No file part in the request.", "danger")
        return redirect(url_for("content.media_list"))

    file = request.files["file"]
    if file.filename == "":
        flash("No file selected.", "danger")
        return redirect(url_for("content.media_list"))

    orig_name = secure_filename(file.filename)
    ext = orig_name.rsplit(".", 1)[-1].lower() if "." in orig_name else ""
    allowed = current_app.config.get("ALLOWED_IMAGE_EXTENSIONS", {"jpg", "jpeg", "png", "webp", "svg", "pdf"})

    if ext not in allowed:
        flash(f"File type '.{ext}' is not permitted.", "danger")
        return redirect(url_for("content.media_list"))

    unique_filename = f"{uuid.uuid4().hex[:12]}_{orig_name}"
    upload_folder = current_app.config.get("UPLOAD_FOLDER")
    os.makedirs(upload_folder, exist_ok=True)
    save_path = os.path.join(upload_folder, unique_filename)
    file.save(save_path)

    size = os.path.getsize(save_path)
    media = MediaFile(
        filename=unique_filename,
        original_name=orig_name,
        file_path=f"/static/uploads/{unique_filename}",
        file_size=size,
        mime_type=file.mimetype or "image/jpeg",
        uploaded_by_id=user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(media)
    db.session.commit()

    AuditService.log(
        action="MEDIA_UPLOAD",
        module="content",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="MediaFile",
        entity_id=str(media.id),
        details={"filename": unique_filename, "size": size},
    )
    flash("Asset uploaded successfully.", "success")
    return redirect(url_for("content.media_list"))


# -------------------------------------------------------------
# Welcome Offer Popup (Editable Layout, Image, Offer & Scheduling)
# -------------------------------------------------------------
@content_bp.route("/welcome-popup", methods=["GET"])
@login_required
@permission_required("content", "view")
def welcome_popup_page():
    user = get_current_admin()
    published = WelcomePopupSetting.query.filter_by(status="published").first()
    draft = WelcomePopupSetting.query.filter_by(status="draft").first()

    # Ensure baseline settings exist
    if not published:
        published = WelcomePopupSetting(
            status="published",
            campaign_id="camp_1",
            is_enabled=True,
            heading="Your Cosmic Welcome",
            description="Enjoy a special offer on your first order.",
            offer_highlight="10% OFF",
            coupon_code="WELCOME10",
            button_label="Claim My Offer",
            button_action="claim_coupon",
            target_url="",
            terms="*Valid on eligible items on your first order. Cannot be combined with other offers. Discount verified and calculated on the server at checkout.",
            image_url="/hero/hero-astrology.jpg",
            image_alt="Cosmic Astrology Welcome Offer",
            image_position="center",
            delay_seconds=5,
        )
        db.session.add(published)
        db.session.commit()

    if not draft:
        draft = WelcomePopupSetting(
            status="draft",
            campaign_id=published.campaign_id,
            is_enabled=published.is_enabled,
            heading=published.heading,
            description=published.description,
            offer_highlight=published.offer_highlight,
            coupon_code=published.coupon_code,
            button_label=published.button_label,
            button_action=published.button_action,
            target_url=published.target_url,
            terms=published.terms,
            image_url=published.image_url,
            image_alt=published.image_alt,
            image_position=published.image_position,
            delay_seconds=published.delay_seconds,
            start_date=published.start_date,
            end_date=published.end_date,
        )
        db.session.add(draft)
        db.session.commit()

    active_coupons = Coupon.query.order_by(Coupon.is_active.desc(), Coupon.code.asc()).all()

    # Format dates for IST local input
    ist_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
    start_str = ""
    if draft.start_date:
        dt = draft.start_date if draft.start_date.tzinfo else draft.start_date.replace(tzinfo=timezone.utc)
        start_str = dt.astimezone(ist_tz).strftime("%Y-%m-%dT%H:%M")

    end_str = ""
    if draft.end_date:
        dt = draft.end_date if draft.end_date.tzinfo else draft.end_date.replace(tzinfo=timezone.utc)
        end_str = dt.astimezone(ist_tz).strftime("%Y-%m-%dT%H:%M")

    return render_template(
        "content/welcome_popup.html",
        current_user=user,
        published=published,
        draft=draft,
        coupons=active_coupons,
        start_date_str=start_str,
        end_date_str=end_str,
        active_page="welcome_popup",
    )


@content_bp.route("/welcome-popup/save", methods=["POST"])
@login_required
@permission_required("content", "edit")
def welcome_popup_save():
    user = get_current_admin()
    action = request.form.get("form_action", "save_draft")

    published = WelcomePopupSetting.query.filter_by(status="published").first()
    draft = WelcomePopupSetting.query.filter_by(status="draft").first()
    if not draft:
        draft = WelcomePopupSetting(status="draft")
        db.session.add(draft)
    if not published:
        published = WelcomePopupSetting(status="published")
        db.session.add(published)

    # 1. Action: New Campaign
    if action == "new_campaign":
        new_camp = f"camp_{int(datetime.now(timezone.utc).timestamp())}"
        draft.campaign_id = new_camp
        published.campaign_id = new_camp
        db.session.commit()

        AuditService.log(
            action="WELCOME_POPUP_NEW_CAMPAIGN",
            module="content",
            actor_email=user.email,
            actor_user_id=user.id,
            entity_type="WelcomePopupSetting",
            entity_id=str(published.id),
            details={"new_campaign_id": new_camp},
        )
        flash(f"New campaign '{new_camp}' initialized! The popup will now show once again per browser.", "success")
        return redirect(url_for("content.welcome_popup_page"))

    # 2. Extract and validate form fields
    heading = request.form.get("heading", "").strip()
    description = request.form.get("description", "").strip()
    offer_highlight = request.form.get("offer_highlight", "").strip()
    coupon_code = request.form.get("coupon_code", "").strip().upper()
    button_label = request.form.get("button_label", "").strip() or "Claim My Offer"
    button_action = request.form.get("button_action", "claim_coupon").strip()
    target_url = request.form.get("target_url", "").strip()
    terms = request.form.get("terms", "").strip()
    image_alt = request.form.get("image_alt", "").strip() or "Cosmic Astrology Welcome Offer"
    image_position = request.form.get("image_position", "center").strip()
    remove_image = request.form.get("remove_image") == "1"

    try:
        delay_seconds = max(1, min(60, int(request.form.get("delay_seconds", 5))))
    except (ValueError, TypeError):
        delay_seconds = 5

    is_enabled = request.form.get("is_enabled") in ("1", "on", "true")

    # Image upload handling
    image_url = draft.image_url
    if remove_image:
        image_url = ""
    elif "banner_image" in request.files:
        file = request.files["banner_image"]
        if file and file.filename != "":
            orig_name = secure_filename(file.filename)
            ext = orig_name.rsplit(".", 1)[-1].lower() if "." in orig_name else ""
            allowed = current_app.config.get("ALLOWED_IMAGE_EXTENSIONS", {"jpg", "jpeg", "png", "webp", "svg"})
            if ext not in allowed:
                flash(f"Invalid image format '.{ext}'. Allowed: {', '.join(allowed)}", "danger")
                return redirect(url_for("content.welcome_popup_page"))

            upload_folder = os.path.join(current_app.root_path, "static", "uploads")
            os.makedirs(upload_folder, exist_ok=True)
            unique_filename = f"welcome_{uuid.uuid4().hex[:8]}_{orig_name}"
            save_path = os.path.join(upload_folder, unique_filename)
            file.save(save_path)
            image_url = f"/static/uploads/{unique_filename}"
    elif request.form.get("image_url"):
        image_url = request.form.get("image_url").strip()

    # Timezone parsing for schedule (Asia/Kolkata -> UTC)
    ist_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
    start_dt = None
    end_dt = None
    start_raw = request.form.get("start_date", "").strip()
    end_raw = request.form.get("end_date", "").strip()

    if start_raw:
        try:
            naive_start = datetime.strptime(start_raw, "%Y-%m-%dT%H:%M")
            start_dt = naive_start.replace(tzinfo=ist_tz).astimezone(timezone.utc)
        except Exception:
            flash("Invalid start date format.", "danger")
            return redirect(url_for("content.welcome_popup_page"))

    if end_raw:
        try:
            naive_end = datetime.strptime(end_raw, "%Y-%m-%dT%H:%M")
            end_dt = naive_end.replace(tzinfo=ist_tz).astimezone(timezone.utc)
        except Exception:
            flash("Invalid end date format.", "danger")
            return redirect(url_for("content.welcome_popup_page"))

    if start_dt and end_dt and start_dt > end_dt:
        flash("Start date must be earlier than End date.", "danger")
        return redirect(url_for("content.welcome_popup_page"))

    # If publishing, validate required fields and link targets
    if action == "publish":
        if not heading:
            flash("Heading is required for publishing.", "danger")
            return redirect(url_for("content.welcome_popup_page"))
        if not description:
            flash("Description is required for publishing.", "danger")
            return redirect(url_for("content.welcome_popup_page"))
        if button_action == "open_link" and not target_url:
            flash("Please specify an internal target URL for the button action.", "danger")
            return redirect(url_for("content.welcome_popup_page"))

    # Update draft
    draft.heading = heading
    draft.description = description
    draft.offer_highlight = offer_highlight
    draft.coupon_code = coupon_code
    draft.button_label = button_label
    draft.button_action = button_action
    draft.target_url = target_url
    draft.terms = terms
    draft.image_url = image_url or "/hero/hero-astrology.jpg"
    draft.image_alt = image_alt
    draft.image_position = image_position
    draft.delay_seconds = delay_seconds
    draft.is_enabled = is_enabled
    draft.start_date = start_dt
    draft.end_date = end_dt
    draft.updated_at = datetime.now(timezone.utc)

    # If action is publish, copy to published record
    if action == "publish":
        published.campaign_id = draft.campaign_id
        published.heading = draft.heading
        published.description = draft.description
        published.offer_highlight = draft.offer_highlight
        published.coupon_code = draft.coupon_code
        published.button_label = draft.button_label
        published.button_action = draft.button_action
        published.target_url = draft.target_url
        published.terms = draft.terms
        published.image_url = draft.image_url
        published.image_alt = draft.image_alt
        published.image_position = draft.image_position
        published.delay_seconds = draft.delay_seconds
        published.is_enabled = draft.is_enabled
        published.start_date = draft.start_date
        published.end_date = draft.end_date
        published.updated_at = datetime.now(timezone.utc)

        db.session.commit()
        AuditService.log(
            action="WELCOME_POPUP_PUBLISH",
            module="content",
            actor_email=user.email,
            actor_user_id=user.id,
            entity_type="WelcomePopupSetting",
            entity_id=str(published.id),
            details={"campaign_id": published.campaign_id, "is_enabled": published.is_enabled},
        )
        flash("Welcome Popup published! Changes are now live on the storefront.", "success")
    else:
        db.session.commit()
        flash("Draft saved successfully. The last published version remains active on the storefront.", "info")

    return redirect(url_for("content.welcome_popup_page"))


# -------------------------------------------------------------
# Storefront Sections & Texts
# -------------------------------------------------------------
@content_bp.route("/site-text", methods=["GET", "POST"])
@login_required
@permission_required("content", "view")
def site_text_page():
    from app.services.site_text_service import SiteTextService
    user = get_current_admin()
    
    if request.method == "POST":
        if not user.has_permission("content", "edit") and not (user.role and user.role.code == "super_admin"):
            abort(403)
        
        current_texts = SiteTextService.get_all()
        f = request.form

        # 1. Why Section
        why = current_texts.get("why_section", {})
        why["kicker"] = f.get("why_kicker", why.get("kicker", "Why Choose")).strip()
        why["title"] = f.get("why_title", why.get("title", "Nagesh Swami Guruji?")).strip()
        why["subtitle"] = f.get("why_subtitle", why.get("subtitle", "Three Generations of Tradition")).strip()
        reasons = []
        for i in range(1, 7):
            reasons.append({
                "num": f.get(f"why_num_{i}", f"0{i}").strip(),
                "title": f.get(f"why_title_{i}", "").strip(),
                "desc": f.get(f"why_desc_{i}", "").strip(),
            })
        why["reasons"] = reasons
        current_texts["why_section"] = why

        # 2. Jyotish Section
        jyotish = current_texts.get("jyotish_section", {})
        jyotish["kicker"] = f.get("jyotish_kicker", jyotish.get("kicker", "Jyotish Consultation")).strip()
        jyotish["title"] = f.get("jyotish_title", jyotish.get("title", "Kundali & Astrology")).strip()
        jyotish["subtitle"] = f.get("jyotish_subtitle", jyotish.get("subtitle", "Personalised Jyotish Guidance by Nagesh Swami Guruji")).strip()
        jyotish["wa_button_text"] = f.get("jyotish_wa_text", jyotish.get("wa_button_text", "📲 WhatsApp गुरुजी")).strip()
        jyotish["wa_link"] = f.get("jyotish_wa_link", jyotish.get("wa_link", "https://wa.me/919000000000")).strip()
        jyotish["form_title"] = f.get("jyotish_form_title", jyotish.get("form_title", "Book Your Consultation")).strip()
        jyotish["form_sub"] = f.get("jyotish_form_sub", jyotish.get("form_sub", "कृपया खालील माहिती भरा — आम्ही 24 तासांत संपर्क करू.")).strip()
        jyotish["form_note"] = f.get("jyotish_form_note", jyotish.get("form_note", "🔒 तुमची माहिती सुरक्षित आहे. Payment consultation confirm झाल्यावर.")).strip()
        current_texts["jyotish_section"] = jyotish

        # 3. Puja Section
        puja = current_texts.get("puja_section", {})
        puja["kicker"] = f.get("puja_kicker", puja.get("kicker", "Puja Services")).strip()
        puja["title"] = f.get("puja_title", puja.get("title", "Traditional Puja Services")).strip()
        puja["subtitle"] = f.get("puja_subtitle", puja.get("subtitle", "")).strip()
        puja["button_text"] = f.get("puja_btn_text", puja.get("button_text", "Book a Puja →")).strip()
        current_texts["puja_section"] = puja

        # 4. Hero Secondary Button
        hero = current_texts.get("hero_section", {})
        hero["secondary_button_text"] = f.get("hero_sec_btn_text", hero.get("secondary_button_text", "Book Consultation")).strip()
        hero["secondary_button_url"] = f.get("hero_sec_btn_url", hero.get("secondary_button_url", "#jyotish")).strip()
        current_texts["hero_section"] = hero

        # 5. Category Section
        cat = current_texts.get("category_section", {})
        cat["kicker"] = f.get("cat_kicker", cat.get("kicker", "Shop by Category")).strip()
        cat["title"] = f.get("cat_title", cat.get("title", "The Right Choice for You")).strip()
        cat["subtitle"] = f.get("cat_subtitle", cat.get("subtitle", "")).strip()
        cat["btn_text"] = f.get("cat_btn_text", cat.get("btn_text", "View All")).strip()
        cat["collapse_text"] = f.get("cat_collapse_text", cat.get("collapse_text", "Show 4 Even Cards")).strip()
        current_texts["category_section"] = cat

        # 6. Featured Section
        feat = current_texts.get("featured_section", {})
        feat["kicker"] = f.get("feat_kicker", feat.get("kicker", "Featured")).strip()
        feat["title"] = f.get("feat_title", feat.get("title", "Our Sacred Collection")).strip()
        feat["subtitle"] = f.get("feat_subtitle", feat.get("subtitle", "")).strip()
        current_texts["featured_section"] = feat

        # 7. Rudraksha Section
        rud = current_texts.get("rudraksha_section", {})
        rud["kicker"] = f.get("rud_kicker", rud.get("kicker", "Rudraksha")).strip()
        rud["title"] = f.get("rud_title", rud.get("title", "रुद्राक्ष Collection")).strip()
        rud["subtitle"] = f.get("rud_subtitle", rud.get("subtitle", "")).strip()
        current_texts["rudraksha_section"] = rud

        # 8. Ratna Section
        ratna = current_texts.get("ratna_section", {})
        ratna["kicker"] = f.get("ratna_kicker", ratna.get("kicker", "Ratna")).strip()
        ratna["title"] = f.get("ratna_title", ratna.get("title", "Choose Your Gemstone With Guidance")).strip()
        ratna["subtitle"] = f.get("ratna_subtitle", ratna.get("subtitle", "")).strip()
        ratna["consultation_cta"] = f.get("ratna_cta", ratna.get("consultation_cta", "Not sure which gemstone is right for you? · Get Gemstone Consultation →")).strip()
        current_texts["ratna_section"] = ratna

        # 9. Yantra Section
        yantra = current_texts.get("yantra_section", {})
        yantra["kicker"] = f.get("yantra_kicker", yantra.get("kicker", "Yantra")).strip()
        yantra["title"] = f.get("yantra_title", yantra.get("title", "Sacred Yantra Collection")).strip()
        yantra["subtitle"] = f.get("yantra_subtitle", yantra.get("subtitle", "")).strip()
        current_texts["yantra_section"] = yantra

        # 10. Bracelets Section
        bra = current_texts.get("bracelets_section", {})
        bra["kicker"] = f.get("bra_kicker", bra.get("kicker", "Bracelets")).strip()
        bra["title"] = f.get("bra_title", bra.get("title", "Spiritual Bracelets")).strip()
        bra["subtitle"] = f.get("bra_subtitle", bra.get("subtitle", "")).strip()
        current_texts["bracelets_section"] = bra

        # 11. Puja Samagri Section
        sam = current_texts.get("puja_samagri_section", {})
        sam["kicker"] = f.get("sam_kicker", sam.get("kicker", "Puja Samagri")).strip()
        sam["title"] = f.get("sam_title", sam.get("title", "Sacred Puja Samagri Collection")).strip()
        sam["subtitle"] = f.get("sam_subtitle", sam.get("subtitle", "")).strip()
        current_texts["puja_samagri_section"] = sam

        # 12. Special Collections
        spc = current_texts.get("special_collections_section", {})
        spc["kicker"] = f.get("spc_kicker", spc.get("kicker", "Special Collections")).strip()
        spc["title"] = f.get("spc_title", spc.get("title", "Sacred Special Collections")).strip()
        spc["subtitle"] = f.get("spc_subtitle", spc.get("subtitle", "")).strip()
        current_texts["special_collections_section"] = spc

        # 13. Video Section
        vid = current_texts.get("video_section", {})
        vid["kicker"] = f.get("vid_kicker", vid.get("kicker", "Video Experience")).strip()
        vid["video_url"] = f.get("vid_url", vid.get("video_url", "/videos/guruji-video.mp4")).strip()
        current_texts["video_section"] = vid

        # 14. Testimonials Section
        testi = current_texts.get("testimonials_section", {})
        testi["kicker"] = f.get("testi_kicker", testi.get("kicker", "Testimonials")).strip()
        testi["title"] = f.get("testi_title", testi.get("title", "What Our Clients Say")).strip()
        testi["subtitle"] = f.get("testi_subtitle", testi.get("subtitle", "")).strip()
        testi["video_pill"] = f.get("testi_video_pill", testi.get("video_pill", "थेट व्हिडिओ अनुभव (Authentic Video Experiences)")).strip()
        testi["video_hint"] = f.get("testi_video_hint", testi.get("video_hint", "व्हिडिओ पाहण्यासाठी कार्डवर टॅप करा")).strip()
        testi["written_pill"] = f.get("testi_written_pill", testi.get("written_pill", "प्रमाणित भाविकांचे अभिप्राय (Verified Client Reviews)")).strip()
        current_texts["testimonials_section"] = testi

        # 15. Blog Section
        blog = current_texts.get("blog_section", {})
        blog["kicker"] = f.get("blog_kicker", blog.get("kicker", "Knowledge Centre")).strip()
        blog["title"] = f.get("blog_title", blog.get("title", "Blog & Learn")).strip()
        blog["subtitle"] = f.get("blog_subtitle", blog.get("subtitle", "")).strip()
        current_texts["blog_section"] = blog

        # 16. Footer Section
        foot = current_texts.get("footer_section", {})
        foot["brand_desc"] = f.get("foot_brand_desc", foot.get("brand_desc", "")).strip()
        foot["shloka"] = f.get("foot_shloka", foot.get("shloka", "॥ सर्वे भवन्तु सुखिनः ॥")).strip()
        foot["phone"] = f.get("foot_phone", foot.get("phone", "+91 90000 00000")).strip()
        foot["email"] = f.get("foot_email", foot.get("email", "seva@astroveda.in")).strip()
        foot["whatsapp_url"] = f.get("foot_wa_url", foot.get("whatsapp_url", "https://wa.me/919000000000")).strip()
        current_texts["footer_section"] = foot

        SiteTextService.save_all(current_texts)

        AuditService.log(
            action="SITE_TEXT_UPDATE",
            module="content",
            actor_email=user.email,
            actor_user_id=user.id,
            entity_type="SystemSetting",
            entity_id="storefront_texts",
        )
        flash("Storefront website texts and headings updated successfully!", "success")

    texts = SiteTextService.get_all()
    return render_template("content/site_text.html", current_user=user, texts=texts, active_page="site_text")


# -------------------------------------------------------------
# Ads & Ad Banners (Google AdSense, Meta Ads, Custom Embeds)
# -------------------------------------------------------------
@content_bp.route("/ads")
@login_required
@permission_required("content", "view")
def ads_list():
    user = get_current_admin()
    ads = AdBanner.query.order_by(AdBanner.sort_order.asc(), AdBanner.created_at.desc()).all()
    return render_template("content/ads.html", current_user=user, ads=ads, active_page="ads")


@content_bp.route("/ads/create", methods=["POST"])
@login_required
@permission_required("content", "create")
def ad_create():
    user = get_current_admin()
    title = request.form.get("title", "").strip()
    platform = request.form.get("platform", "google").strip().lower()
    ad_code = request.form.get("ad_code", "").strip()
    client_id = request.form.get("client_id", "").strip()
    slot_id = request.form.get("slot_id", "").strip()
    image_url = request.form.get("image_url", "").strip()
    target_url = request.form.get("target_url", "").strip()
    headline = request.form.get("headline", "").strip()
    description = request.form.get("description", "").strip()
    button_text = request.form.get("button_text", "Learn More").strip() or "Learn More"
    position = request.form.get("position", "home_mid").strip()
    sort_order = int(request.form.get("sort_order", 0) or 0)
    is_active = request.form.get("is_active") in ("1", "true", "on", "True", True)

    if not title:
        flash("Ad Banner title is required.", "danger")
        return redirect(url_for("content.ads_list"))

    # File upload handling if image banner
    img_file = request.files.get("image_file")
    if img_file and img_file.filename != "":
        orig_name = secure_filename(img_file.filename)
        ext = orig_name.rsplit(".", 1)[-1].lower() if "." in orig_name else ""
        allowed = current_app.config.get("ALLOWED_IMAGE_EXTENSIONS", {"jpg", "jpeg", "png", "webp", "svg", "gif"})
        if ext in allowed:
            unique_filename = f"ad_{uuid.uuid4().hex[:8]}_{orig_name}"
            upload_folder = os.path.join(current_app.root_path, "static", "uploads")
            os.makedirs(upload_folder, exist_ok=True)
            img_file.save(os.path.join(upload_folder, unique_filename))
            image_url = f"/static/uploads/{unique_filename}"

    ad = AdBanner(
        title=title,
        platform=platform,
        ad_code=ad_code,
        client_id=client_id,
        slot_id=slot_id,
        image_url=image_url,
        target_url=target_url,
        headline=headline,
        description=description,
        button_text=button_text,
        position=position,
        sort_order=sort_order,
        is_active=is_active,
    )
    db.session.add(ad)
    db.session.commit()

    AuditService.log(
        action="AD_BANNER_CREATE",
        module="content",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="AdBanner",
        entity_id=str(ad.id),
        details={"title": title, "platform": platform, "is_active": is_active},
    )
    flash(f"Ad unit '{title}' created successfully.", "success")
    return redirect(url_for("content.ads_list"))


@content_bp.route("/ads/<int:ad_id>/edit", methods=["POST"])
@login_required
@permission_required("content", "edit")
def ad_edit(ad_id):
    user = get_current_admin()
    ad = AdBanner.query.get_or_404(ad_id)

    title = request.form.get("title", "").strip()
    if not title:
        flash("Ad Banner title is required.", "danger")
        return redirect(url_for("content.ads_list"))

    ad.title = title
    ad.platform = request.form.get("platform", ad.platform).strip().lower()
    ad.ad_code = request.form.get("ad_code", "").strip()
    ad.client_id = request.form.get("client_id", "").strip()
    ad.slot_id = request.form.get("slot_id", "").strip()
    ad.target_url = request.form.get("target_url", "").strip()
    ad.headline = request.form.get("headline", "").strip()
    ad.description = request.form.get("description", "").strip()
    ad.button_text = request.form.get("button_text", "Learn More").strip() or "Learn More"
    ad.position = request.form.get("position", "home_mid").strip()
    ad.sort_order = int(request.form.get("sort_order", ad.sort_order) or 0)
    ad.is_active = request.form.get("is_active") in ("1", "true", "on", "True", True)

    img_url = request.form.get("image_url", "").strip()
    if img_url:
        ad.image_url = img_url

    img_file = request.files.get("image_file")
    if img_file and img_file.filename != "":
        orig_name = secure_filename(img_file.filename)
        ext = orig_name.rsplit(".", 1)[-1].lower() if "." in orig_name else ""
        allowed = current_app.config.get("ALLOWED_IMAGE_EXTENSIONS", {"jpg", "jpeg", "png", "webp", "svg", "gif"})
        if ext in allowed:
            unique_filename = f"ad_{uuid.uuid4().hex[:8]}_{orig_name}"
            upload_folder = os.path.join(current_app.root_path, "static", "uploads")
            os.makedirs(upload_folder, exist_ok=True)
            img_file.save(os.path.join(upload_folder, unique_filename))
            ad.image_url = f"/static/uploads/{unique_filename}"

    db.session.commit()

    AuditService.log(
        action="AD_BANNER_EDIT",
        module="content",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="AdBanner",
        entity_id=str(ad.id),
        details={"title": title, "platform": ad.platform, "is_active": ad.is_active},
    )
    flash(f"Ad unit '{title}' updated successfully.", "success")
    return redirect(url_for("content.ads_list"))


@content_bp.route("/ads/<int:ad_id>/toggle", methods=["POST"])
@login_required
@permission_required("content", "edit")
def ad_toggle(ad_id):
    user = get_current_admin()
    ad = AdBanner.query.get_or_404(ad_id)
    ad.is_active = not ad.is_active
    db.session.commit()

    state_str = "activated" if ad.is_active else "deactivated"
    AuditService.log(
        action="AD_BANNER_TOGGLE",
        module="content",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="AdBanner",
        entity_id=str(ad.id),
        details={"title": ad.title, "new_active_state": ad.is_active},
    )
    flash(f"Ad unit '{ad.title}' has been {state_str}.", "success")
    return redirect(url_for("content.ads_list"))


@content_bp.route("/ads/<int:ad_id>/delete", methods=["POST"])
@login_required
@permission_required("content", "delete")
def ad_delete(ad_id):
    user = get_current_admin()
    ad = AdBanner.query.get_or_404(ad_id)
    title = ad.title
    db.session.delete(ad)
    db.session.commit()

    AuditService.log(
        action="AD_BANNER_DELETE",
        module="content",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="AdBanner",
        entity_id=str(ad_id),
        details={"title": title},
    )
    flash(f"Ad unit '{title}' deleted.", "success")
    return redirect(url_for("content.ads_list"))


# -------------------------------------------------------------
# Homepage Sections Drag & Drop Layout Manager
# -------------------------------------------------------------
@content_bp.route("/sections")
@login_required
@permission_required("content", "view")
def sections_manager():
    user = get_current_admin()
    sections = SectionService.get_sections()
    return render_template("content/sections.html", current_user=user, sections=sections, active_page="sections")


@content_bp.route("/sections/reorder", methods=["POST"])
@login_required
@permission_required("content", "edit")
def sections_reorder():
    user = get_current_admin()
    data = request.get_json(silent=True)
    if data and "sections" in data:
        ordered_list = data["sections"]
    else:
        order_str = request.form.get("section_order", "")
        keys = [k.strip() for k in order_str.split(",") if k.strip()]
        ordered_list = []
        for k in keys:
            enabled = request.form.get(f"section_{k}_enabled") in ("1", "true", "on", "True", True)
            ordered_list.append({"key": k, "enabled": enabled})

    saved = SectionService.save_sections(ordered_list)
    AuditService.log(
        action="HOMEPAGE_SECTIONS_REORDER",
        module="content",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="SystemSetting",
        entity_id="homepage_sections_order",
        details={"sections_count": len(saved)},
    )
    if request.is_json:
        return jsonify({"success": True, "message": "Homepage sections order updated successfully."})

    flash("Homepage sections order and visibility updated successfully!", "success")
    return redirect(url_for("content.sections_manager"))


@content_bp.route("/sections/reset", methods=["POST"])
@login_required
@permission_required("content", "edit")
def sections_reset():
    user = get_current_admin()
    SectionService.reset_sections()
    AuditService.log(
        action="HOMEPAGE_SECTIONS_RESET",
        module="content",
        actor_email=user.email,
        actor_user_id=user.id,
        entity_type="SystemSetting",
        entity_id="homepage_sections_order",
        details={"action": "reset_to_default"},
    )
    flash("Homepage sections order reset to canonical defaults.", "success")
    return redirect(url_for("content.sections_manager"))




