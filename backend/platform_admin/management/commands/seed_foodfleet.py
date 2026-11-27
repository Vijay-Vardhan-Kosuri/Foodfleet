from datetime import timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from accounts.models import Address, CustomerProfile, DeliveryPartnerProfile, Role, User
from delivery.models import DeliveryAssignment
from notifications.models import Notification
from orders.models import Coupon, Order, OrderItem, OrderStatusHistory
from payments.models import Payment
from platform_admin.models import PlatformConfig
from restaurants.models import (
    CuisineCategory,
    FoodCategory,
    FoodItem,
    RestaurantAddress,
    RestaurantOperatingHours,
    RestaurantProfile,
)
from reviews.models import Review

PHOTO_PIZZA = "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80"
PHOTO_BURGER = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80"
PHOTO_PASTA = "https://images.unsplash.com/photo-1621996346565-e3d5d6281298?auto=format&fit=crop&w=900&q=80"
PHOTO_BIRYANI = "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=80"
PHOTO_SUSHI = "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80"
PHOTO_DINING = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80"
PHOTO_CAFE = "https://images.unsplash.com/photo-1556742205-e10c9486e506?auto=format&fit=crop&w=900&q=80"
PHOTO_LOUNGE = "https://images.unsplash.com/photo-1556742517-fde6c2abbe11?auto=format&fit=crop&w=900&q=80"


