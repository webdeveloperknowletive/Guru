# 🪔 Spiritual Commerce & Services Backend API & Admin Panel
### *Seva · Sanskriti · Samṛddhi*

A production-grade, responsive, and secure backend and administrative control panel built with **Flask**, **PostgreSQL**, **Redis**, and modern vanilla CSS. Powers the external customer storefront via **REST API v1** and provides a full-featured back-office management panel for **Ratna, Rudraksha, Yantra, Spiritual Bracelets, Puja Samagri**, and **Vedic Puja & Jyotish Consultation bookings**.

Designed for deployment on a **Hostinger VPS** managed through **Coolify**.

---

## 1. System Architecture

```
                                  +-----------------------------+
                                  |   Devotees & Web Clients    |
                                  |    (Desktop, Tablet, iOS)   |
                                  +--------------+--------------+
                                                 | HTTPS / TLS 1.3
                                                 v
                                  +-----------------------------+
                                  | Hostinger VPS / Coolify     |
                                  | Traefik Ingress (Let's Enc) |
                                  +--------------+--------------+
                                                 | Internal Docker Network
                                                 v
                                  +-----------------------------+
                                  |   Gunicorn WSGI Server      |
                                  |   (3 Workers, 2 Threads)    |
                                  +--------------+--------------+
                                                 |
            +------------------------------------+------------------------------------+
            |                                    |                                    |
            v                                    v                                    v
+------------------------+           +------------------------+           +------------------------+
| Flask App Factory      |           | Service Layer          |           | Background Worker      |
| Blueprints:            | <=======> | - auth_service.py      | <=======> | worker.py              |
| - auth                 |           | - rbac_service.py      |           | - Notifications (Mail) |
| - dashboard (overview) |           | - commerce_service.py  |           | - WebP Thumbnailing    |
| - commerce             |           | - booking_service.py   |           | - Large CSV Exports    |
| - services             |           | - rate_limit_service.py|           +-----------+------------+
| - content              |           | - report_service.py    |                       |
| - operations           |           +-----------+------------+                       |
| - system               |                       |                                    |
| - api/v1 & health      |                       |                                    |
+------------------------+                       v                                    v
                                     +------------------------+           +------------------------+
                                     | PostgreSQL 16 Alpine   |           | Redis 7 Alpine         |
                                     | (SQLAlchemy 2.0 ORM    |           | - Login Rate Limiting  |
                                     |  Row Locking, Decimal) |           | - Token Revocation     |
                                     | Volume: postgres_data  |           | - Task Queue (LPUSH)   |
                                     +------------------------+           +------------------------+
```

---

## 2. Database Schema & Entities

- **Security & RBAC**:
  - `AdminUser`: `id`, `uuid`, `email`, `password_hash`, `full_name`, `avatar_url`, `role_id`, `is_active`, `failed_login_attempts`, `locked_until`, `last_login_at`, `session_token`.
  - `Role`: `id`, `name`, `code` (`super_admin`, `commerce_manager`, `services_manager`, `content_editor`, `support`, `read_only`), `description`.
  - `RolePermission`: `id`, `role_id`, `module`, `action`.
  - `AuditLog`: `id`, `actor_user_id`, `actor_email`, `action`, `module`, `entity_type`, `entity_id`, `details` (JSON), `ip_address`, `created_at`.
- **Spiritual E-Commerce**:
  - `Category`: `id`, `name`, `slug`, `description`, `icon`, `is_active`, `sort_order`.
  - `Product`: `id`, `category_id`, `name`, `slug`, `sku`, `price` (Fixed-precision `Numeric(12, 2)`), `compare_price`, `stock_quantity`, `low_stock_threshold`, `certification_status`, `publishing_status`, `thumbnail`, `images` (JSON), `attributes` (JSON for mukhi, origin, carat, metal, energized status).
  - `InventoryAdjustment`: `id`, `product_id`, `admin_user_id`, `quantity_change`, `previous_stock`, `new_stock`, `reason`, `notes`, `created_at`.
  - `Customer`: `id`, `full_name`, `email`, `phone`, `city`, `state`, `total_orders`, `total_spent`, `created_at`.
  - `Order` & `OrderItem`: `order_number` (`#ORD1086`), `customer_id`, `customer_name`, `customer_email`, `customer_phone`, `subtotal`, `discount_amount`, `tax_amount`, `total_amount`, `order_status` (`pending`, `processing`, `shipped`, `delivered`, `cancelled`), `payment_status` (`paid`, `pending`, `refunded`), `shipping_address`, `placed_at`.
  - `ProductReview`: `id`, `product_id`, `customer_name`, `rating` (1-5), `comment`, `is_approved`, `is_verified_purchase`, `created_at`.
