import os
from decimal import Decimal
from datetime import datetime, date, timedelta, timezone
from app import create_app
from app.extensions import db
from app.models.user import Role, RolePermission, AdminUser, AuditLog
from app.models.commerce import Category, Product, Order, OrderItem, Customer, ProductReview, InventoryAdjustment
from app.models.service import PujaService, PujaBooking, JyotishConsultation, AvailabilitySlot
from app.models.content import BlogPost, Testimonial, GurujiProfile, MediaFile, Banner
from app.models.operations import PaymentTransaction, Coupon, ReturnRequest, CustomerEnquiry, SystemSetting
from app.services.rbac_service import seed_roles_and_permissions


def seed_database():
    app = create_app(os.getenv("FLASK_ENV", "development"))
    with app.app_context():
        print("[*] Seeding Spiritual Commerce database...")

        # 1. Create tables
        db.create_all()

        # 2. Roles & Permissions
        seed_roles_and_permissions()
        super_admin_role = Role.query.filter_by(code="super_admin").first()
        commerce_role = Role.query.filter_by(code="commerce_manager").first()
        services_role = Role.query.filter_by(code="services_manager").first()
        content_role = Role.query.filter_by(code="content_editor").first()
        support_role = Role.query.filter_by(code="support").first()
        read_only_role = Role.query.filter_by(code="read_only").first()

        # 3. Admin Users
        admin_users_data = [
            ("admin@japam.in", "Admin", super_admin_role, "Admin@12345"),
            ("commerce@japam.in", "Commerce Manager", commerce_role, "Commerce@12345"),
            ("services@japam.in", "Pandit Ji Coordinator", services_role, "Services@12345"),
            ("editor@japam.in", "Content Editor", content_role, "Editor@12345"),
            ("support@japam.in", "Devotee Support", support_role, "Support@12345"),
            ("readonly@japam.in", "Auditor", read_only_role, "ReadOnly@12345"),
        ]

        super_admin_user = None
        for email, full_name, role, pwd in admin_users_data:
            user = AdminUser.query.filter_by(email=email).first()
            if not user:
                user = AdminUser(
                    email=email,
                    full_name=full_name,
                    role=role,
                    is_active=True,
                )
                user.set_password(pwd)
                db.session.add(user)
                db.session.flush()
                print(f"  + Created admin user: {email} ({role.code})")
            if role.code == "super_admin":
                super_admin_user = user

        # 4. Categories
        categories_data = [
            ("Rudraksha", "rudraksha", "Authentic certified Nepali and Indonesian sacred Rudraksha beads", "sun"),
            ("Ratna & Gemstones", "ratna", "Natural astrological gemstones certified by recognized gemological labs", "gem"),
            ("Yantra", "yantra", "Vedic energized yantras in pure copper, silver, and ashtadhatu", "sparkles"),
            ("Spiritual Bracelets", "bracelets", "Handcrafted healing crystal and sacred bead bracelets", "circle"),
            ("Puja Samagri", "puja-samagri", "Organic hawan samagri, brass diyas, and authentic pooja essentials", "box"),
            ("Special Collections", "special-collections", "Consecrated spiritual kits, temple energized malas, and idols", "star"),
        ]

        cat_map = {}
        for name, slug, desc, icon in categories_data:
            cat = Category.query.filter_by(slug=slug).first()
            if not cat:
                cat = Category(name=name, slug=slug, description=desc, icon=icon, is_active=True)
                db.session.add(cat)
                db.session.flush()
            cat_map[slug] = cat

        # 5. Products (Including the 4 exact low stock products from reference image!)
        products_data = [
            # Low Stock Alert items from reference screenshot:
            ("Sandalwood Incense Sticks", "INC-001", "puja-samagri", Decimal("299.00"), Decimal("399.00"), 5, 10,
             "certified", "published", {"weight": "250g", "fragrance": "Pure Mysore Sandalwood"}),
            ("Brass Diya (Medium)", "BD-002", "puja-samagri", Decimal("1299.00"), Decimal("1499.00"), 8, 10,
             "certified", "published", {"metal": "Pure Brass", "capacity": "150ml"}),
            ("Rudraksha Mala (5 Mukhi)", "RM-005", "rudraksha", Decimal("2499.00"), Decimal("2999.00"), 4, 10,
             "certified", "published", {"mukhi": "5 Mukhi", "origin": "Nepal", "bead_size": "8mm", "beads_count": 108}),
            ("Puja Samagri Kit", "PK-010", "puja-samagri", Decimal("899.00"), Decimal("1199.00"), 6, 10,
             "certified", "published", {"items_count": "21 sacred items", "shelf_life": "12 months"}),
            ("Brass Kalash", "BK-003", "puja-samagri", Decimal("1750.00"), Decimal("1950.00"), 18, 10,
             "certified", "published", {"metal": "Pure Brass", "weight": "450g"}),
            # Additional Ratna & Yantra collections
            ("Yellow Sapphire (Pukhraj)", "RAT-001", "ratna", Decimal("14999.00"), Decimal("21000.00"), 12, 5,
             "certified", "published", {"carat": "4.25 Ratti", "origin": "Ceylon (Sri Lanka)", "lab": "IGI Certified"}),
            ("Natural Blue Sapphire (Neelam)", "RAT-002", "ratna", Decimal("19999.00"), Decimal("28000.00"), 7, 3,
             "certified", "published", {"carat": "5.10 Ratti", "origin": "Kashmir / Ceylon", "lab": "GIA Certified"}),
            ("Sri Yantra in Pure Copper", "YAN-001", "yantra", Decimal("3299.00"), Decimal("4800.00"), 15, 5,
             "certified", "published", {"metal": "Pure 99.9% Copper", "dimensions": "6x6 inches", "energized": "Consecrated on Diwali"}),
            ("7 Chakra Healing Crystal Bracelet", "BRC-001", "bracelets", Decimal("799.00"), Decimal("999.00"), 25, 10,
             "certified", "published", {"bead_size": "8mm", "stones": "Amethyst, Lapis, Turquoise, Tiger Eye"}),

            # Astroveda Rudraksha Collection
            ("1 Mukhi Rudraksha", "RUD-001", "rudraksha", Decimal("15999.00"), Decimal("21000.00"), 5, 2,
             "certified", "published", {"mukhi": "1 Mukhi", "origin": "Nepal", "deity": "Lord Shiva"}),
            ("2 Mukhi Rudraksha", "RUD-002", "rudraksha", Decimal("3999.00"), Decimal("5500.00"), 12, 4,
             "certified", "published", {"mukhi": "2 Mukhi", "origin": "Nepal", "deity": "Ardhanarishwar"}),
            ("3 Mukhi Rudraksha", "RUD-003", "rudraksha", Decimal("1299.00"), Decimal("1800.00"), 20, 5,
             "certified", "published", {"mukhi": "3 Mukhi", "origin": "Nepal", "deity": "Agni"}),
            ("4 Mukhi Rudraksha", "RUD-004", "rudraksha", Decimal("1499.00"), Decimal("2000.00"), 18, 5,
             "certified", "published", {"mukhi": "4 Mukhi", "origin": "Nepal", "deity": "Brahma"}),
            ("5 Mukhi Rudraksha", "RUD-005", "rudraksha", Decimal("799.00"), Decimal("1200.00"), 40, 10,
             "certified", "published", {"mukhi": "5 Mukhi", "origin": "Nepal", "deity": "Kalagni Rudra"}),
            ("6 Mukhi Rudraksha", "RUD-006", "rudraksha", Decimal("1999.00"), Decimal("2800.00"), 15, 4,
             "certified", "published", {"mukhi": "6 Mukhi", "origin": "Nepal", "deity": "Kartikeya"}),
            ("7 Mukhi Rudraksha", "RUD-007", "rudraksha", Decimal("2499.00"), Decimal("3500.00"), 14, 4,
             "certified", "published", {"mukhi": "7 Mukhi", "origin": "Nepal", "deity": "Mahalaxmi"}),
            ("Panchamukhi Rudraksha Mala", "RM-006", "rudraksha", Decimal("2499.00"), Decimal("3999.00"), 20, 5,
             "certified", "published", {"mukhi": "5 Mukhi", "beads": 108, "origin": "Nepal"}),
            ("Rudraksha Bracelet 5 Mukhi", "BRC-RUD", "bracelets", Decimal("899.00"), Decimal("1499.00"), 30, 8,
             "certified", "published", {"mukhi": "5 Mukhi", "origin": "Nepal"}),

            # Astroveda Ratna Collection
            ("Manik · Ruby 3.5ct", "RAT-RUB", "ratna", Decimal("12999.00"), Decimal("18000.00"), 8, 3,
             "certified", "published", {"carat": "3.5ct", "origin": "Burmese", "lab": "GIA Certified"}),
            ("Panna · Emerald 4.2ct", "RAT-EME", "ratna", Decimal("8999.00"), Decimal("12500.00"), 15, 4,
             "certified", "published", {"carat": "4.2ct", "origin": "Colombian", "lab": "IGI Certified"}),
            ("Moti · South Sea Pearl 5ct", "RAT-PRL", "ratna", Decimal("4999.00"), Decimal("7000.00"), 12, 3,
             "certified", "published", {"carat": "5ct", "origin": "South Sea", "lab": "Lab Certified"}),
            ("Moonga · Red Coral 7ct", "RAT-COR", "ratna", Decimal("5499.00"), Decimal("7500.00"), 10, 3,
             "certified", "published", {"carat": "7ct", "origin": "Italian", "lab": "Lab Certified"}),

            # Astroveda Yantra Collection
            ("Kuber Yantra · Copper", "YAN-KUB", "yantra", Decimal("2499.00"), Decimal("3500.00"), 18, 5,
             "certified", "published", {"metal": "Pure Copper", "deity": "Lord Kuber"}),
            ("Navgraha Yantra · Copper", "YAN-NAV", "yantra", Decimal("4999.00"), Decimal("6500.00"), 10, 3,
             "certified", "published", {"metal": "Pure Copper", "deity": "Navagraha"}),
            ("Ganesh Yantra · Copper", "YAN-GAN", "yantra", Decimal("1999.00"), Decimal("2800.00"), 15, 4,
             "certified", "published", {"metal": "Pure Copper", "deity": "Lord Ganesha"}),

            # Astroveda Bracelet Collection
            ("Navagraha Mixed-Stone Bracelet", "BRC-NAV", "bracelets", Decimal("1899.00"), Decimal("2999.00"), 25, 6,
             "certified", "published", {"bead_size": "8mm", "stones": "Tiger eye, obsidian, moonstone, jade, sunstone"}),
            ("Amethyst Crystal Bracelet", "BRC-AME", "bracelets", Decimal("1299.00"), Decimal("1999.00"), 20, 5,
             "certified", "published", {"bead_size": "8mm", "stones": "Natural Amethyst"}),
            ("Black Tourmaline Protection Bracelet", "BRC-TOU", "bracelets", Decimal("1499.00"), Decimal("2200.00"), 18, 5,
             "certified", "published", {"bead_size": "8mm", "stones": "Black Tourmaline"}),
            ("Wealth & Prosperity Combo Bracelet", "BRC-COM", "bracelets", Decimal("2199.00"), Decimal("3200.00"), 15, 4,
             "certified", "published", {"bead_size": "8mm", "stones": "Citrine, green jade, pyrite"}),
        ]

        prod_map = {}
        for name, sku, cat_slug, price, cmp_price, stock, thresh, cert, pub, attrs in products_data:
            prod = Product.query.filter_by(sku=sku).first()
            if not prod:
                slug = name.lower().replace(" ", "-").replace("(", "").replace(")", "").replace("/", "-")
                prod = Product(
                    name=name,
                    slug=f"{slug}-{sku.lower()}",
                    sku=sku,
                    category=cat_map[cat_slug],
                    price=price,
                    compare_price=cmp_price,
                    stock_quantity=stock,
                    low_stock_threshold=thresh,
                    certification_status=cert,
                    publishing_status=pub,
                    attributes=attrs,
                    thumbnail="/static/img/product-default.png",
                )
                db.session.add(prod)
                db.session.flush()
            prod_map[sku] = prod

        # 6. Customers (devotees from screenshot & beyond)
        customers_data = [
            ("Sneha Kulkarni", "sneha.k@gmail.com", "+91 98201 11223", "Pune", "Maharashtra", 3, Decimal("4250.00")),
            ("Amit Bhosle", "amit.bhosle@yahoo.com", "+91 98202 22334", "Mumbai", "Maharashtra", 4, Decimal("8499.00")),
            ("Priya Deshpande", "priya.deshpande@outlook.com", "+91 98203 33445", "Nagpur", "Maharashtra", 2, Decimal("2150.00")),
            ("Nikhil Kale", "nikhil.kale@gmail.com", "+91 98204 44556", "Thane", "Maharashtra", 5, Decimal("11200.00")),
            ("Sunita Patil", "sunita.patil@rediffmail.com", "+91 98205 55667", "Nashik", "Maharashtra", 1, Decimal("598.00")),
            ("Anita Deshmukh", "anita.d@gmail.com", "+91 98206 66778", "Kolhapur", "Maharashtra", 2, Decimal("3500.00")),
            ("Rahul Patil", "rahul.patil@gmail.com", "+91 98207 77889", "Aurangabad", "Maharashtra", 1, Decimal("2100.00")),
            ("Meera Kulkarni", "meera.k@gmail.com", "+91 98208 88990", "Solapur", "Maharashtra", 3, Decimal("5600.00")),
            ("Sagar Joshi", "sagar.joshi@gmail.com", "+91 98209 99001", "Satara", "Maharashtra", 2, Decimal("3200.00")),
            ("Priya Sharma", "priya.sharma@gmail.com", "+91 98210 00112", "Delhi", "Delhi", 4, Decimal("9800.00")),
        ]

        cust_map = {}
        for name, email, phone, city, state, orders_cnt, spent in customers_data:
            cust = Customer.query.filter_by(email=email).first()
            if not cust:
                cust = Customer(
                    full_name=name,
                    email=email,
                    phone=phone,
                    city=city,
                    state=state,
                    total_orders=orders_cnt,
                    total_spent=spent,
                    is_active=True,
                )
                db.session.add(cust)
                db.session.flush()
            cust_map[name] = cust

        # 7. Orders Matching the Reference Image
        # Donut Chart target: 86 total orders (52 delivered, 14 processing, 10 shipped, 6 cancelled, 4 pending)
        # Recent orders from screenshot:
        # #ORD1086 | Sneha Kulkarni | Brass Diya (1) | ₹ 1,299 | Delivered | Apr 27, 2024
        # #ORD1085 | Amit Bhosle | Rudraksha Mala (1) | ₹ 2,499 | Shipped | Apr 27, 2024
        # #ORD1084 | Priya Deshpande | Puja Samagri Kit (1) | ₹ 899 | Processing | Apr 26, 2024
        # #ORD1083 | Nikhil Kale | Brass Kalash (1) | ₹ 1,750 | Delivered | Apr 26, 2024
        # #ORD1082 | Sunita Patil | Sandalwood Incense (2) | ₹ 598 | Cancelled | Apr 25, 2024
        recent_orders_data = [
            ("#ORD1086", "Sneha Kulkarni", "BD-002", 1, Decimal("1299.00"), "delivered", "paid", datetime(2024, 4, 27, 14, 30, tzinfo=timezone.utc)),
            ("#ORD1085", "Amit Bhosle", "RM-005", 1, Decimal("2499.00"), "shipped", "paid", datetime(2024, 4, 27, 11, 15, tzinfo=timezone.utc)),
            ("#ORD1084", "Priya Deshpande", "PK-010", 1, Decimal("899.00"), "processing", "paid", datetime(2024, 4, 26, 16, 45, tzinfo=timezone.utc)),
            ("#ORD1083", "Nikhil Kale", "BK-003", 1, Decimal("1750.00"), "delivered", "paid", datetime(2024, 4, 26, 10, 20, tzinfo=timezone.utc)),
            ("#ORD1082", "Sunita Patil", "INC-001", 2, Decimal("598.00"), "cancelled", "refunded", datetime(2024, 4, 25, 9, 10, tzinfo=timezone.utc)),
        ]

        for ord_num, c_name, p_sku, qty, total, status, pay_status, placed_dt in recent_orders_data:
            ord_obj = Order.query.filter_by(order_number=ord_num).first()
            if not ord_obj:
                cust = cust_map.get(c_name)
                prod = prod_map.get(p_sku)
                ord_obj = Order(
                    order_number=ord_num,
                    customer=cust,
                    customer_name=c_name,
                    customer_email=cust.email if cust else f"{c_name.lower().replace(' ', '.')}@example.com",
                    customer_phone=cust.phone if cust else "+91 98000 00000",
                    shipping_address="402, Shiv Kripa Apts, Near Temple Road",
                    subtotal=total,
                    discount_amount=Decimal("0.00"),
                    tax_amount=Decimal("0.00"),
                    total_amount=total,
                    order_status=status,
                    payment_status=pay_status,
                    payment_method="Online UPI / Razorpay",
                    placed_at=placed_dt,
                )
                db.session.add(ord_obj)
                db.session.flush()

                if prod:
                    item = OrderItem(
                        order_id=ord_obj.id,
                        product_id=prod.id,
                        product_name=prod.name,
                        sku=prod.sku,
                        unit_price=prod.price,
                        quantity=qty,
                        total_price=total,
                    )
                    db.session.add(item)

        # Seed additional orders to match exact distribution: 52 delivered, 14 processing, 10 shipped, 6 cancelled, 4 pending = 86 total orders
        distribution = [
            ("delivered", 50, Decimal("1299.00")),
            ("processing", 13, Decimal("899.00")),
            ("shipped", 9, Decimal("2499.00")),
            ("cancelled", 5, Decimal("598.00")),
            ("pending", 4, Decimal("1750.00")),
        ]
        start_id = 1000
        for status_code, count, amount in distribution:
            for i in range(count):
                order_num = f"#ORD{start_id:04d}"
                start_id += 1
                if not Order.query.filter_by(order_number=order_num).first():
                    # spread placed_at across April 1 to April 30
                    day_offset = (i * 3) % 28 + 1
                    order = Order(
                        order_number=order_num,
                        customer_name=f"Devotee #{i+1}",
                        customer_email=f"devotee{i+1}@japam.in",
                        customer_phone="+91 98765 00000",
                        shipping_address="Ashram Marg, Varanasi",
                        subtotal=amount,
                        discount_amount=Decimal("0.00"),
                        tax_amount=Decimal("0.00"),
                        total_amount=amount,
                        order_status=status_code,
                        payment_status="paid" if status_code != "cancelled" else "refunded",
                        placed_at=datetime(2024, 4, day_offset, 12, 0, tzinfo=timezone.utc),
                    )
                    db.session.add(order)

        # 8. Puja Services
        puja_services_data = [
            ("गृहप्रवेश पूजा", "griha-pravesh-puja", "Vastu Devata & Ganesha", "🏠", Decimal("5100.00"), 90,
             "नवीन घरात प्रवेश करण्यापूर्वी वास्तुदोष शांती व गृहप्रवेश विधी."),
            ("वास्तुशांती", "vastu-shanti", "Vastu Purusha", "🔱", Decimal("7500.00"), 120,
             "वास्तु दोष निवारणासाठी शास्त्रोक्त वास्तुशांती होम व मंत्र जप."),
            ("सत्यनारायण पूजा", "satyanarayan-puja", "Lord Vishnu", "🕉️", Decimal("2500.00"), 75,
             "कुटुंबातील सुख, शांती व समृद्धीसाठी सत्यनारायण कथा व पूजन."),
            ("रुद्राभिषेक", "rudrabhishek", "Lord Shiva", "💧", Decimal("3100.00"), 90,
             "शिवलिंगावर अभिषेक व रुद्र मंत्र जप — आरोग्य व मनःशांतीसाठी."),
            ("नवग्रह शांती", "navagraha-shanti", "Navagraha", "🌌", Decimal("4500.00"), 90,
             "नऊ ग्रहांच्या अशुभ प्रभावासाठी नवग्रह शांती होम व जप."),
            ("उदकशांती", "udak-shanti", "Varuna Devata", "🌊", Decimal("3500.00"), 60,
             "जलदोष, पूर किंवा अनावृष्टी निवारणासाठी उदकशांती विधी."),
            ("विवाह संबंधित पूजा", "vivah-puja", "Gauri & Ganesha", "💐", Decimal("11000.00"), 180,
             "साखरपुडा, लग्न व वरातीशी संबंधित सर्व शास्त्रोक्त विधी."),
            ("विशेष अनुष्ठान", "vishesh-anushthan", "Ishta Devata", "✨", Decimal("5100.00"), 120,
             "तुमच्या विशिष्ट समस्येसाठी कस्टम अनुष्ठान व मंत्र जप."),
            ("Maha Ganapati Puja", "maha-ganapati-puja", "Lord Ganesha", "🕉️", Decimal("2100.00"), 60,
             "Obstacle removal, new business opening, and auspicious commencement sankalp."),
            ("Maha Mrityunjaya Japa & Homa", "maha-mrityunjaya-japa", "Lord Shiva", "🔱", Decimal("5100.00"), 120,
             "Health rejuvenation, long life, and spiritual protection through 11,000 japas."),
            ("Kanakadhara Lakshmi Puja", "kanakadhara-lakshmi-puja", "Goddess Lakshmi", "🪔", Decimal("3100.00"), 60,
             "Wealth attraction, financial stability, and auspicious abundance invocation."),
        ]

        puja_map = {}
        for name, slug, deity, icon, price, duration, desc in puja_services_data:
            puja = PujaService.query.filter((PujaService.slug == slug) | (PujaService.name == name)).first()
            if not puja:
                puja = PujaService(
                    name=name,
                    slug=slug,
                    deity=deity,
                    icon=icon,
                    price=price,
                    duration_minutes=duration,
                    description=desc,
                    is_online_available=True,
                    is_offline_available=True,
                    inclusions=["Vedic Pandit Ji", "Live Video Stream", "Consecrated Prasad Delivery"],
                )
                db.session.add(puja)
                db.session.flush()
            else:
                puja.name = name
                puja.slug = slug
                puja.deity = deity
                puja.icon = icon
                puja.price = price
                puja.duration_minutes = duration
                puja.description = desc
            puja_map[name] = puja



        # 9. Upcoming Appointments from Reference Image:
        # Apr 28, 2024 10:00 AM | Maha Ganapati Puja | Anita Deshmukh | Puja | Confirmed
        # Apr 28, 2024 01:00 PM | Kundali Consultation | Rahul Patil | Consultation | Confirmed
        # Apr 29, 2024 09:00 AM | Navagraha Shanti Puja | Meera Kulkarni | Puja | Pending
        # Apr 29, 2024 04:00 PM | Career Guidance | Sagar Joshi | Consultation | Confirmed
        # Apr 30, 2024 11:00 AM | Satyanarayan Puja | Priya Sharma | Puja | Confirmed
        pujas_to_seed = [
            ("Maha Ganapati Puja", "Anita Deshmukh", date(2024, 4, 28), "10:00 AM", "confirmed", "Pandit Radheshyam"),
            ("Navagraha Shanti Puja", "Meera Kulkarni", date(2024, 4, 29), "09:00 AM", "pending", "Pandit Ji"),
            ("Satyanarayan Puja", "Priya Sharma", date(2024, 4, 30), "11:00 AM", "confirmed", "Acharya Vidyadhar"),
        ]

        for s_name, c_name, b_date, t_slot, b_status, priest in pujas_to_seed:
            existing = PujaBooking.query.filter_by(customer_name=c_name, booking_date=b_date).first()
            if not existing:
                svc = puja_map.get(s_name)
                b = PujaBooking(
                    booking_number=f"#PUJ-2024-{len(PujaBooking.query.all())+1:03d}",
                    service_id=svc.id if svc else 1,
                    customer_name=c_name,
                    customer_email=f"{c_name.lower().replace(' ', '.')}@gmail.com",
                    customer_phone="+91 98200 12345",
                    gotra="Kashyap",
                    nakshatra="Rohini",
                    booking_date=b_date,
                    time_slot=t_slot,
                    booking_type="online",
                    priest_name=priest,
                    status=b_status,
                    amount_paid=svc.price if svc else Decimal("2100.00"),
                )
                db.session.add(b)

        # 10. Consultations from Reference Image:
        # Apr 28, 2024 01:00 PM | Kundali Consultation | Rahul Patil | Consultation | Confirmed
        # Apr 29, 2024 04:00 PM | Career Guidance | Sagar Joshi | Consultation | Confirmed
        consultations_to_seed = [
            ("Rahul Patil", "Kundali Consultation", datetime(2024, 4, 28, 13, 0, tzinfo=timezone.utc), "confirmed", "1:00 PM"),
            ("Sagar Joshi", "Career Guidance", datetime(2024, 4, 29, 16, 0, tzinfo=timezone.utc), "confirmed", "4:00 PM"),
            ("Vikram Mehta", "Marriage Matchmaking (Kundali Milan)", datetime(2024, 5, 2, 11, 0, tzinfo=timezone.utc), "pending", "11:00 AM"),
            ("Ananya Roy", "Gemstone Recommendation (Ratna)", datetime(2024, 5, 3, 14, 0, tzinfo=timezone.utc), "pending", "2:00 PM"),
            ("Deepak Rao", "Kalsarpa Dosha Nivarana", datetime(2024, 5, 4, 15, 0, tzinfo=timezone.utc), "pending", "3:00 PM"),
        ]

        for c_name, topic, sched_dt, status, t_str in consultations_to_seed:
            existing = JyotishConsultation.query.filter_by(customer_name=c_name, topic=topic).first()
            if not existing:
                c = JyotishConsultation(
                    consultation_number=f"#JYT-2024-{len(JyotishConsultation.query.all())+1:03d}",
                    customer_name=c_name,
                    customer_email=f"{c_name.lower().replace(' ', '.')}@gmail.com",
                    customer_phone="+91 98111 22233",
                    dob=date(1992, 7, 14),
                    tob="07:35 AM",
                    pob="Pune, Maharashtra",
                    topic=topic,
                    consultation_type="online_video",
                    scheduled_at=sched_dt,
                    status=status,
                    astrologer_name="Acharya Shastri Ji",
                    astrologer_notes="Lagna is Leo. Sun is in 11th house. Favorable Jupiter transit in 9th house.",
                    amount_paid=Decimal("1500.00"),
                )
                db.session.add(c)

        # 11. Customer Enquiries (4 open to match screenshot Pending Actions "Enquiries to Respond: 4")
        enquiries_data = [
            ("Ramesh Varma", "ramesh.v@gmail.com", "Rudraksha Authenticity Certificate", "How can I verify the lab certificate of the 5 mukhi Nepali Rudraksha?"),
            ("Sunita Aggarwal", "sunita.a@yahoo.com", "Puja Samagri Delivery Timing", "Does the samagri kit reach before the morning muhurat in Delhi?"),
            ("Kavita Nair", "kavita.n@gmail.com", "Online Live Puja Streaming Link", "Can family members join from abroad on Google Meet during Sankalp?"),
            ("Gaurav Sharma", "gaurav.s@gmail.com", "Gemstone Ring Customization", "Can I order Yellow Sapphire ring in Panchdhatu instead of gold?"),
        ]
        for name, email, subj, msg in enquiries_data:
            if not CustomerEnquiry.query.filter_by(email=email, subject=subj).first():
                eq = CustomerEnquiry(
                    enquiry_number=f"#ENQ-{len(CustomerEnquiry.query.all())+1:03d}",
                    name=name,
                    email=email,
                    subject=subj,
                    message=msg,
                    status="open",
                )
                db.session.add(eq)

        # 12. Product Reviews (5 pending to match screenshot Pending Actions "Product Reviews: 5")
        reviews_data = [
            ("RM-005", "Girish Rao", 5, "Felt deeply peaceful after wearing the Nepali 5 mukhi mala. Authentic quality.", False),
            ("BD-002", "Pooja Hegde", 5, "Exquisite brass craftsmanship. Perfect weight and glow in our temple.", False),
            ("INC-001", "Mahesh Iyer", 5, "Divine temple aroma. Pure Mysore sandalwood without any synthetic chemicals.", False),
            ("PK-010", "Radha Bhatt", 4, "Everything needed for Satyanarayan puja was carefully packaged and labeled.", False),
            ("RAT-001", "Aditya Sen", 5, "Astrological results are evident within 2 weeks of wearing as per Acharya's muhurat.", False),
        ]
        for sku, reviewer, rating, comment, is_appr in reviews_data:
            prod = prod_map.get(sku)
            if prod and not ProductReview.query.filter_by(customer_name=reviewer, product_id=prod.id).first():
                pr = ProductReview(
                    product_id=prod.id,
                    customer_name=reviewer,
                    rating=rating,
                    comment=comment,
                    is_approved=is_appr,
                    is_verified_purchase=True,
                )
                db.session.add(pr)

        # 13. Payment Verifications (2 pending to match screenshot Pending Actions "Payment Verifications: 2")
        payments_data = [
            ("TXN-NEFT-2024-001", Decimal("3500.00"), "BankTransfer", "pending", "Meera Kulkarni"),
            ("TXN-NEFT-2024-002", Decimal("18500.00"), "BankTransfer", "pending", "Nikhil Kale"),
            ("TXN-RZP-2024-003", Decimal("2499.00"), "Razorpay", "captured", "Amit Bhosle"),
            ("TXN-RZP-2024-004", Decimal("1299.00"), "Razorpay", "captured", "Sneha Kulkarni"),
        ]
        for txn_num, amt, gw, st, cust_n in payments_data:
            if not PaymentTransaction.query.filter_by(transaction_number=txn_num).first():
                pt = PaymentTransaction(
                    transaction_number=txn_num,
                    amount=amt,
                    currency="INR",
                    gateway=gw,
                    status=st,
                    customer_name=cust_n,
                )
                db.session.add(pt)

        # 14. Coupons & Settings
        if not Coupon.query.filter_by(code="DIWALI108").first():
            c1 = Coupon(code="DIWALI108", discount_type="percentage", discount_value=Decimal("15.00"), min_order_amount=Decimal("1000.00"), max_uses=500, is_active=True)
            db.session.add(c1)

        if not Coupon.query.filter_by(code="WELCOME10").first():
            c2 = Coupon(
                code="WELCOME10",
                discount_type="percentage",
                discount_value=Decimal("10.00"),
                min_order_amount=Decimal("0.00"),
                max_discount_amount=None,
                max_uses=10000,
                is_active=True
            )
            db.session.add(c2)

        settings_defaults = {
            "store_name": "Spiritual Commerce Admin",
            "store_tagline": "Seva · Sanskriti · Samṛddhi",
            "support_email": "support@japam.in",
            "support_phone": "+91 80000 10808",
            "default_currency": "INR (₹)",
            "business_timezone": "Asia/Kolkata (IST)",
            "tax_percentage": "3.0",
            "low_stock_default_threshold": "10",
            "maintenance_mode": "false",
        }
        for k, v in settings_defaults.items():
            if not SystemSetting.query.filter_by(key=k).first():
                db.session.add(SystemSetting(key=k, value=v))

        # 15. Authentic Devotee Testimonials
        testimonials_seed = [
            ("Anjali Deshmukh", "Pune", 5, "गृहप्रवेश पूजा",
             "Puja arrangement was very systematic. Panditji arrived on time, all samagri was prepared properly, and the entire vidhi was explained step by step. Highly recommended."),
            ("Rohit Kulkarni", "Mumbai", 5, "Career Consultation",
             "Consultation was explained very clearly. Guruji took time to study my kundali and explained everything in simple language. No unnecessary fear-mongering."),
            ("Shweta Joshi", "Nashik", 5, "5 Mukhi Rudraksha",
             "Rudraksha quality and guidance were excellent. Got proper certification and clear instructions on how to wear and care. Very authentic experience."),
            ("Vikram Patil", "Thane", 5, "Shri Yantra",
             "Ordered a Shri Yantra with pran-pratishtha. The follow-up guidance call after delivery was a wonderful touch. Truly a premium spiritual service."),
        ]
        for d_name, city, rating, svc, blessing in testimonials_seed:
            if not Testimonial.query.filter_by(devotee_name=d_name).first():
                t = Testimonial(
                    devotee_name=d_name,
                    devotee_city=city,
                    rating=rating,
                    service_or_product=svc,
                    blessing_text=blessing,
                    is_approved=True,
                )
                db.session.add(t)

        # 16. Authentic Blog / Spiritual Wisdom Articles
        blogs_seed = [
            ("5 मुखी रुद्राक्षाचे पारंपरिक महत्त्व", "5-mukhi-rudraksha-importance", "Rudraksha",
             "शिवाच्या अश्रूंपासून जन्मलेला 5 मुखी रुद्राक्ष — कल्याण, शांती आणि सत्याचे प्रतीक. हा रुद्राक्ष गुरु ग्रहाशी संबंधित असून मनःशांती आणि सकारात्मक ऊर्जा प्रदान करतो.",
             "शिवाच्या अश्रूंपासून जन्मलेला 5 मुखी रुद्राक्ष — कल्याण, शांती आणि सत्याचे प्रतीक."),
            ("रत्न निवडताना काय पाहावे?", "how-to-choose-gemstones", "Ratna",
             "प्रत्येक रत्न सर्वांसाठी योग्य नसते. कुंडली, ग्रह स्थिती आणि जीवनशैली विचारात घेऊन रत्न कसे निवडावे. योग्य रंगाचे, दोषांशिवाय आणि शास्त्रोक्त पद्धतीने अभिमंत्रित रत्नच धारण करावे.",
             "प्रत्येक रत्न सर्वांसाठी योग्य नसते. कुंडली, ग्रह स्थिती आणि जीवनशैली विचारात घेऊन रत्न कसे निवडावे."),
            ("श्री यंत्र म्हणजे काय?", "what-is-shri-yantra", "Yantra",
             "लक्ष्मीचे प्रतीक श्री यंत्र — कसे तयार होते, कसे स्थापित करावे आणि घरात कुठे ठेवावे. श्री यंत्राची उपासना आर्थिक स्थैर्य आणि घरातील नकारात्मक ऊर्जा दूर करण्यासाठी केली जाते.",
             "लक्ष्मीचे प्रतीक श्री यंत्र — कसे तयार होते, कसे स्थापित करावे आणि घरात कुठे ठेवावे."),
            ("रुद्राभिषेकाचे महत्त्व", "rudrabhishek-significance", "Puja",
             "आरोग्य, मनःशांती आणि आध्यात्मिक उन्नतीसाठी रुद्राभिषेक का केला जातो — शास्त्र आणि पद्धत. शिवलिंगावर दुग्ध, जल, मध आणि बिल्वपत्राने शास्त्रोक्त अभिषेक केल्याने जीवनातील संकटांचा नाश होतो.",
             "आरोग्य, मनःशांती आणि आध्यात्मिक उन्नतीसाठी रुद्राभिषेक का केला जातो — शास्त्र आणि पद्धत."),
        ]
        for title, slug, cat, body, excerpt in blogs_seed:
            if not BlogPost.query.filter_by(slug=slug).first():
                post = BlogPost(
                    title=title,
                    slug=slug,
                    category=cat,
                    content=body,
                    excerpt=excerpt,
                    author_name="Nagesh Guruji Sansthan",
                    is_published=True,
                )
                db.session.add(post)

        # 17. Sacred Banners
        banners_seed = [
            ("परंपरेतून मार्गदर्शन • श्रद्धेतून समाधान",
             "Authentic Rudraksha · Certified Gemstones · Sacred Yantra · Jyotish Consultation",
             "hero", "/static/img/hero-banner.jpg", "#shop", "Explore Collection →", 1),
            ("सर्व उत्पादनांवर मोफत शिपिंग (₹999+) आणि वैदिक अभिमंत्रित प्रसाद",
             "संपूर्ण महाराष्ट्रात व भारतात सुरक्षित कुरिअर द्वारे होम डिलिव्हरी",
             "topbar", None, "#shop", "खरेदी करा", 2),
        ]
        for b_title, b_sub, b_pos, b_img, b_link, b_btn, b_order in banners_seed:
            if not Banner.query.filter_by(title=b_title).first():
                banner = Banner(
                    title=b_title,
                    subtitle=b_sub,
                    position=b_pos,
                    image_url=b_img,
                    link_url=b_link,
                    button_text=b_btn,
                    sort_order=b_order,
                    is_active=True,
                )
                db.session.add(banner)

        # 18. Guruji Profile
        guruji = GurujiProfile.query.first()
        if not guruji:
            guruji = GurujiProfile(
                full_title="प.पू. नागेश गुरुजी (Nagesh Guruji)",
                spiritual_lineage="वेदशास्त्र संपन्न • २५+ वर्षांची साधना व ज्योतिष मार्गदर्शन",
                bio="श्रद्धेतून समाधान, परंपरेतून मार्गदर्शन. सनातन वैदिक परंपरा, सिद्ध रुद्राक्ष, प्रामाणिक रत्न आणि शास्त्रोक्त पूजा विधींद्वारे सहस्रो भक्तांचे जीवन प्रकाशित करणारे आदरणीय मार्गदर्शक.",
                darshan_timings="सोमवार ते शनिवार: सकाळी ९ ते दुपारी १ व संध्याकाळी ४ ते ८",
                ashram_address="सद्गुरू कृपा, वैदिक साधना केंद्र, पुणे / नाशिक, महाराष्ट्र",
                contact_phone="+91 98220 00000",
                contact_email="seva@nageshguruji.com",
            )
            db.session.add(guruji)

        # Commit everything
        db.session.commit()
        print("[SUCCESS] Database successfully seeded with authentic spiritual commerce records!")



if __name__ == "__main__":
    seed_database()
