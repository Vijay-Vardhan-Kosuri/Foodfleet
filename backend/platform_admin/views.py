from datetime import timedelta
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.models import CustomerProfile, DeliveryPartnerProfile, Role, User
from accounts.permissions import IsSuperAdmin
from accounts.serializers import DeliveryPartnerProfileSerializer, UserSerializer
from delivery.models import DeliveryAssignment
from notifications.models import dispatch_notification
from orders.models import Coupon, Order, OrderStatusHistory
from orders.serializers import CouponSerializer, OrderSerializer
from payments.models import Payment, Refund
from payments.serializers import PaymentSerializer, RefundSerializer
from restaurants.models import CuisineCategory, RestaurantProfile
from restaurants.serializers import CuisineCategorySerializer, RestaurantProfileSerializer
from reviews.models import Complaint, Review
from reviews.views import ComplaintSerializer, ReviewSerializer
from .models import AuditLog, PlatformConfig, record_audit_log


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True, default="System")

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor_email",
            "actor_role",
            "action",
            "target_model",
            "target_id",
            "details",
            "ip_address",
            "created_at",
        ]


class PlatformConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformConfig
        fields = [
            "id",
            "platform_name",
            "tax_rate_percent",
            "default_delivery_fee",
            "default_commission_percent",
            "support_email",
            "support_phone",
            "auto_assign_delivery",
            "updated_at",
        ]


class AdminDashboardOverviewView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        orders = Order.objects.all()
        completed = orders.filter(status=Order.Status.DELIVERED)
        pending = orders.filter(
            status__in=[
                Order.Status.PLACED,
                Order.Status.CONFIRMED,
                Order.Status.PREPARING,
                Order.Status.READY_FOR_PICKUP,
                Order.Status.PICKED_UP,
                Order.Status.OUT_FOR_DELIVERY,
            ]
        )
        rev_agg = completed.aggregate(
            revenue=Sum("total_amount"),
            commission=Sum("platform_commission"),
        )
        return Response(
            {
                "total_customers": User.objects.filter(role=Role.CUSTOMER).count(),
                "total_restaurants": RestaurantProfile.objects.filter(is_deleted=False).count(),
                "pending_restaurant_approvals": RestaurantProfile.objects.filter(
                    approval_status=RestaurantProfile.ApprovalStatus.PENDING, is_deleted=False
                ).count(),
                "total_delivery_partners": User.objects.filter(role=Role.DELIVERY_PARTNER).count(),
                "available_delivery_partners": DeliveryPartnerProfile.objects.filter(
                    availability_status=DeliveryPartnerProfile.AvailabilityStatus.AVAILABLE
                ).count(),
                "total_orders": orders.count(),
                "completed_orders": completed.count(),
                "pending_orders": pending.count(),
                "total_platform_revenue": round(float(rev_agg["revenue"] or 0), 2),
                "platform_commission": round(float(rev_agg["commission"] or 0), 2),
                "open_complaints": Complaint.objects.filter(status=Complaint.Status.OPEN).count(),
                "pending_refunds": Refund.objects.filter(status=Refund.Status.PENDING).count(),
            }
        )


class AdminAnalyticsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        since = timezone.now() - timedelta(days=30)
        completed = Order.objects.filter(status=Order.Status.DELIVERED)

        daily_series = list(
            completed.filter(created_at__gte=since)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(
                revenue=Sum("total_amount"),
                commission=Sum("platform_commission"),
                orders=Count("id"),
            )
            .order_by("day")
        )
        for row in daily_series:
            row["day"] = str(row["day"])
            row["revenue"] = float(row["revenue"] or 0)
            row["commission"] = float(row["commission"] or 0)

        top_restaurants = list(
            completed.values("restaurant__name")
            .annotate(revenue=Sum("total_amount"), orders=Count("id"))
            .order_by("-revenue")[:8]
        )
        for r in top_restaurants:
            r["revenue"] = float(r["revenue"] or 0)

        orders_by_status = list(Order.objects.values("status").annotate(count=Count("id")).order_by("-count"))

        return Response(
            {
                "daily_revenue": daily_series,
                "top_restaurants": top_restaurants,
                "orders_by_status": orders_by_status,
            }
        )


class AdminUserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["role", "is_suspended", "is_active"]
    search_fields = ["email", "username", "first_name", "last_name", "phone"]
    ordering_fields = ["created_at", "email", "role"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return User.objects.select_related("customer_profile", "delivery_profile").order_by("-created_at")

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password")
        role = request.data.get("role", Role.CUSTOMER)
        if not email or not password:
            raise ValidationError("Email and password are required.")
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError("User with this email already exists.")
        if role not in Role.values:
            raise ValidationError("Invalid role.")

        username = (request.data.get("username") or email.split("@")[0]).strip()
        base_u = username
        c = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_u}{c}"
            c += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=request.data.get("first_name", ""),
            last_name=request.data.get("last_name", ""),
            phone=request.data.get("phone", ""),
            role=role,
        )
        if role == Role.CUSTOMER:
            CustomerProfile.objects.create(user=user)
        elif role == Role.DELIVERY_PARTNER:
            DeliveryPartnerProfile.objects.create(user=user)

        record_audit_log(request, "USER_CREATED", "User", user.id, {"email": user.email, "role": user.role})
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"])
    def suspend(self, request, pk=None):
        user = self.get_object()
        if user.id == request.user.id:
            raise ValidationError("You cannot suspend your own Super Admin account.")
        suspend_flag = bool(request.data.get("is_suspended", True))
        user.is_suspended = suspend_flag
        user.save(update_fields=["is_suspended", "updated_at"])
        record_audit_log(
            request,
            "USER_SUSPENDED" if suspend_flag else "USER_REACTIVATED",
            "User",
            user.id,
            {"email": user.email, "is_suspended": suspend_flag},
        )
        return Response(UserSerializer(user).data)


class AdminRestaurantViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RestaurantProfileSerializer
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["approval_status", "is_open", "is_featured"]
    search_fields = ["name", "owner__email", "address__city"]

    def get_queryset(self):
        return (
            RestaurantProfile.objects.filter(is_deleted=False)
            .select_related("owner", "address")
            .prefetch_related("cuisines")
            .order_by("-created_at")
        )

    @action(detail=True, methods=["patch"])
    def approval(self, request, pk=None):
        restaurant = self.get_object()
        new_status = request.data.get("approval_status")
        if new_status not in RestaurantProfile.ApprovalStatus.values:
            raise ValidationError("Invalid approval status.")
        restaurant.approval_status = new_status
        if "rejection_reason" in request.data:
            restaurant.rejection_reason = request.data["rejection_reason"]
        if "is_featured" in request.data:
            restaurant.is_featured = bool(request.data["is_featured"])
        if "commission_rate" in request.data:
            restaurant.commission_rate = request.data["commission_rate"]
        restaurant.save()

        record_audit_log(
            request,
            f"RESTAURANT_{new_status}",
            "RestaurantProfile",
            restaurant.id,
            {"name": restaurant.name, "approval_status": new_status},
        )
        dispatch_notification(
            recipient=restaurant.owner,
            title=f"Restaurant {new_status.title()}",
            message=f"Your restaurant '{restaurant.name}' status has been updated to {new_status}.",
            notification_type="RESTAURANT_APPROVAL",
        )
        return Response(RestaurantProfileSerializer(restaurant, context={"request": request}).data)


class AdminDeliveryPartnerViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DeliveryPartnerProfileSerializer
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["verification_status", "availability_status"]
    search_fields = ["user__email", "user__first_name", "vehicle_number"]

    def get_queryset(self):
        return DeliveryPartnerProfile.objects.select_related("user").order_by("-created_at")

    @action(detail=True, methods=["patch"])
    def verify(self, request, pk=None):
        partner = self.get_object()
        ver_status = request.data.get("verification_status")
        if ver_status not in DeliveryPartnerProfile.VerificationStatus.values:
            raise ValidationError("Invalid verification status.")
        partner.verification_status = ver_status
        partner.save(update_fields=["verification_status", "updated_at"])
        record_audit_log(
            request,
            f"DELIVERY_PARTNER_{ver_status}",
            "DeliveryPartnerProfile",
            partner.id,
            {"email": partner.user.email},
        )
        return Response(DeliveryPartnerProfileSerializer(partner).data)


class AdminOrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["status", "payment_status"]
    search_fields = ["order_number", "customer__email", "restaurant__name"]

    def get_queryset(self):
        return (
            Order.objects.select_related("customer", "restaurant", "restaurant__address", "delivery_assignment")
            .prefetch_related("items", "status_history")
            .order_by("-created_at")
        )

    @action(detail=True, methods=["post"], url_path="assign-delivery")
    @transaction.atomic
    def assign_delivery(self, request, pk=None):
        order = self.get_object()
        partner_id = request.data.get("delivery_partner_id")
        partner = DeliveryPartnerProfile.objects.select_related("user").filter(id=partner_id).first()
        if not partner:
            raise ValidationError("Selected delivery partner does not exist.")
        if partner.user.is_suspended:
            raise ValidationError("Cannot assign a suspended delivery partner.")
        if partner.availability_status != DeliveryPartnerProfile.AvailabilityStatus.AVAILABLE:
            raise ValidationError("Delivery partner must be Available to receive new assignments.")

        assignment, _ = DeliveryAssignment.objects.update_or_create(
            order=order,
            defaults={
                "delivery_partner": partner,
                "status": DeliveryAssignment.Status.ASSIGNED,
                "delivery_fee_earned": max(order.delivery_fee, 35),
                "notes": request.data.get("notes", "Assigned by Super Admin."),
            },
        )
        record_audit_log(
            request,
            "DELIVERY_ASSIGNED",
            "Order",
            order.id,
            {"order_number": order.order_number, "partner_email": partner.user.email},
        )
        dispatch_notification(
            recipient=partner.user,
            title=f"New Delivery Assignment: {order.order_number}",
            message=f"Pickup from {order.restaurant.name}. Tap to accept.",
            notification_type="DELIVERY_ASSIGNED",
            related_order_id=order.id,
        )
        return Response(OrderSerializer(order, context={"request": request}).data)