- **Spiritual Services & Appointments**:
  - `PujaService`: `id`, `name`, `slug`, `deity`, `description`, `price`, `duration_minutes`, `is_online_available`, `is_offline_available`, `is_active`, `inclusions` (JSON).
  - `PujaBooking`: `id`, `booking_number` (`#PUJ-2024-001`), `service_id`, `customer_name`, `customer_email`, `customer_phone`, `gotra`, `nakshatra`, `sankalp_text`, `booking_date`, `time_slot`, `booking_type`, `priest_name`, `status`, `amount_paid`.
  - `JyotishConsultation`: `id`, `consultation_number` (`#JYT-2024-001`), `customer_name`, `customer_email`, `customer_phone`, `dob`, `tob`, `pob`, `topic`, `consultation_type`, `scheduled_at`, `status`, `astrologer_notes` (Restricted access), `amount_paid`.
  - `AvailabilitySlot`: `id`, `service_type` (`puja` or `jyotish`), `slot_date`, `start_time`, `end_time`, `max_capacity`, `booked_count`, `is_active`.
- **Operations & Content**:
  - `BlogPost`, `Testimonial`, `GurujiProfile`, `MediaFile`.
  - `PaymentTransaction`, `Coupon`, `ReturnRequest`, `CustomerEnquiry`, `SystemSetting`.

---

## 3. RBAC Permission Matrix

| Module | Super Admin | Commerce Manager | Services Manager | Content Editor | Support | Read Only |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dashboard (Overview)** | Full Access | Full Access | Full Access | Full Access | Full Access | View Only |
| **Products & Catalog** | Full (CRUD, Archive) | Full (CRUD, Archive) | View Only | View Only | View Only | View Only |
| **Inventory & Restock** | Full (Adjust, Audit) | Full (Adjust, Audit) | No Access | No Access | View Only | View Only |
| **Orders & Fulfillment** | Full + Refund | Full (Status, Pack) | No Access | No Access | View + Resend | View Only |
| **Reviews Moderation** | Full (Approve/Reject) | Full (Approve/Reject) | No Access | View Only | View Only | View Only |
| **Puja Services & Slots** | Full (CRUD, Slots) | View Only | Full (CRUD, Slots) | View Only | View Only | View Only |
| **Puja Bookings** | Full (Assign Priest) | View Only | Full (Assign Priest) | No Access | View Only | View Only |
| **Jyotish Consultations** | Full + Secret Notes | No Access | Full + Secret Notes | No Access | View (No Notes) | View Only |
| **Content (Blog, Guruji)**| Full | No Access | No Access | Full (CRUD) | View Only | View Only |
| **Coupons & Operations** | Full | Full | View Only | No Access | View Only | View Only |
| **Customer Enquiries** | Full | Full | Full | View Only | Respond | View Only |
| **Admin Users & Roles** | Full (Add, Revoke) | No Access | No Access | No Access | No Access | No Access |
| **Reports & CSV Exports**| Full | Commerce Only | Services Only | Content Only | No Access | View Only |
| **Audit Logs & Settings**| Full | No Access | No Access | No Access | No Access | No Access |

*Note: Unauthorized access attempts trigger HTTP 403 Forbidden with security logging.*

---

## 4. Project Structure

