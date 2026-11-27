from rest_framework import serializers
from .models import DeliveryAssignment


class DeliveryAssignmentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    order_status = serializers.CharField(source="order.status", read_only=True)
    order_total = serializers.DecimalField(
        source="order.total_amount", max_digits=10, decimal_places=2, read_only=True
    )
    payment_method = serializers.CharField(source="order.payment_method", read_only=True)
    restaurant_name = serializers.CharField(source="order.restaurant.name", read_only=True)
    restaurant_phone = serializers.CharField(source="order.restaurant.phone", read_only=True)
    restaurant_address = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.CharField(source="order.customer.phone", read_only=True)
    delivery_address = serializers.JSONField(source="order.delivery_address_snapshot", read_only=True)
    delivery_lat = serializers.DecimalField(
        source="order.delivery_lat", max_digits=9, decimal_places=6, read_only=True
    )
    delivery_lng = serializers.DecimalField(
        source="order.delivery_lng", max_digits=9, decimal_places=6, read_only=True
    )
    partner_name = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryAssignment
        fields = [
            "id",
            "order",
            "order_number",
            "order_status",
            "order_total",
            "payment_method",
            "delivery_partner",
            "partner_name",
            "status",
            "delivery_fee_earned",
            "restaurant_name",
            "restaurant_phone",
            "restaurant_address",
            "customer_name",
            "customer_phone",
            "delivery_address",
            "delivery_lat",
            "delivery_lng",
            "assigned_at",
            "accepted_at",
            "picked_up_at",
            "delivered_at",
            "notes",
        ]

    def get_restaurant_address(self, obj):
        addr = getattr(obj.order.restaurant, "address", None)
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

    def get_customer_name(self, obj):
        c = obj.order.customer
        return f"{c.first_name} {c.last_name}".strip() or c.username

    def get_partner_name(self, obj):
        if not obj.delivery_partner:
            return None
        u = obj.delivery_partner.user
        return f"{u.first_name} {u.last_name}".strip() or u.username