class AdminPaymentListView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        payments = Payment.objects.select_related("order", "order__restaurant", "customer").order_by("-created_at")
        return Response(PaymentSerializer(payments, many=True).data)


class AdminRefundViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RefundSerializer
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["status"]

    def get_queryset(self):
        return Refund.objects.select_related("order", "payment", "processed_by").order_by("-created_at")

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def process(self, request, pk=None):
        refund = self.get_object()
        decision = request.data.get("decision", "PROCESSED")
        if refund.status != Refund.Status.PENDING:
            raise ValidationError("Refund has already been processed.")
        if decision not in (Refund.Status.PROCESSED, Refund.Status.REJECTED):
            raise ValidationError("Invalid refund decision.")

        refund.status = decision
        refund.processed_by = request.user
        if decision == Refund.Status.PROCESSED:
            refund.gateway_refund_id = f"rfnd_{refund.order.order_number.lower()}"
            refund.payment.status = Payment.Status.REFUNDED
            refund.payment.save(update_fields=["status", "updated_at"])
            old_status = refund.order.status
            refund.order.status = Order.Status.REFUNDED
            refund.order.payment_status = Order.PaymentStatus.REFUNDED
            refund.order.save(update_fields=["status", "payment_status", "updated_at"])
            OrderStatusHistory.objects.create(
                order=refund.order,
                from_status=old_status,
                to_status=Order.Status.REFUNDED,
                changed_by=request.user,
                actor_role=request.user.role,
                notes="Refund processed by Super Admin.",
            )
            dispatch_notification(
                recipient=refund.order.customer,
                title=f"Refund Processed for {refund.order.order_number}",
                message=f"₹{refund.amount} has been refunded to your payment source.",
                notification_type="REFUND",
                related_order_id=refund.order.id,
            )
        refund.save()
        record_audit_log(
            request,
            f"REFUND_{decision}",
            "Refund",
            refund.id,
            {"order_number": refund.order.order_number, "amount": str(refund.amount)},
        )
        return Response(RefundSerializer(refund).data)


class AdminCouponViewSet(viewsets.ModelViewSet):
    serializer_class = CouponSerializer
    permission_classes = [IsSuperAdmin]
    queryset = Coupon.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        coupon = serializer.save()
        record_audit_log(self.request, "COUPON_CREATED", "Coupon", coupon.id, {"code": coupon.code})


class AdminCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CuisineCategorySerializer
    permission_classes = [IsSuperAdmin]
    queryset = CuisineCategory.objects.all().order_by("name")

    def perform_create(self, serializer):
        cat = serializer.save()
        record_audit_log(self.request, "CATEGORY_CREATED", "CuisineCategory", cat.id, {"name": cat.name})


class AdminReviewViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [IsSuperAdmin]
    queryset = Review.objects.select_related("customer", "restaurant", "order").order_by("-created_at")

    @action(detail=True, methods=["patch"])
    def moderate(self, request, pk=None):
        review = self.get_object()
        if "is_flagged" in request.data:
            review.is_flagged = bool(request.data["is_flagged"])
        if "admin_response" in request.data:
            review.admin_response = request.data["admin_response"]
        review.save()
        record_audit_log(request, "REVIEW_MODERATED", "Review", review.id, {"is_flagged": review.is_flagged})
        return Response(ReviewSerializer(review).data)


class AdminComplaintViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ComplaintSerializer
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["status"]
    queryset = Complaint.objects.select_related("order", "customer").order_by("-created_at")

    @action(detail=True, methods=["patch"])
    def resolve(self, request, pk=None):
        complaint = self.get_object()
        new_status = request.data.get("status", Complaint.Status.RESOLVED)
        if new_status not in Complaint.Status.values:
            raise ValidationError("Invalid complaint status.")
        complaint.status = new_status
        complaint.resolution_notes = request.data.get("resolution_notes", "")
        complaint.resolved_by = request.user
        complaint.save()
        record_audit_log(
            request, "COMPLAINT_UPDATED", "Complaint", complaint.id, {"status": new_status}
        )
        return Response(ComplaintSerializer(complaint).data)


class AdminAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["action", "target_model", "actor_role"]
    search_fields = ["action", "target_model", "actor__email"]
    queryset = AuditLog.objects.select_related("actor").order_by("-created_at")


class AdminConfigView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        return Response(PlatformConfigSerializer(PlatformConfig.get_solo()).data)

    def patch(self, request):
        cfg = PlatformConfig.get_solo()
        serializer = PlatformConfigSerializer(cfg, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_audit_log(
            request,
            "PLATFORM_CONFIG_UPDATED",
            "PlatformConfig",
            cfg.id,
            {k: str(v) for k, v in serializer.validated_data.items()},
        )
        return Response(serializer.data)
