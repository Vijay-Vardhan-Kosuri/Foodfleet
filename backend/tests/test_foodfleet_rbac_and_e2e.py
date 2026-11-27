import os
os.environ.setdefault("DB_ENGINE", "sqlite")

import pytest
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from accounts.models import Address, DeliveryPartnerProfile, Role, User
from orders.models import Coupon, Order
from restaurants.models import CuisineCategory, FoodCategory, FoodItem, RestaurantProfile


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def setup_actors(db):
    admin = User.objects.create_user(
        username="admin_t", email="admin_t@foodfleet.dev", password="Password123!", role=Role.SUPER_ADMIN
    )
    customer1 = User.objects.create_user(
        username="cust1_t", email="cust1@foodfleet.dev", password="Password123!", role=Role.CUSTOMER, first_name="CustOne"
    )
    customer2 = User.objects.create_user(
        username="cust2_t", email="cust2@foodfleet.dev", password="Password123!", role=Role.CUSTOMER, first_name="CustTwo"
    )
    owner1 = User.objects.create_user(
        username="owner1_t", email="owner1@foodfleet.dev", password="Password123!", role=Role.RESTAURANT_OWNER
    )
    owner2 = User.objects.create_user(
        username="owner2_t", email="owner2@foodfleet.dev", password="Password123!", role=Role.RESTAURANT_OWNER
    )
    rider1 = User.objects.create_user(
        username="rider1_t", email="rider1@foodfleet.dev", password="Password123!", role=Role.DELIVERY_PARTNER
    )
    rider1_profile = DeliveryPartnerProfile.objects.create(
        user=rider1,
        verification_status=DeliveryPartnerProfile.VerificationStatus.VERIFIED,
        availability_status=DeliveryPartnerProfile.AvailabilityStatus.AVAILABLE,
    )
    rider2 = User.objects.create_user(
        username="rider2_t", email="rider2@foodfleet.dev", password="Password123!", role=Role.DELIVERY_PARTNER
    )
    DeliveryPartnerProfile.objects.create(
        user=rider2,
        verification_status=DeliveryPartnerProfile.VerificationStatus.VERIFIED,
        availability_status=DeliveryPartnerProfile.AvailabilityStatus.AVAILABLE,
    )
    return {
        "admin": admin,
        "customer1": customer1,
        "customer2": customer2,
        "owner1": owner1,
        "owner2": owner2,
        "rider1": rider1,
        "rider1_profile": rider1_profile,
        "rider2": rider2,
    }


@pytest.mark.django_db
def test_auth_register_blocks_super_admin_escalation(api_client):
    res = api_client.post(
        "/api/auth/register/",
        {
            "email": "attacker@foodfleet.dev",
            "password": "Password123!",
            "first_name": "Mallory",
            "role": "SUPER_ADMIN",
        },
        format="json",
    )
    assert res.status_code == 400