```
c:\Users\ayush\Downloads\JAPAM\
├── app/
│   ├── __init__.py           # Flask Application Factory with CSP, filters, and error handlers
│   ├── config.py             # Configs (Development, Testing, Production)
│   ├── extensions.py         # SQLAlchemy, Migrate, RedisClientWrapper with fallback
│   ├── models/               # Relational data layer
│   │   ├── __init__.py
│   │   ├── user.py           # AdminUser, Role, RolePermission, AuditLog
│   │   ├── commerce.py       # Product, Category, InventoryAdjustment, Order, OrderItem, Customer, Review
│   │   ├── service.py        # PujaService, PujaBooking, JyotishConsultation, AvailabilitySlot
│   │   ├── content.py        # BlogPost, Testimonial, GurujiProfile, MediaFile
│   │   └── operations.py     # PaymentTransaction, Coupon, ReturnRequest, CustomerEnquiry, Setting
│   ├── services/             # Dedicated business logic layer
│   │   ├── __init__.py
│   │   ├── auth_service.py   # Password hashing, sessions, CSRF, JWT issuance & revocation
│   │   ├── rbac_service.py   # RBAC decorators (@permission_required, @login_required)
│   │   ├── commerce_service.py # Row-level inventory locking, orders, refunds
│   │   ├── booking_service.py  # Concurrency-safe Puja & Jyotish slot reservations
│   │   ├── audit_service.py  # Immutable event logging with sensitive field redaction
│   │   ├── rate_limit_service.py # Distributed Redis rate limiter
│   │   └── report_service.py # Dynamic dashboard metrics, charts, CSV exports
│   ├── blueprints/           # Modular route controllers
│   │   ├── auth/             # Login, logout, password reset, OAuth callback
│   │   ├── dashboard/        # Overview, metrics, global search autocomplete
│   │   ├── commerce/         # Products, categories, inventory, orders, customers, reviews
│   │   ├── services/         # Puja services, puja bookings, consultations, calendar slots
│   │   ├── content/          # Blog, testimonials, Guruji profile, media library
│   │   ├── operations/       # Payments, coupons, returns, enquiries
│   │   ├── system/           # Admin users, reports, audit logs, store settings
│   │   ├── api/              # Versioned REST API v1 (/api/v1)
│   │   └── health/           # Health probes (/health/live, /health/ready)
│   ├── templates/            # Semantic, responsive Jinja templates
│   │   ├── base.html         # Master layout with responsive sidebar, notifications & header
│   │   ├── dashboard/overview.html # Matches reference screenshot exactly
│   │   ├── auth/             # Sign-in and password reset
│   │   ├── commerce/         # Product, order, category, inventory, and review templates
│   │   ├── services/         # Puja, appointment, and availability templates
│   │   ├── content/          # Articles, devotee blessings, Guruji bio, media library
│   │   ├── operations/       # Payments, vouchers, returns, inquiries
│   │   ├── system/           # User permissions, exports, audit trails, configurations
│   │   └── errors/           # Custom 403, 404, 500 error pages
│   └── static/
│       ├── css/admin.css     # Clean light theme: ivory background, saffron & gold accents
│       ├── js/admin.js       # Live search, modal dialogs, responsive mobile sidebar
│       ├── js/dashboard.js   # Chart.js integration for Revenue & Order Status graphs
│       └── img/              # Default product visuals and icons
├── tests/                    # Comprehensive automated pytest test suite
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_rbac.py
│   ├── test_rate_limit.py
│   ├── test_commerce.py
│   ├── test_bookings.py
│   └── test_api.py
├── worker.py                 # Asynchronous background job processor
├── seed.py                   # Realistic spiritual database seeder matching dashboard numbers
├── run.py                    # Local development server
├── wsgi.py                   # Production WSGI entrypoint for Gunicorn
├── Dockerfile                # Non-root production container
├── docker-compose.yml        # Production stack for Coolify (Web, Worker, Postgres, Redis)
├── .env.example              # Environment variables template
└── requirements.txt          # Python dependencies
```

---

## 5. Local Setup & Execution

### 1. Prerequisites
- Python 3.11+ (Python 3.13 supported)
- Git

### 2. Installation
```bash
# Clone the repository
git clone <repo-url>
cd JAPAM

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Configuration
```bash
cp .env.example .env
# Configure SECRET_KEY and credentials in .env
```

### 4. Seed Database
```bash
python seed.py
```
*Creates the database, seeds initial roles, 10 spiritual products (including low-stock items), 86 distributed orders, puja bookings, consultations, and 6 administrative users.*

### 5. Run the Application
```bash
python run.py
```
Open **http://localhost:5000** in your browser.

#### Default Admin Credentials:
| Role | Email | Password |
| :--- | :--- | :--- |
| **Super Admin** | `admin@japam.in` | `Admin@12345` |
| **Commerce Manager** | `commerce@japam.in` | `Commerce@12345` |
| **Services Manager** | `services@japam.in` | `Services@12345` |
| **Content Editor** | `editor@japam.in` | `Editor@12345` |
| **Support** | `support@japam.in` | `Support@12345` |
| **Read Only** | `readonly@japam.in` | `ReadOnly@12345` |

### 6. Run Test Suite
```bash
python -m pytest -v
```

---

## 6. Hostinger VPS + Coolify Deployment Guide

### Step 1: Provision Hostinger VPS
1. In Hostinger Control Panel, purchase a VPS (KVM 2 or KVM 4 recommended, Ubuntu 22.04 or 24.04 64-bit).
2. Connect to your VPS via SSH:
   ```bash
   ssh root@<YOUR_VPS_IP>
   ```
3. Update packages:
   ```bash
   apt update && apt upgrade -y
   apt install -y curl ufw git
   ```
4. Setup basic firewall:
   ```bash
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw allow 8000/tcp  # Coolify default UI
   ufw enable
   ```

### Step 2: Install Coolify on the VPS
Run the official Coolify installation script:
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```
Once installed, open **`http://<YOUR_VPS_IP>:8000`** in your browser and create your root admin account.

