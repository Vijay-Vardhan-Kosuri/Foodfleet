import hashlib
import hmac
import uuid
from django.conf import settings
from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from accounts.models import Role
from accounts.permissions import IsActiveAuthenticated, IsCustomer
from notifications.models import dispatch_notification
from orders.models import Order, OrderStatusHistory
from .models import Payment
from .serializers import PaymentSerializer


class CreatePaymentView(APIView):
    permission_classes = [IsCustomer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payment_sensitive"

    @transaction.atomic
    def post(self, request):
        order_id = request.data.get("order_id")
        idempotency_key = request.data.get("idempotency_key")
        order = Order.objects.select_for_update().filter(id=order_id).first()
        if not order:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        if order.customer_id != request.user.id:
            raise PermissionDenied("You cannot initiate payment for another customer's order.")

        existing = Payment.objects.filter(order=order).first()
        if existing:
            if existing.status == Payment.Status.VERIFIED:
                return Response(
                    {"detail": "Payment for this order has already been verified."},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(
                {
                    "payment": PaymentSerializer(existing).data,
                    "razorpay_key_id": settings.RAZORPAY_KEY_ID or "rzp_test_simulated",
                    "mode": "RAZORPAY" if settings.RAZORPAY_KEY_ID else "SIMULATED",
                }
            )

        if idempotency_key:
            dup = Payment.objects.filter(idempotency_key=idempotency_key).first()
            if dup:
                return Response(
                    {
                        "payment": PaymentSerializer(dup).data,
                        "razorpay_key_id": settings.RAZORPAY_KEY_ID or "rzp_test_simulated",
                        "mode": "RAZORPAY" if settings.RAZORPAY_KEY_ID else "SIMULATED",
                    }
                )

        gateway = Payment.Gateway.SIMULATED
        gateway_order_id = f"ff_gw_{uuid.uuid4().hex[:14]}"
        raw_response = {"mode": "simulated"}

        if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
            try:
                import razorpay

                client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
                rzp_order = client.order.create(
                    {
                        "amount": int(order.total_amount * 100),
                        "currency": "INR",
                        "receipt": order.order_number,
                    }
                )
                gateway = Payment.Gateway.RAZORPAY
                gateway_order_id = rzp_order["id"]
                raw_response = rzp_order
            except Exception as exc:
                raw_response = {"fallback": "simulated", "reason": str(exc)}

        payment = Payment.objects.create(
            order=order,
            customer=request.user,
            gateway=gateway,
            gateway_order_id=gateway_order_id,
            amount=order.total_amount,
            status=Payment.Status.CREATED,
            raw_response=raw_response,
            idempotency_key=idempotency_key,
        )
        return Response(
            {
                "payment": PaymentSerializer(payment).data,
                "razorpay_key_id": settings.RAZORPAY_KEY_ID or "rzp_test_simulated",
                "mode": gateway,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyPaymentView(APIView):
    permission_classes = [IsCustomer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payment_sensitive"

    @transaction.atomic
    def post(self, request):
        order_id = request.data.get("order_id")
        simulate_outcome = request.data.get("simulate_outcome", "SUCCESS")
        gateway_payment_id = request.data.get("gateway_payment_id") or f"pay_{uuid.uuid4().hex[:12]}"
        gateway_signature = request.data.get("gateway_signature") or ""

        order = Order.objects.select_for_update().filter(id=order_id).first()
        if not order:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        if order.customer_id != request.user.id:
            raise PermissionDenied("You cannot verify payment for another customer's order.")

        payment = Payment.objects.select_for_update().filter(order=order).first()
        if not payment:
            raise ValidationError("Payment intent not initialized for this order.")
        if payment.status == Payment.Status.VERIFIED:
            return Response({"success": True, "payment": PaymentSerializer(payment).data})

        if simulate_outcome == "FAILED":
            payment.status = Payment.Status.FAILED
            payment.raw_response = {"outcome": "FAILED", "reason": "Simulated card decline"}
            payment.save(update_fields=["status", "raw_response", "updated_at"])
            old_status = order.status
            order.payment_status = Order.PaymentStatus.FAILED
            order.status = Order.Status.PAYMENT_FAILED
            order.save(update_fields=["payment_status", "status", "updated_at"])
            OrderStatusHistory.objects.create(
                order=order,
                from_status=old_status,
                to_status=Order.Status.PAYMENT_FAILED,
                changed_by=request.user,
                actor_role=request.user.role,
                notes="Payment verification failed.",
            )
            return Response(
                {"success": False, "message": "Payment failed.", "payment": PaymentSerializer(payment).data},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if payment.gateway == Payment.Gateway.RAZORPAY and settings.RAZORPAY_KEY_SECRET:
            msg = f"{payment.gateway_order_id}|{gateway_payment_id}".encode("utf-8")
            expected = hmac.new(
                settings.RAZORPAY_KEY_SECRET.encode("utf-8"), msg, hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(expected, gateway_signature):
                payment.status = Payment.Status.FAILED
                payment.save(update_fields=["status", "updated_at"])
                raise ValidationError("Invalid payment signature.")

        payment.gateway_payment_id = gateway_payment_id
        payment.gateway_signature = gateway_signature or f"sig_{uuid.uuid4().hex[:16]}"
        payment.status = Payment.Status.VERIFIED
        payment.save()

        order.payment_status = Order.PaymentStatus.PAID
        order.save(update_fields=["payment_status", "updated_at"])

        dispatch_notification(
            recipient=order.customer,
            title="Payment Verified",
            message=f"Payment of ₹{payment.amount} verified for order {order.order_number}.",
            notification_type="PAYMENT",
            related_order_id=order.id,
        )
        return Response({"success": True, "payment": PaymentSerializer(payment).data})


class PaymentHistoryView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == Role.DELIVERY_PARTNER:
            raise PermissionDenied("Delivery partners cannot access customer payment records.")
        if user.role == Role.SUPER_ADMIN:
            qs = Payment.objects.select_related("order", "order__restaurant", "customer")
        elif user.role == Role.RESTAURANT_OWNER:
            qs = Payment.objects.filter(order__restaurant__owner=user).select_related(
                "order", "order__restaurant", "customer"
            )
        else:
            qs = Payment.objects.filter(customer=user).select_related("order", "order__restaurant", "customer")
        return Response(PaymentSerializer(qs, many=True).data)
