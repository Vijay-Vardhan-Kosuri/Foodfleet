from datetime import timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.models import DeliveryPartnerProfile, Role
from accounts.permissions import IsDeliveryPartner
from notifications.models import dispatch_notification
from orders.models import Order
from orders.services import OrderService
from .models import DeliveryAssignment
from .serializers import DeliveryAssignmentSerializer


ALLOWED_DELIVERY_TRANSITIONS = {
    DeliveryAssignment.Status.ASSIGNED: {
        DeliveryAssignment.Status.ACCEPTED,
        DeliveryAssignment.Status.REJECTED,
    },
    DeliveryAssignment.Status.ACCEPTED: {
        DeliveryAssignment.Status.ARRIVED_AT_RESTAURANT,
    },
    DeliveryAssignment.Status.ARRIVED_AT_RESTAURANT: {
        DeliveryAssignment.Status.PICKED_UP,
    },
    DeliveryAssignment.Status.PICKED_UP: {
        DeliveryAssignment.Status.OUT_FOR_DELIVERY,
    },
    DeliveryAssignment.Status.OUT_FOR_DELIVERY: {
        DeliveryAssignment.Status.DELIVERED,
    },
    DeliveryAssignment.Status.DELIVERED: set(),
    DeliveryAssignment.Status.REJECTED: set(),
}


class DeliveryAssignmentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DeliveryAssignmentSerializer
    permission_classes = [IsDeliveryPartner]

    def get_queryset(self):
        return (
            DeliveryAssignment.objects.filter(delivery_partner__user=self.request.user)
            .select_related(
                "order",
                "order__customer",
                "order__restaurant",
                "order__restaurant__address",
                "delivery_partner__user",
            )
            .order_by("-assigned_at")
        )

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def accept(self, request, pk=None):
        assignment = self.get_object()
        partner = request.user.delivery_profile
        if assignment.delivery_partner_id != partner.id:
            raise PermissionDenied("This assignment does not belong to you.")
        if assignment.status != DeliveryAssignment.Status.ASSIGNED:
            raise ValidationError("Only newly assigned deliveries can be accepted.")
        if partner.availability_status == DeliveryPartnerProfile.AvailabilityStatus.OFFLINE:
            raise ValidationError("Switch to Available before accepting deliveries.")

        active_count = DeliveryAssignment.objects.filter(
            delivery_partner=partner,
            status__in=[
                DeliveryAssignment.Status.ACCEPTED,
                DeliveryAssignment.Status.ARRIVED_AT_RESTAURANT,
                DeliveryAssignment.Status.PICKED_UP,
                DeliveryAssignment.Status.OUT_FOR_DELIVERY,
            ],
        ).count()
        if active_count >= 2:
            raise ValidationError("You have reached the maximum active delivery limit (2).")

        assignment.status = DeliveryAssignment.Status.ACCEPTED
        assignment.accepted_at = timezone.now()
        assignment.save(update_fields=["status", "accepted_at", "updated_at"])

        partner.availability_status = DeliveryPartnerProfile.AvailabilityStatus.BUSY
        partner.save(update_fields=["availability_status", "updated_at"])

        dispatch_notification(
            recipient=assignment.order.customer,
            title="Delivery Partner Assigned",
            message=f"{request.user.first_name or request.user.username} accepted your delivery for {assignment.order.order_number}.",
            notification_type="DELIVERY_UPDATE",
            related_order_id=assignment.order.id,
        )
        return Response(DeliveryAssignmentSerializer(assignment).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def reject(self, request, pk=None):
        assignment = self.get_object()
        partner = request.user.delivery_profile
        if assignment.delivery_partner_id != partner.id:
            raise PermissionDenied("This assignment does not belong to you.")
        if assignment.status != DeliveryAssignment.Status.ASSIGNED:
            raise ValidationError("Only pending assignments can be rejected.")

        assignment.status = DeliveryAssignment.Status.REJECTED
        assignment.notes = request.data.get("reason", "Rejected by partner.")
        assignment.delivery_partner = None
        assignment.save(update_fields=["status", "notes", "delivery_partner", "updated_at"])
        return Response({"success": True, "message": "Assignment rejected."})

    @action(detail=True, methods=["patch"], url_path="status")
    @transaction.atomic
    def update_status(self, request, pk=None):
        assignment = self.get_object()
        partner = request.user.delivery_profile
        if assignment.delivery_partner_id != partner.id:
            raise PermissionDenied("Only the assigned delivery partner can update delivery status.")

        new_status = request.data.get("status")
        if new_status not in ALLOWED_DELIVERY_TRANSITIONS.get(assignment.status, set()):
            raise ValidationError(f"Invalid delivery transition from {assignment.status} to {new_status}.")

        if new_status == DeliveryAssignment.Status.PICKED_UP:
            if assignment.order.status not in (
                Order.Status.READY_FOR_PICKUP,
                Order.Status.CONFIRMED,
                Order.Status.PREPARING,
            ):
                raise ValidationError("Order is not ready for pickup yet.")
            # Ensure order reaches READY_FOR_PICKUP -> PICKED_UP cleanly
            if assignment.order.status != Order.Status.READY_FOR_PICKUP:
                raise ValidationError("Restaurant must mark order Ready for Pickup before pickup.")
            assignment.picked_up_at = timezone.now()
            OrderService.transition_status(
                order=assignment.order,
                new_status=Order.Status.PICKED_UP,
                actor=request.user,
                notes="Picked up by delivery partner.",
            )

        elif new_status == DeliveryAssignment.Status.OUT_FOR_DELIVERY:
            OrderService.transition_status(
                order=assignment.order,
                new_status=Order.Status.OUT_FOR_DELIVERY,
                actor=request.user,
                notes="Order is out for delivery.",
            )

        elif new_status == DeliveryAssignment.Status.DELIVERED:
            assignment.delivered_at = timezone.now()
            OrderService.transition_status(
                order=assignment.order,
                new_status=Order.Status.DELIVERED,
                actor=request.user,
                notes="Delivered to customer.",
            )
            if assignment.order.payment_method == Order.PaymentMethod.COD:
                assignment.order.payment_status = Order.PaymentStatus.PAID
                assignment.order.save(update_fields=["payment_status", "updated_at"])
            partner.total_deliveries += 1
            partner.availability_status = DeliveryPartnerProfile.AvailabilityStatus.AVAILABLE
            partner.save(update_fields=["total_deliveries", "availability_status", "updated_at"])

        assignment.status = new_status
        if "notes" in request.data:
            assignment.notes = request.data["notes"]
        assignment.save()
        return Response(DeliveryAssignmentSerializer(assignment).data)


class DeliveryAvailabilityView(APIView):
    permission_classes = [IsDeliveryPartner]

    def post(self, request):
        status_val = request.data.get("availability_status")
        if status_val not in DeliveryPartnerProfile.AvailabilityStatus.values:
            raise ValidationError("Invalid availability status.")
        profile, _ = DeliveryPartnerProfile.objects.get_or_create(user=request.user)
        profile.availability_status = status_val
        if "current_lat" in request.data and "current_lng" in request.data:
            profile.current_lat = request.data["current_lat"]
            profile.current_lng = request.data["current_lng"]
        profile.save()
        return Response(
            {
                "availability_status": profile.availability_status,
                "current_lat": str(profile.current_lat),
                "current_lng": str(profile.current_lng),
            }
        )


class DeliveryEarningsView(APIView):
    permission_classes = [IsDeliveryPartner]

    def get(self, request):
        profile, _ = DeliveryPartnerProfile.objects.get_or_create(user=request.user)
        completed = DeliveryAssignment.objects.filter(
            delivery_partner=profile, status=DeliveryAssignment.Status.DELIVERED
        )
        today = timezone.localdate()
        week_start = timezone.now() - timedelta(days=7)

        total_earnings = float(completed.aggregate(total=Sum("delivery_fee_earned"))["total"] or 0)
        today_earnings = float(
            completed.filter(delivered_at__date=today).aggregate(total=Sum("delivery_fee_earned"))["total"] or 0
        )
        weekly_earnings = float(
            completed.filter(delivered_at__gte=week_start).aggregate(total=Sum("delivery_fee_earned"))["total"] or 0
        )
        daily_breakdown = list(
            completed.filter(delivered_at__gte=week_start)
            .annotate(day=TruncDate("delivered_at"))
            .values("day")
            .annotate(earnings=Sum("delivery_fee_earned"), deliveries=Count("id"))
            .order_by("day")
        )
        for row in daily_breakdown:
            row["day"] = str(row["day"])
            row["earnings"] = float(row["earnings"] or 0)

        return Response(
            {
                "total_completed_deliveries": completed.count(),
                "total_earnings": round(total_earnings, 2),
                "today_earnings": round(today_earnings, 2),
                "weekly_earnings": round(weekly_earnings, 2),
                "daily_breakdown": daily_breakdown,
            }
        )
