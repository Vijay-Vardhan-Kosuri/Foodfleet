from rest_framework import serializers
from restaurants.models import FoodItem
from .models import Cart, CartItem, Coupon, Order, OrderItem, OrderStatusHistory
from .services import compute_cart_totals


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = [
            "id",
            "code",
            "description",
            "discount_type",
            "discount_value",
            "min_order_amount",
            "max_discount_amount",
            "valid_from",
            "valid_until",
            "usage_limit",
            "used_count",
            "is_active",
        ]


class CartItemSerializer(serializers.ModelSerializer):
    food_name = serializers.CharField(source="food_item.name", read_only=True)
    unit_price = serializers.DecimalField(
        source="food_item.effective_price", max_digits=10, decimal_places=2, read_only=True
    )
    is_available = serializers.BooleanField(source="food_item.is_available", read_only=True)
    is_vegetarian = serializers.BooleanField(source="food_item.is_vegetarian", read_only=True)
    image_url = serializers.CharField(source="food_item.image_url", read_only=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            "id",
            "food_item",
            "food_name",
            "unit_price",
            "quantity",
            "line_total",
            "is_available",
            "is_vegetarian",
            "image_url",
        ]

    def get_line_total(self, obj):
        return str(obj.food_item.effective_price * obj.quantity)


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    restaurant_name = serializers.CharField(source="restaurant.name", read_only=True, default="")
    coupon_code = serializers.CharField(source="coupon.code", read_only=True, default="")
    totals = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ["id", "restaurant", "restaurant_name", "coupon_code", "items", "totals", "updated_at"]

    def get_totals(self, obj):
        t = compute_cart_totals(obj)
        return {
            "subtotal": str(t["subtotal"]),
            "tax_amount": str(t["tax_amount"]),
            "delivery_fee": str(t["delivery_fee"]),
            "discount_amount": str(t["discount_amount"]),
            "total_amount": str(t["total_amount"]),
            "unavailable_items": t["unavailable_items"],
            "coupon_error": t["coupon_error"],
        }


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["id", "food_item", "food_name_snapshot", "unit_price_snapshot", "quantity", "total_price"]


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_email = serializers.EmailField(source="changed_by.email", read_only=True, default="")

    class Meta:
        model = OrderStatusHistory
        fields = ["id", "from_status", "to_status", "actor_role", "changed_by_email", "notes", "created_at"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    restaurant_name = serializers.CharField(source="restaurant.name", read_only=True)
    restaurant_phone = serializers.CharField(source="restaurant.phone", read_only=True)
    restaurant_address = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.EmailField(source="customer.email", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    delivery_partner = serializers.SerializerMethodField()
    has_review = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "customer",
            "customer_name",
            "customer_email",
            "customer_phone",
            "restaurant",
            "restaurant_name",
            "restaurant_phone",
            "restaurant_address",
            "status",
            "payment_status",
            "payment_method",
            "subtotal",
            "tax_amount",
            "delivery_fee",
            "discount_amount",
            "total_amount",
            "platform_commission",
            "restaurant_payout",
            "delivery_address_snapshot",
            "delivery_lat",
            "delivery_lng",
            "special_instructions",
            "coupon_code",
            "rejection_reason",
            "cancellation_reason",
            "items",
            "status_history",
            "delivery_partner",
            "has_review",
            "created_at",
            "updated_at",
        ]

    def get_customer_name(self, obj):
        return f"{obj.customer.first_name} {obj.customer.last_name}".strip() or obj.customer.username

    def get_restaurant_address(self, obj):
        addr = getattr(obj.restaurant, "address", None)
        if not addr:
            return None
        return {
            "street_address": addr.street_address,
            "city": addr.city,
            "state": addr.state,
            "postal_code": addr.postal_code,
            "latitude": str(addr.latitude),
            "longitude": str(addr.longitude),
        }

    def get_delivery_partner(self, obj):
        assignment = getattr(obj, "delivery_assignment", None)
        if not assignment or not assignment.delivery_partner:
            return None
        dp = assignment.delivery_partner
        return {
            "assignment_id": assignment.id,
            "assignment_status": assignment.status,
            "partner_id": dp.id,
            "name": f"{dp.user.first_name} {dp.user.last_name}".strip() or dp.user.username,
            "phone": dp.user.phone,
            "vehicle_type": dp.vehicle_type,
            "vehicle_number": dp.vehicle_number,
            "current_lat": str(dp.current_lat),
            "current_lng": str(dp.current_lng),
        }

    def get_has_review(self, obj):
        return hasattr(obj, "review")


class CreateOrderSerializer(serializers.Serializer):
    address_id = serializers.IntegerField()
    payment_method = serializers.ChoiceField(choices=Order.PaymentMethod.choices)
    special_instructions = serializers.CharField(required=False, allow_blank=True, default="")
    idempotency_key = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
