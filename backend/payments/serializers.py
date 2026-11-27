from rest_framework import serializers
from .models import Payment, Refund


class PaymentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    restaurant_name = serializers.CharField(source="order.restaurant.name", read_only=True)
    customer_email = serializers.EmailField(source="customer.email", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "order",
            "order_number",
            "restaurant_name",
            "customer",
            "customer_email",
            "gateway",
            "gateway_order_id",
            "gateway_payment_id",
            "amount",
            "currency",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class RefundSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    processed_by_email = serializers.EmailField(source="processed_by.email", read_only=True, default="")

    class Meta:
        model = Refund
        fields = [
            "id",
            "payment",
            "order",
            "order_number",
            "amount",
            "reason",
            "status",
            "gateway_refund_id",
            "processed_by_email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