### Step 3: Deploy Application via Coolify
1. In Coolify dashboard, create a new **Project** (e.g., `Spiritual Commerce`).
2. Add a new **Resource** &rarr; Select **Docker Compose**.
3. Point to your Git repository (GitHub / GitLab) or paste the contents of `docker-compose.yml`.
4. In the Coolify environment variables section, set the production values:
   ```ini
   SECRET_KEY=generate-a-strong-64-character-hex-string
   JWT_SECRET_KEY=generate-a-strong-jwt-secret-string
   CSRF_SECRET_KEY=generate-a-strong-csrf-secret-key-32chars
   COOKIE_SECURE=true
   COOKIE_SAMESITE=Lax
   TIMEZONE=Asia/Kolkata
   ```
5. Set your domain for the `web` service (e.g. `https://admin.yourdomain.com`).
   - Coolify's integrated Traefik proxy automatically provisions a **free Let's Encrypt SSL/TLS Certificate** and handles HTTPS redirection.

### Step 4: Run Initial Database Migrations & Seed
Inside Coolify:
1. Open the deployed `web` service container terminal (or run via SSH on the server):
   ```bash
   docker exec -it <container_name_web> python seed.py
   ```
2. Your database is now populated with all roles, spiritual catalog items, and initial admin accounts.

### Step 5: Backup & Disaster Recovery Schedule
1. **Automated Database Backups**:
   - In Coolify, navigate to the `postgres` resource &rarr; **Backups** tab.
   - Enable automated daily backups at `02:00 UTC` with a 30-day retention policy. Backups are stored in encrypted tarballs or pushed to an S3-compatible bucket.
2. **Manual Backup Command**:
   ```bash
   docker exec -t <postgres_container> pg_dump -U japam_user -d japam_db -Fc > /root/backups/japam_backup_$(date +%Y%m%d_%H%M%S).dump
   ```
3. **Restore Procedure**:
   ```bash
   docker exec -i <postgres_container> pg_restore -U japam_user -d japam_db --clean --if-exists < /root/backups/japam_backup_YYYYMMDD_HHMMSS.dump
   ```

### Step 6: Rollback Procedure
If a new release causes issues:
1. In Coolify, navigate to the application &rarr; **Deployments**.
2. Click **Redeploy** on the previously successful Git commit. Coolify performs a zero-downtime rolling restart using Docker healthcheck probes (`/health/ready`).

---

## 7. External Frontend Integration Guide

The customer storefront is hosted separately on an external frontend repository (e.g., Next.js, Vite, React, Vue, or mobile app). This Flask application serves as the headless backend API (`/api/v1/*`) and the admin control panel (`/admin/*`).

### 1. Configurable Frontend Origins & CORS
Cross-Origin Resource Sharing (CORS) is enabled **strictly for `/api/*` endpoints** and restricted to explicitly allowed origins specified via the `FRONTEND_ORIGINS` environment variable.

- **Environment Variable**:
  ```env
  FRONTEND_ORIGINS=http://localhost:3000,http://localhost:5173,https://store.yourdomain.com
  ```
- **CORS Policy Details**:
  - `Access-Control-Allow-Origin`: Dynamically set to the requesting origin if present in `FRONTEND_ORIGINS`.
  - `Access-Control-Allow-Credentials`: `true`.
  - `Access-Control-Allow-Methods`: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
  - `Access-Control-Allow-Headers`: `Content-Type, Authorization, X-Requested-With, X-CSRFToken, Accept, X-Customer-Email`.
  - `Access-Control-Max-Age`: `86400` (preflight caching).
  - Admin routes (`/admin/*`) and auth routes (`/auth/*`) remain strictly Same-Origin protected.

### 2. Authentication, Cookies, JWT & CSRF Specifications