class Command(BaseCommand):
    help = "Seed FoodFleet with realistic demo accounts, restaurants, menus, coupons, and sample orders."

    @transaction.atomic
    def handle(self, *args, **options):
        PlatformConfig.get_solo()

        # 1. Users for all 4 roles
        admin_user, _ = User.objects.get_or_create(
            email="admin@foodfleet.dev",
            defaults={
                "username": "superadmin",
                "first_name": "Aarav",
                "last_name": "Mehta",
                "phone": "+919800000001",
                "role": Role.SUPER_ADMIN,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        admin_user.set_password("Password123!")
        admin_user.save()

        customer_user, _ = User.objects.get_or_create(
            email="customer@foodfleet.dev",
            defaults={
                "username": "customer_demo",
                "first_name": "Ananya",
                "last_name": "Rao",
                "phone": "+919800000002",
                "role": Role.CUSTOMER,
            },
        )
        customer_user.set_password("Password123!")
        customer_user.save()
        CustomerProfile.objects.get_or_create(user=customer_user, defaults={"default_city": "Bengaluru"})

        Address.objects.get_or_create(
            user=customer_user,
            label="Home",
            defaults={
                "street_address": "42, 100 Feet Road, Indiranagar",
                "apartment": "Apt 4B, Maple Crest",
                "city": "Bengaluru",
                "state": "Karnataka",
                "postal_code": "560038",
                "latitude": Decimal("12.978369"),
                "longitude": Decimal("77.640836"),
                "is_default": True,
            },
        )

        owner_specs = [
            ("owner@foodfleet.dev", "owner_main", "Vikram", "Kapoor", "+919800000003"),
            ("owner2@foodfleet.dev", "owner_bistro", "Elena", "D'Souza", "+919800000005"),
            ("owner3@foodfleet.dev", "owner_tokyo", "Kenji", "Sato", "+919800000006"),
            ("owner4@foodfleet.dev", "owner_spice", "Farhan", "Qureshi", "+919800000007"),
            ("owner5@foodfleet.dev", "owner_pending", "Meera", "Nair", "+919800000008"),
        ]
        owners = []
        for email, uname, fn, ln, phone in owner_specs:
            u, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": uname,
                    "first_name": fn,
                    "last_name": ln,
                    "phone": phone,
                    "role": Role.RESTAURANT_OWNER,
                },
            )
            u.set_password("Password123!")
            u.save()
            owners.append(u)

        rider_user, _ = User.objects.get_or_create(
            email="rider@foodfleet.dev",
            defaults={
                "username": "rider_demo",
                "first_name": "Rohan",
                "last_name": "Verma",
                "phone": "+919800000004",
                "role": Role.DELIVERY_PARTNER,
            },
        )
        rider_user.set_password("Password123!")
        rider_user.save()
        rider_profile, _ = DeliveryPartnerProfile.objects.get_or_create(
            user=rider_user,
            defaults={
                "vehicle_type": "Electric Scooter",
                "vehicle_number": "KA-03-FF-2026",
                "license_number": "DL-KA03-991827",
                "verification_status": DeliveryPartnerProfile.VerificationStatus.VERIFIED,
                "availability_status": DeliveryPartnerProfile.AvailabilityStatus.AVAILABLE,
                "current_lat": Decimal("12.971891"),
                "current_lng": Decimal("77.641154"),
                "total_deliveries": 148,
                "rating_avg": Decimal("4.92"),
            },
        )

        # 2. Cuisines
        cuisine_data = [
            ("Artisan Pizza", "Wood-fired sourdough & Neapolitan pies", PHOTO_PIZZA),
            ("Gourmet Burgers", "Smash patties, brioche buns & craft sauces", PHOTO_BURGER),
            ("Royal Biryani", "Slow-cooked dum biryanis & heritage kebabs", PHOTO_BIRYANI),
            ("Italian Pasta", "Handmade pasta, ragu & truffle sauces", PHOTO_PASTA),
            ("Japanese Sushi", "Fresh nigiri, maki rolls & izakaya plates", PHOTO_SUSHI),
            ("Specialty Cafe", "Single-origin brews & patisserie pairings", PHOTO_CAFE),
        ]
        cuisines = {}
        for name, desc, img in cuisine_data:
            c, _ = CuisineCategory.objects.get_or_create(
                name=name, defaults={"description": desc, "image_url": img, "is_active": True}
            )
            cuisines[name] = c

        # 3. Restaurants + Menus
        restaurants_spec = [
            {
                "owner": owners[0],
                "name": "Forno & Hearth",
                "desc": "Wood-fired Neapolitan sourdough pizzas, handmade pasta, and Tuscan small plates crafted with 48-hour fermented dough.",
                "cuisines": ["Artisan Pizza", "Italian Pasta"],
                "image_url": PHOTO_PIZZA,
                "status": RestaurantProfile.ApprovalStatus.APPROVED,
                "featured": True,
                "rating": Decimal("4.85"),
                "reviews": 312,
                "time": 26,
                "fee": Decimal("30.00"),
                "min_order": Decimal("199.00"),
                "p2": Decimal("750.00"),
                "addr": ("18, Church Street, Shanthala Nagar", "Bengaluru", "Karnataka", "560001", "12.975150", "77.604120"),
                "menu": [
                    ("Wood-Fired Pizzas", [
                        ("Margherita Bufala", "San Marzano tomatoes, fior di latte mozzarella, fresh sweet basil & EVOO.", "420.00", "379.00", PHOTO_PIZZA, True, "MILD"),
                        ("Truffle Funghi Bianca", "Wild roasted mushrooms, ricotta crema, aged parmesan & white truffle oil.", "540.00", None, PHOTO_PIZZA, True, "MILD"),
                        ("Diavola Hot Honey", "Artisanal pepperoni, pickled jalapeños, charred crust & chilli blossom honey.", "580.00", "520.00", PHOTO_PIZZA, False, "SPICY"),
                    ]),
                    ("Handmade Pastas", [
                        ("Arrabbiata Rigatoni", "Slow-simmered spicy Calabrian tomato sauce with roasted garlic & pecorino.", "390.00", None, PHOTO_PASTA, True, "MEDIUM"),
                        ("Pesto Genovese Tagliatelle", "Basil pine-nut emulsion, toasted almonds & burrata heart.", "440.00", None, PHOTO_PASTA, True, "MILD"),
                    ]),
                ],
            },
            {
                "owner": owners[1],
                "name": "Copper & Brioche",
                "desc": "Double-seared smash burgers, crispy buttermilk tenders, and smoky truffle fries served piping hot.",
                "cuisines": ["Gourmet Burgers", "Specialty Cafe"],
                "image_url": PHOTO_BURGER,
                "status": RestaurantProfile.ApprovalStatus.APPROVED,
                "featured": True,
                "rating": Decimal("4.74"),
                "reviews": 228,
                "time": 22,
                "fee": Decimal("25.00"),
                "min_order": Decimal("149.00"),
                "p2": Decimal("550.00"),
                "addr": ("77, Koramangala 4th Block", "Bengaluru", "Karnataka", "560034", "12.935192", "77.624481"),
                "menu": [
                    ("Signature Smash Burgers", [
                        ("Classic Copper Smash", "Double smashed patty, aged cheddar, caramelized onions & house burger sauce.", "340.00", "299.00", PHOTO_BURGER, False, "MEDIUM"),
                        ("Truffle Portobello Melt", "Charred portobello steak, gruyere cheese, crispy shallots & herb aioli.", "330.00", None, PHOTO_BURGER, True, "MILD"),
                        ("Nashville Crispy Heat", "Crisp spiced fillet, dill pickles & smoky cayenne glaze on toasted brioche.", "360.00", None, PHOTO_BURGER, False, "EXTRA_SPICY"),
                    ]),
                ],
            },
            {
                "owner": owners[2],
                "name": "Kuro Izakaya & Sushi",
                "desc": "Precision-cut sashimi, hand-torched aburi maki rolls, and slow-simmered Tokyo comfort bowls.",
                "cuisines": ["Japanese Sushi"],
                "image_url": PHOTO_SUSHI,
                "status": RestaurantProfile.ApprovalStatus.APPROVED,
                "featured": True,
                "rating": Decimal("4.91"),
                "reviews": 194,
                "time": 34,
                "fee": Decimal("45.00"),
                "min_order": Decimal("299.00"),
                "p2": Decimal("1100.00"),
                "addr": ("12, Lavelle Road", "Bengaluru", "Karnataka", "560001", "12.969800", "77.597900"),
                "menu": [
                    ("Maki & Nigiri Platters", [
                        ("Aburi Salmon Dragon Roll", "Torched Atlantic salmon, avocado, cucumber & yuzu tobiko.", "690.00", "640.00", PHOTO_SUSHI, False, "MILD"),
                        ("Crispy Shiitake & Avocado Roll", "Tempura shiitake, pickled daikon, sesame & sweet soy reduction.", "480.00", None, PHOTO_SUSHI, True, "MILD"),
                    ]),
                ],
            },
            {
                "owner": owners[3],
                "name": "Nizam's Saffron Kitchen",
                "desc": "Heirloom Hyderabadi & Lucknowi dum biryanis sealed in clay handis with aged basmati and saffron.",
                "cuisines": ["Royal Biryani"],
                "image_url": PHOTO_BIRYANI,
                "status": RestaurantProfile.ApprovalStatus.APPROVED,
                "featured": True,
                "rating": Decimal("4.78"),
                "reviews": 410,
                "time": 28,
                "fee": Decimal("30.00"),
                "min_order": Decimal("179.00"),
                "p2": Decimal("650.00"),
                "addr": ("5, Residency Road, Ashok Nagar", "Bengaluru", "Karnataka", "560025", "12.971000", "77.601200"),
                "menu": [
                    ("Handi Dum Biryanis", [
                        ("Royal Hyderabadi Chicken Dum Biryani", "Saffron basmati, bone-in spiced chicken, mint, burani raita & mirchi ka salan.", "380.00", "349.00", PHOTO_BIRYANI, False, "SPICY"),
                        ("Subz Zafrani Handi Biryani", "Charred paneer, baby potatoes, caramelized onions & rosewater saffron rice.", "320.00", None, PHOTO_BIRYANI, True, "MEDIUM"),
                    ]),
                ],
            },
            {
                "owner": owners[4],
                "name": "The Olive Veranda",
                "desc": "Mediterranean mezze bowls and coastal sourdough flatbreads (Pending Super Admin verification).",
                "cuisines": ["Specialty Cafe"],
                "image_url": PHOTO_LOUNGE,
                "status": RestaurantProfile.ApprovalStatus.PENDING,
                "featured": False,
                "rating": Decimal("4.50"),
                "reviews": 0,
                "time": 30,
                "fee": Decimal("35.00"),
                "min_order": Decimal("199.00"),
                "p2": Decimal("600.00"),
                "addr": ("91, Indiranagar 12th Main", "Bengaluru", "Karnataka", "560038", "12.971200", "77.638200"),
                "menu": [],
            },
        ]

        created_restaurants = []
        for spec in restaurants_spec:
            rest, _ = RestaurantProfile.objects.get_or_create(
                owner=spec["owner"],
                defaults={
                    "name": spec["name"],
                    "description": spec["desc"],
                    "phone": spec["owner"].phone,
                    "email": spec["owner"].email,
                    "image_url": spec["image_url"],
                    "approval_status": spec["status"],
                    "is_open": True,
                    "is_featured": spec["featured"],
                    "average_rating": spec["rating"],
                    "total_reviews": spec["reviews"],
                    "avg_delivery_time_mins": spec["time"],
                    "delivery_fee": spec["fee"],
                    "min_order_amount": spec["min_order"],
                    "price_for_two": spec["p2"],
                },
            )
            rest.cuisines.set([cuisines[cname] for cname in spec["cuisines"]])
            street, city, state, pin, lat, lng = spec["addr"]
            RestaurantAddress.objects.get_or_create(
                restaurant=rest,
                defaults={
                    "street_address": street,
                    "city": city,
                    "state": state,
                    "postal_code": pin,
                    "latitude": Decimal(lat),
                    "longitude": Decimal(lng),
                },
            )
            for day in range(7):
                RestaurantOperatingHours.objects.get_or_create(restaurant=rest, day_of_week=day)

            for cat_name, items in spec["menu"]:
                cat, _ = FoodCategory.objects.get_or_create(restaurant=rest, name=cat_name)
                for fname, fdesc, fprice, fdisc, fimg, fveg, fspice in items:
                    FoodItem.objects.get_or_create(
                        restaurant=rest,
                        name=fname,
                        defaults={
                            "category": cat,
                            "description": fdesc,
                            "price": Decimal(fprice),
                            "discount_price": Decimal(fdisc) if fdisc else None,
                            "image_url": fimg,
                            "is_vegetarian": fveg,
                            "is_available": True,
                            "spice_level": fspice,
                            "order_count": 42,
                        },
                    )
            created_restaurants.append(rest)

        # 4. Coupons
        now = timezone.now()
        Coupon.objects.get_or_create(
            code="FLEET20",
            defaults={
                "description": "20% off on orders above ₹299 (up to ₹150)",
                "discount_type": Coupon.DiscountType.PERCENTAGE,
                "discount_value": Decimal("20.00"),
                "min_order_amount": Decimal("299.00"),
                "max_discount_amount": Decimal("150.00"),
                "valid_from": now - timedelta(days=5),
                "valid_until": now + timedelta(days=90),
                "is_active": True,
            },
        )
        Coupon.objects.get_or_create(
            code="WELCOME100",
            defaults={
                "description": "Flat ₹100 off on orders above ₹499",
                "discount_type": Coupon.DiscountType.FIXED,
                "discount_value": Decimal("100.00"),
                "min_order_amount": Decimal("499.00"),
                "valid_from": now - timedelta(days=5),
                "valid_until": now + timedelta(days=90),
                "is_active": True,
            },
        )

        # 5. Sample completed order + active order if none exist yet
        if not Order.objects.exists():
            forno = created_restaurants[0]
            item1 = forno.food_items.first()
            delivered_order = Order.objects.create(
                order_number="FF-DEMO1001",
                customer=customer_user,
                restaurant=forno,
                status=Order.Status.DELIVERED,
                payment_status=Order.PaymentStatus.PAID,
                payment_method=Order.PaymentMethod.SIMULATED_CARD,
                subtotal=Decimal("758.00"),
                tax_amount=Decimal("37.90"),
                delivery_fee=Decimal("30.00"),
                discount_amount=Decimal("0.00"),
                total_amount=Decimal("825.90"),
                platform_commission=Decimal("113.70"),
                restaurant_payout=Decimal("644.30"),
                delivery_address_snapshot={
                    "label": "Home",
                    "street_address": "42, 100 Feet Road, Indiranagar",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "postal_code": "560038",
                },
                delivery_lat=Decimal("12.978369"),
                delivery_lng=Decimal("77.640836"),
            )
            if item1:
                OrderItem.objects.create(
                    order=delivered_order,
                    food_item=item1,
                    food_name_snapshot=item1.name,
                    unit_price_snapshot=item1.effective_price,
                    quantity=2,
                    total_price=item1.effective_price * 2,
                )
            OrderStatusHistory.objects.create(
                order=delivered_order,
                from_status="",
                to_status=Order.Status.DELIVERED,
                changed_by=rider_user,
                actor_role=Role.DELIVERY_PARTNER,
                notes="Delivered safely.",
            )
            Payment.objects.create(
                order=delivered_order,
                customer=customer_user,
                gateway=Payment.Gateway.SIMULATED,
                gateway_order_id="ff_gw_demo1001",
                gateway_payment_id="pay_demo1001",
                amount=delivered_order.total_amount,
                status=Payment.Status.VERIFIED,
            )
            DeliveryAssignment.objects.create(
                order=delivered_order,
                delivery_partner=rider_profile,
                status=DeliveryAssignment.Status.DELIVERED,
                delivery_fee_earned=Decimal("45.00"),
                delivered_at=now - timedelta(hours=3),
            )
            Review.objects.create(
                order=delivered_order,
                customer=customer_user,
                restaurant=forno,
                rating=5,
                delivery_rating=5,
                comment="Crust stayed crisp on arrival and delivery was super fast!",
            )

            # Second order currently ready/active so dashboards look alive immediately
            copper = created_restaurants[1]
            item2 = copper.food_items.first()
            active_order = Order.objects.create(
                order_number="FF-DEMO1002",
                customer=customer_user,
                restaurant=copper,
                status=Order.Status.READY_FOR_PICKUP,
                payment_status=Order.PaymentStatus.PAID,
                payment_method=Order.PaymentMethod.UPI,
                subtotal=Decimal("598.00"),
                tax_amount=Decimal("29.90"),
                delivery_fee=Decimal("25.00"),
                discount_amount=Decimal("0.00"),
                total_amount=Decimal("652.90"),
                platform_commission=Decimal("89.70"),
                restaurant_payout=Decimal("508.30"),
                delivery_address_snapshot={
                    "label": "Home",
                    "street_address": "42, 100 Feet Road, Indiranagar",
                    "city": "Bengaluru",
                    "state": "Karnataka",
                    "postal_code": "560038",
                },
                delivery_lat=Decimal("12.978369"),
                delivery_lng=Decimal("77.640836"),
            )
            if item2:
                OrderItem.objects.create(
                    order=active_order,
                    food_item=item2,
                    food_name_snapshot=item2.name,
                    unit_price_snapshot=item2.effective_price,
                    quantity=2,
                    total_price=item2.effective_price * 2,
                )
            OrderStatusHistory.objects.create(
                order=active_order,
                from_status="",
                to_status=Order.Status.PLACED,
                changed_by=customer_user,
                actor_role=Role.CUSTOMER,
                notes="Order placed.",
            )
            OrderStatusHistory.objects.create(
                order=active_order,
                from_status=Order.Status.PLACED,
                to_status=Order.Status.READY_FOR_PICKUP,
                changed_by=owners[1],
                actor_role=Role.RESTAURANT_OWNER,
                notes="Order packed and ready for rider pickup.",
            )
            Payment.objects.create(
                order=active_order,
                customer=customer_user,
                gateway=Payment.Gateway.SIMULATED,
                gateway_order_id="ff_gw_demo1002",
                gateway_payment_id="pay_demo1002",
                amount=active_order.total_amount,
                status=Payment.Status.VERIFIED,
            )
            DeliveryAssignment.objects.create(
                order=active_order,
                delivery_partner=rider_profile,
                status=DeliveryAssignment.Status.ASSIGNED,
                delivery_fee_earned=Decimal("40.00"),
            )
            Notification.objects.create(
                recipient=rider_user,
                title="New Delivery Assignment: FF-DEMO1002",
                message="Pickup from Copper & Brioche is ready.",
                notification_type="DELIVERY_ASSIGNED",
                related_order_id=active_order.id,
            )

        self.stdout.write(self.style.SUCCESS("FoodFleet demo dataset seeded successfully."))
