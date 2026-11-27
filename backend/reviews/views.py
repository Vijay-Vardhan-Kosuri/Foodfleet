from django.db.models import Avg
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from accounts.models import Role
from accounts.permissions import IsActiveAuthenticated, IsCustomer
from orders.models import Order
from .models import Complaint, Review


class ReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    restaurant_name = serializers.CharField(source="restaurant.name", read_only=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "order",
            "order_number",
            "customer",
            "customer_name",
            "restaurant",
            "restaurant_name",
            "rating",
            "delivery_rating",
            "comment",
            "is_flagged",
            "admin_response",
            "created_at",
        ]
        read_only_fields = ["id", "customer", "restaurant", "is_flagged", "admin_response", "created_at"]

    def get_customer_name(self, obj):
        return f"{obj.customer.first_name} {obj.customer.last_name}".strip() or obj.customer.username


class ComplaintSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    customer_email = serializers.EmailField(source="customer.email", read_only=True)

    class Meta:
        model = Complaint
        fields = [
            "id",
            "order",
            "order_number",
            "customer",
            "customer_email",
            "subject",
            "description",
            "status",
            "resolution_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "customer", "status", "resolution_notes", "created_at", "updated_at"]


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    filterset_fields = ["restaurant", "rating"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        if self.action == "create":
            return [IsCustomer()]
        return [IsActiveAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Review.objects.select_related("customer", "restaurant", "order")
        if user.is_authenticated and user.role == Role.RESTAURANT_OWNER and self.request.query_params.get("mine"):
            return qs.filter(restaurant__owner=user)
        if user.is_authenticated and user.role == Role.CUSTOMER and self.request.query_params.get("mine"):
            return qs.filter(customer=user)
        return qs

    def perform_create(self, serializer):
        order = serializer.validated_data["order"]
        if order.customer_id != self.request.user.id:
            raise PermissionDenied("You can only review your own orders.")
        if order.status != Order.Status.DELIVERED:
            raise ValidationError("You can only review completed (delivered) orders.")
        if hasattr(order, "review"):
            raise ValidationError("You have already reviewed this order.")
        review = serializer.save(customer=self.request.user, restaurant=order.restaurant)
        agg = order.restaurant.reviews.aggregate(avg=Avg("rating"))
        order.restaurant.average_rating = round(float(agg["avg"] or 5.0), 2)
        order.restaurant.total_reviews = order.restaurant.reviews.count()
        order.restaurant.save(update_fields=["average_rating", "total_reviews", "updated_at"])
        return review


class ComplaintViewSet(viewsets.ModelViewSet):
    serializer_class = ComplaintSerializer
    permission_classes = [IsCustomer]

    def get_queryset(self):
        return Complaint.objects.filter(customer=self.request.user).select_related("order", "customer")

    def perform_create(self, serializer):
        order = serializer.validated_data["order"]
        if order.customer_id != self.request.user.id:
            raise PermissionDenied("You can only file complaints for your own orders.")
        serializer.save(customer=self.request.user)