| Requirement | External Frontend (REST API) | Admin Panel |
| :--- | :--- | :--- |
| **Authentication Mechanism** | Stateless JSON Web Tokens (JWT) | Stateful Session Cookie (`japam_admin_auth`) |
| **Header Format** | `Authorization: Bearer <access_token>` | Handled automatically by browser cookies |
| **Token Lifespans** | Access Token: 60 min · Refresh Token: 14 days | Session: 12 hours (30 days if "Remember Me") |
| **Token Refresh Endpoint** | `POST /api/v1/auth/refresh` | Re-authenticated via secure cookie / login |
| **Token Revocation** | `POST /api/v1/auth/revoke` (stored in Redis blacklist) | `GET/POST /auth/logout` |
| **CSRF Requirement** | **None** (Stateless Bearer tokens are exempt from CSRF) | Form token (`csrf_token`) or `X-CSRFToken` header |
| **Cookie Flagging** | Not required for API requests | `HttpOnly=True`, `SameSite=Lax`, `Secure=True` (prod) |

### 3. REST API Endpoint Reference (`/api/v1`)

| Endpoint | Method | Auth / Ownership | Description |
| :--- | :---: | :--- | :--- |
| `/api/v1/catalog/products` | `GET` | Public | List published products with optional `?category=<slug>` filter |
| `/api/v1/catalog/products/<slug>` | `GET` | Public | Get product specifications, images, and approved reviews |
| `/api/v1/catalog/products/<slug>/reviews` | `POST` | Public (Moderated) | Submit customer review (queued with `is_approved=False`) |
| `/api/v1/catalog/categories` | `GET` | Public | List active spiritual categories with hierarchy & icons |
| `/api/v1/services/puja` | `GET` | Public | List available Vedic Puja services and inclusions |
| `/api/v1/services/book-puja` | `POST` | Public | Book a Puja slot with devotee Gotra, Nakshatra, and date |
| `/api/v1/services/request-consultation` | `POST` | Public | Submit Jyotish consultation request with birth coordinates |
| `/api/v1/cart/calculate` | `POST` | Public | Server-authoritative calculation: coupon, GST (3%), shipping |
| `/api/v1/orders/checkout` | `POST` | Public (Atomic) | Atomic order placement with row-level stock reservation |
| `/api/v1/orders/<order_number>` | `GET` | Devotee Ownership | Track order timeline (requires `?email=` or `X-Customer-Email`) |
| `/api/v1/orders/<order_number>/cancel` | `POST` | Devotee Ownership | Cancel order and automatically restock inventory |
| `/api/v1/orders/<order_number>/return` | `POST` | Devotee Ownership | Submit return request for delivered items |
| `/api/v1/contact` | `POST` | Public | Submit customer seva enquiry |
| `/api/v1/auth/token` | `POST` | Admin Credentials | Obtain JWT access and refresh token pair |
| `/api/v1/auth/refresh` | `POST` | Refresh Token | Exchange refresh token for fresh access token |
| `/api/v1/auth/revoke` | `POST` | JWT Token | Revoke token and blacklist JTI in Redis |
| `/api/v1/payments/webhook` | `POST` | HMAC-SHA256 | Razorpay/Stripe webhook handler with idempotency cache |
| `/health/live` | `GET` | Public | Liveness probe for Docker / Coolify |
| `/health/ready` | `GET` | Public | Readiness probe checking database & Redis connectivity |

### 4. Root URL Routing
- `GET /`: Automatically redirects (HTTP 302) to `/admin`.
- `GET /admin`: Redirects to `/admin/dashboard` if authenticated, or `/auth/login` if unauthenticated.

---

## 8. Verification & Test Results

