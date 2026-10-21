from datetime import datetime, timezone
from decimal import Decimal
from app.extensions import db


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    slug = db.Column(db.String(120), unique=True, nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)
    icon = db.Column(db.String(100), nullable=True)  # e.g., 'gem', 'sparkles', 'sun', 'box'
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    sort_order = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    products = db.relationship("Product", back_populates="category")

    def __repr__(self):
        return f"<Category {self.name}>"


class Product(db.Model):
    __tablename__ = "products"
    __table_args__ = (db.Index("idx_product_cat_rank_created", "category_id", "display_rank", "created_at"),)

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False, index=True)
    slug = db.Column(db.String(280), unique=True, nullable=False, index=True)
    sku = db.Column(db.String(80), unique=True, nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)

    # Prices using fixed-precision Decimal
    price = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    compare_price = db.Column(db.Numeric(12, 2), nullable=True)

    # Inventory
    stock_quantity = db.Column(db.Integer, default=0, nullable=False)
    low_stock_threshold = db.Column(db.Integer, default=10, nullable=False)

    # Spiritual domain attributes
    # 'certified', 'standard', 'lab_tested'
    certification_status = db.Column(db.String(50), default="certified", nullable=False)
    # 'published', 'draft', 'archived'
    publishing_status = db.Column(db.String(50), default="published", nullable=False, index=True)
    is_archived = db.Column(db.Boolean, default=False, nullable=False, index=True)
    archived_at = db.Column(db.DateTime, nullable=True)
    previous_publishing_status = db.Column(db.String(50), nullable=True)

    # Storefront display rank priority (1 = 1st, 2 = 2nd, etc.)
    display_rank = db.Column(db.Integer, default=999, nullable=False, index=True)
    thumbnail = db.Column(db.String(500), nullable=True)
    images = db.Column(db.JSON, default=list)  # list of image URLs
    # Category-specific specs: mukhi, origin, carat, energized_by, rashi, metal, bead_size, weight
    attributes = db.Column(db.JSON, default=dict)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    category = db.relationship("Category", back_populates="products")
    adjustments = db.relationship("InventoryAdjustment", back_populates="product", cascade="all, delete-orphan")
    order_items = db.relationship("OrderItem", back_populates="product")
    reviews = db.relationship("ProductReview", back_populates="product", cascade="all, delete-orphan")

    @property
    def is_low_stock(self) -> bool:
        return self.stock_quantity <= self.low_stock_threshold

    def __repr__(self):
        return f"<Product {self.sku} - {self.name}>"


class InventoryAdjustment(db.Model):
    __tablename__ = "inventory_adjustments"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    admin_user_id = db.Column(db.Integer, db.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    quantity_change = db.Column(db.Integer, nullable=False)  # +10 or -5
    previous_stock = db.Column(db.Integer, nullable=False)
    new_stock = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(100), nullable=False)  # Restock, Physical Audit, Damaged, Customer Return, Manual Correction
    notes = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    product = db.relationship("Product", back_populates="adjustments")
    admin_user = db.relationship("AdminUser")

    def __repr__(self):
        return f"<InventoryAdjustment prod={self.product_id} change={self.quantity_change}>"


class Customer(db.Model):
    __tablename__ = "customers"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(150), nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(30), nullable=True, index=True)
    city = db.Column(db.String(100), nullable=True)
    state = db.Column(db.String(100), nullable=True)
    pincode = db.Column(db.String(20), nullable=True)
    address = db.Column(db.Text, nullable=True)

    total_orders = db.Column(db.Integer, default=0, nullable=False)
    total_spent = db.Column(db.Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    orders = db.relationship("Order", back_populates="customer")

    def __repr__(self):
        return f"<Customer {self.full_name}>"


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(50), unique=True, nullable=False, index=True)  # e.g., #ORD1086
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=True, index=True)

    # Customer snapshot in order
    customer_name = db.Column(db.String(150), nullable=False)
    customer_email = db.Column(db.String(255), nullable=False)
    customer_phone = db.Column(db.String(30), nullable=True)
    shipping_address = db.Column(db.Text, nullable=True)

    # Financials
    subtotal = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    discount_amount = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    tax_amount = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    total_amount = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0.00"))

    # Statuses
    # pending, processing, shipped, delivered, cancelled
    order_status = db.Column(db.String(50), default="pending", nullable=False, index=True)
    # pending, paid, failed, refunded
    payment_status = db.Column(db.String(50), default="pending", nullable=False, index=True)
    payment_method = db.Column(db.String(50), default="Online", nullable=False)

    tracking_number = db.Column(db.String(100), nullable=True)
    courier_partner = db.Column(db.String(100), nullable=True)
    admin_notes = db.Column(db.Text, nullable=True)

    # Security: High-entropy secret token for order tracking & ownership verification (prevents IDOR)
    access_token = db.Column(db.String(128), unique=True, nullable=True, index=True)
    # Concurrency: Unique idempotency key to prevent double-submit and race conditions
    idempotency_key = db.Column(db.String(128), unique=True, nullable=True, index=True)

    placed_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    customer = db.relationship("Customer", back_populates="orders")
    items = db.relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Order {self.order_number} - {self.total_amount}>"


class OrderItem(db.Model):
    __tablename__ = "order_items"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id", ondelete="SET NULL"), nullable=True)

    product_name = db.Column(db.String(255), nullable=False)
    sku = db.Column(db.String(80), nullable=False)
    unit_price = db.Column(db.Numeric(12, 2), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    total_price = db.Column(db.Numeric(12, 2), nullable=False)

    order = db.relationship("Order", back_populates="items")
    product = db.relationship("Product", back_populates="order_items")

    def __repr__(self):
        return f"<OrderItem {self.product_name} x {self.quantity}>"


class ProductReview(db.Model):
    __tablename__ = "product_reviews"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_name = db.Column(db.String(150), nullable=False)
    customer_email = db.Column(db.String(255), nullable=True)
    rating = db.Column(db.Integer, nullable=False)  # 1 to 5
    title = db.Column(db.String(200), nullable=True)
    comment = db.Column(db.Text, nullable=False)
    is_approved = db.Column(db.Boolean, default=False, nullable=False, index=True)
    is_verified_purchase = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    product = db.relationship("Product", back_populates="reviews")

    def __repr__(self):
        return f"<ProductReview prod={self.product_id} rating={self.rating}>"