@pytest.mark.django_db
def test_complete_end_to_end_order_lifecycle_and_rbac(api_client, setup_actors):
    actors = setup_actors
    admin = actors["admin"]
    cust1 = actors["customer1"]
    cust2 = actors["customer2"]
    owner1 = actors["owner1"]
    owner2 = actors["owner2"]
    rider1 = actors["rider1"]
    rider1_profile = actors["rider1_profile"]
    rider2 = actors["rider2"]

    # 1. Customer registers & adds address
    api_client.force_authenticate(user=cust1)
    addr_res = api_client.post(
        "/api/auth/addresses/",
        {
            "label": "Home",
            "street_address": "10 MG Road",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": "560001",
        },
        format="json",
    )
    assert addr_res.status_code == 201
    addr_id = addr_res.data["id"]

    # Customer cannot access Admin dashboard
    assert api_client.get("/api/admin/dashboard/").status_code == 403

    # 2. Restaurant Owner registers restaurant (starts PENDING)
    api_client.force_authenticate(user=owner1)
    rest_res = api_client.post(
        "/api/restaurants/",
        {
            "name": "Test Bistro",
            "description": "Fresh artisan bowls",
            "phone": "+919999999999",
            "email": "bistro@foodfleet.dev",
            "min_order_amount": "100.00",
            "delivery_fee": "30.00",
            "address": {
                "street_address": "22 Indiranagar",
                "city": "Bengaluru",
                "state": "Karnataka",
                "postal_code": "560038",
            },
        },
        format="json",
    )
    assert rest_res.status_code == 201
    rest_id = rest_res.data["id"]
    assert rest_res.data["approval_status"] == "PENDING"

    # Owner cannot self-approve
    assert api_client.patch(f"/api/admin/restaurants/{rest_id}/approval/", {"approval_status": "APPROVED"}, format="json").status_code == 403

    # 3. Admin approves restaurant
    api_client.force_authenticate(user=admin)
    appr_res = api_client.patch(
        f"/api/admin/restaurants/{rest_id}/approval/",
        {"approval_status": "APPROVED"},
        format="json",
    )
    assert appr_res.status_code == 200
    assert appr_res.data["approval_status"] == "APPROVED"

    # 4. Owner creates category and menu item
    api_client.force_authenticate(user=owner1)
    cat_res = api_client.post("/api/food-categories/", {"name": "Mains"}, format="json")
    assert cat_res.status_code == 201
    cat_id = cat_res.data["id"]

    food_res = api_client.post(
        "/api/food/",
        {
            "category": cat_id,
            "name": "Truffle Pasta",
            "price": "350.00",
            "is_vegetarian": True,
            "is_available": True,
        },
        format="json",
    )
    assert food_res.status_code == 201
    food_id = food_res.data["id"]

    # Owner2 cannot modify Owner1's food item
    api_client.force_authenticate(user=owner2)
    assert api_client.patch(f"/api/food/{food_id}/", {"price": "10.00"}, format="json").status_code in (403, 404)

    # Delivery partner cannot browse restaurant menus
    api_client.force_authenticate(user=rider1)
    assert api_client.get(f"/api/restaurants/{rest_id}/menu/").status_code == 403

    # 5. Customer browses & adds to cart & applies coupon
    Coupon.objects.create(
        code="SAVE50",
        discount_type=Coupon.DiscountType.FIXED,
        discount_value=Decimal("50.00"),
        min_order_amount=Decimal("200.00"),
        valid_from=timezone.now() - timedelta(days=1),
        valid_until=timezone.now() + timedelta(days=10),
    )

    api_client.force_authenticate(user=cust1)
    assert api_client.get(f"/api/restaurants/{rest_id}/menu/").status_code == 200
    cart_res = api_client.post("/api/cart/items/", {"food_item_id": food_id, "quantity": 2}, format="json")
    assert cart_res.status_code == 201
    assert cart_res.data["totals"]["subtotal"] == "700.00"

    coupon_res = api_client.post("/api/cart/coupon/", {"code": "SAVE50"}, format="json")
    assert coupon_res.status_code == 200
    assert coupon_res.data["totals"]["discount_amount"] == "50.00"

    # 6. Customer places order
    order_res = api_client.post(
        "/api/orders/",
        {"address_id": addr_id, "payment_method": "SIMULATED_CARD", "idempotency_key": "idem-order-1"},
        format="json",
    )
    assert order_res.status_code == 201
    order_id = order_res.data["id"]
    assert order_res.data["items"][0]["food_name_snapshot"] == "Truffle Pasta"

    # Duplicate idempotency key returns same order instead of double-ordering
    dup_res = api_client.post(
        "/api/orders/",
        {"address_id": addr_id, "payment_method": "SIMULATED_CARD", "idempotency_key": "idem-order-1"},
        format="json",
    )
    assert dup_res.data["id"] == order_id

    # Customer2 cannot see Customer1's order
    api_client.force_authenticate(user=cust2)
    assert api_client.get(f"/api/orders/{order_id}/").status_code == 404

    # 7. Payment verification required before confirming prepaid order
    api_client.force_authenticate(user=owner1)
    unpaid_confirm = api_client.patch(
        f"/api/orders/{order_id}/status/", {"status": "CONFIRMED"}, format="json"
    )
    assert unpaid_confirm.status_code == 400

    api_client.force_authenticate(user=cust1)
    pay_create = api_client.post("/api/payments/create/", {"order_id": order_id}, format="json")
    assert pay_create.status_code == 201
    pay_verify = api_client.post("/api/payments/verify/", {"order_id": order_id}, format="json")
    assert pay_verify.status_code == 200

    # 8. Restaurant confirms, prepares, and marks ready for pickup
    api_client.force_authenticate(user=owner1)
    assert api_client.patch(f"/api/orders/{order_id}/status/", {"status": "CONFIRMED"}, format="json").status_code == 200
    assert api_client.patch(f"/api/orders/{order_id}/status/", {"status": "PREPARING"}, format="json").status_code == 200
    assert api_client.patch(f"/api/orders/{order_id}/status/", {"status": "READY_FOR_PICKUP"}, format="json").status_code == 200

    # Cannot pick up before delivery partner is assigned
    assert api_client.patch(f"/api/orders/{order_id}/status/", {"status": "PICKED_UP"}, format="json").status_code == 403

    # 9. Admin assigns delivery partner
    api_client.force_authenticate(user=admin)
    assign_res = api_client.post(
        f"/api/admin/orders/{order_id}/assign-delivery/",
        {"delivery_partner_id": rider1_profile.id},
        format="json",
    )
    assert assign_res.status_code == 200
    assignment_id = assign_res.data["delivery_partner"]["assignment_id"]

    # Unassigned rider2 cannot view or accept rider1's assignment
    api_client.force_authenticate(user=rider2)
    assert api_client.get(f"/api/delivery/assignments/{assignment_id}/").status_code == 404

    # 10. Rider1 accepts, arrives, picks up, delivers
    api_client.force_authenticate(user=rider1)
    assert api_client.post(f"/api/delivery/assignments/{assignment_id}/accept/").status_code == 200
    assert api_client.patch(f"/api/delivery/assignments/{assignment_id}/status/", {"status": "ARRIVED_AT_RESTAURANT"}, format="json").status_code == 200
    assert api_client.patch(f"/api/delivery/assignments/{assignment_id}/status/", {"status": "PICKED_UP"}, format="json").status_code == 200
    assert api_client.patch(f"/api/delivery/assignments/{assignment_id}/status/", {"status": "OUT_FOR_DELIVERY"}, format="json").status_code == 200
    assert api_client.patch(f"/api/delivery/assignments/{assignment_id}/status/", {"status": "DELIVERED"}, format="json").status_code == 200

    # 11. Customer reviews completed order
    api_client.force_authenticate(user=cust1)
    rev_res = api_client.post(
        "/api/reviews/",
        {"order": order_id, "rating": 5, "delivery_rating": 5, "comment": "Fantastic service!"},
        format="json",
    )
    assert rev_res.status_code == 201
    order_final = Order.objects.get(pk=order_id)
    assert order_final.status == Order.Status.DELIVERED