```
============================= test session starts =============================
platform win32 -- Python 3.13.7, pytest-9.1.1, pluggy-1.7.0
rootdir: C:\Users\ayush\Downloads\JAPAM

tests/test_api.py::test_api_health_live PASSED                           [  3%]
tests/test_api.py::test_api_health_ready PASSED                          [  6%]
tests/test_api.py::test_api_auth_token_issuance PASSED                   [ 10%]
tests/test_api.py::test_api_catalog_products PASSED                      [ 13%]
tests/test_api.py::test_api_auth_token_refresh PASSED                   [ 17%]
tests/test_api.py::test_api_product_detail_and_review PASSED            [ 20%]
tests/test_api.py::test_api_contact_enquiry PASSED                      [ 24%]
tests/test_api.py::test_api_cors_allowed_origin PASSED                   [ 27%]
tests/test_api.py::test_root_redirect_to_admin PASSED                    [ 31%]
tests/test_auth.py::test_login_success PASSED                            [ 34%]
tests/test_auth.py::test_login_invalid_password PASSED                   [ 37%]
tests/test_auth.py::test_account_lockout_after_failures PASSED           [ 41%]
tests/test_auth.py::test_logout PASSED                                   [ 44%]
tests/test_bookings.py::test_puja_slot_booking_and_double_booking_protection PASSED [ 48%]
tests/test_commerce.py::test_inventory_adjustment PASSED                 [ 51%]
tests/test_commerce.py::test_order_status_and_refund PASSED              [ 55%]
tests/test_customer_ownership.py::test_customer_ownership_view_protection PASSED [ 58%]
tests/test_customer_ownership.py::test_customer_ownership_cancel_protection PASSED [ 62%]
tests/test_customer_ownership.py::test_customer_ownership_return_protection PASSED [ 65%]
tests/test_customer_ownership.py::test_customer_valid_cancellation_restocks_inventory PASSED [ 68%]
tests/test_rate_limit.py::test_rate_limit_service PASSED                 [ 72%]
tests/test_rbac.py::test_super_admin_has_full_access PASSED              [ 75%]
tests/test_rbac.py::test_commerce_manager_forbidden_on_system_users PASSED [ 79%]
tests/test_rbac.py::test_readonly_user_forbidden_on_create_product PASSED [ 82%]
tests/test_webhook.py::test_payment_webhook_valid_signature_success PASSED [ 86%]
tests/test_webhook.py::test_payment_webhook_missing_or_invalid_signature PASSED [ 89%]
tests/test_webhook.py::test_payment_webhook_idempotency_prevents_duplicate PASSED [ 93%]
tests/test_webhook.py::test_payment_webhook_amount_mismatch_rejected PASSED [ 96%]
tests/test_webhook.py::test_payment_webhook_nonexistent_order_404 PASSED [100%]

======================== 29 passed in 76.62s (0:01:16) ========================
```

---

## 8. Module Completion Checklist

- [x] **Overview Dashboard**:
  - [x] 4 Metric Cards (Orders Today, Revenue, Puja Bookings, Consultation Requests) matching reference image layout and trends.
  - [x] Revenue Overview interactive area chart with saffron gradient and INR tooltips.
  - [x] Order Status donut chart with center totals and color-coded status legend.
  - [x] Upcoming Appointments table with Puja & Consultation tags and status badges.
  - [x] Recent Orders table with itemized lines, amounts, and dates.
  - [x] Low Stock Alert table with product thumbnails, red stock warnings, and instant Restock action modal.
  - [x] Pending Actions widget with dynamic counts and direct resolution links.
- [x] **Commerce Modules**:
  - [x] Products catalog with category filtering, search, and category-specific specs (Mukhi, Carat, Origin, Metal, Energization).
  - [x] Categories management with product counts and hierarchy.
  - [x] Inventory management with row-level database locking and audit history.
  - [x] Orders & Customers with fulfillment transitions and refund handling.
  - [x] Reviews moderation with approval controls.
- [x] **Services Modules**:
  - [x] Vedic Puja Services catalog with deity, duration, price, and inclusions.
  - [x] Puja Bookings with Gotra, Nakshatra, Priest assignment, and video streaming links.
  - [x] Jyotish Consultations with confidential birth details and restricted astrologer notes.
  - [x] Availability Calendar slots with capacity limits and double-booking protection.
- [x] **Content Modules**:
  - [x] Spiritual Blog articles publication.
  - [x] Devotee Testimonials moderation.
  - [x] Guruji Profile and Ashram Darshan timings.
  - [x] Media library with file size/type validation and path copying.
- [x] **Operations Modules**:
  - [x] Payments ledger with gateway logs and verification.
  - [x] Coupons & discount codes with usage limits.
  - [x] Shipping & Devotee returns tracking.
  - [x] Devotee enquiries with official spiritual response modal.
- [x] **System & Security Modules**:
  - [x] RBAC server-enforced permissions across 6 distinct roles.
  - [x] Admin user management and role assignment.
  - [x] Immutable security audit trail with sensitive data redaction.
  - [x] Reports & CSV exports.
  - [x] Global system settings (timezone, currency, tax, maintenance mode).
  - [x] REST API v1 endpoints & Health checks (`/health/live`, `/health/ready`).
  - [x] Production Dockerfile and `docker-compose.yml` for Coolify on Hostinger VPS.