@pytest.mark.django_db
def test_paid_order_cancellation_refund_and_admin_suspension(api_client, setup_actors):
    actors = setup_actors
    admin = actors["admin"]
    cust1 = actors["customer1"]
    owner1 = actors["owner1"]

    rest = RestaurantProfile.objects.create(
        owner=owner1,
        name="Refund Kitchen",
        phone="+919000000000",
        email="rk@foodfleet.dev",
        approval_status=RestaurantProfile.ApprovalStatus.APPROVED,
        min_order_amount=Decimal("50.00"),
        delivery_fee=Decimal("20.00"),
    )
    food = FoodItem.objects.create(restaurant=rest, name="Masala Dosa", price=Decimal("120.00"))
    addr = Address.objects.create(
        user=cust1,
        label="Home",
        street_address="12 Church St",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
    )

    api_client.force_authenticate(user=cust1)
    api_client.post("/api/cart/items/", {"food_item_id": food.id, "quantity": 1}, format="json")
    order_res = api_client.post(
        "/api/orders/", {"address_id": addr.id, "payment_method": "UPI"}, format="json"
    )
    order_id = order_res.data["id"]

    api_client.post("/api/payments/create/", {"order_id": order_id}, format="json")
    api_client.post("/api/payments/verify/", {"order_id": order_id}, format="json")

    cancel_res = api_client.patch(
        f"/api/orders/{order_id}/status/",
        {"status": "CANCELLED", "notes": "Ordered wrong item"},
        format="json",
    )
    assert cancel_res.status_code == 200
    assert cancel_res.data["status"] == "REFUND_PENDING"

    # Admin processes refund and checks audit log
    api_client.force_authenticate(user=admin)
    refunds_res = api_client.get("/api/admin/refunds/")
    refund_id = refunds_res.data["results"][0]["id"]
    proc_res = api_client.post(
        f"/api/admin/refunds/{refund_id}/process/", {"decision": "PROCESSED"}, format="json"
    )
    assert proc_res.status_code == 200
    assert proc_res.data["status"] == "PROCESSED"

    # Admin suspends customer1, preventing login
    susp_res = api_client.patch(
        f"/api/admin/users/{cust1.id}/suspend/", {"is_suspended": True}, format="json"
    )
    assert susp_res.status_code == 200
    assert susp_res.data["is_suspended"] is True

    api_client.force_authenticate(user=None)
    login_res = api_client.post(
        "/api/auth/login/", {"email": cust1.email, "password": "Password123!"}, format="json"
    )
    assert login_res.status_code == 400

