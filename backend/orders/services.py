from decimal import Decimal
from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError
from accounts.models import Address, Role
from notifications.models import dispatch_notification
from restaurants.models import FoodItem, RestaurantProfile
from .models import Cart, CartItem, Coupon, Order, OrderItem, OrderStatusHistory


ALLOWED_TRANSITIONS = {
    Order.Status.PLACED: {
        Order.Status.CONFIRMED,
        Order.Status.REJECTED,
        Order.Status.CANCELLED,
        Order.Status.PAYMENT_FAILED,
    },
    Order.Status.CONFIRMED: {
        Order.Status.PREPARING,
        Order.Status.CANCELLED,
        Order.Status.REJECTED,
    },
    Order.Status.PREPARING: {
        Order.Status.READY_FOR_PICKUP,
        Order.Status.CANCELLED,
    },
    Order.Status.READY_FOR_PICKUP: {
        Order.Status.PICKED_UP,
    },
    Order.Status.PICKED_UP: {
        Order.Status.OUT_FOR_DELIVERY,
    },
    Order.Status.OUT_FOR_DELIVERY: {
        Order.Status.DELIVERED,
    },
    Order.Status.REJECTED: {
        Order.Status.REFUND_PENDING,
        Order.Status.REFUNDED,
    },
    Order.Status.CANCELLED: {
        Order.Status.REFUND_PENDING,
        Order.Status.REFUNDED,
    },
    Order.Status.REFUND_PENDING: {
        Order.Status.REFUNDED,
    },
    Order.Status.DELIVERED: set(),
    Order.Status.PAYMENT_FAILED: set(),
    Order.Status.REFUNDED: set(),
}


def compute_cart_totals(cart: Cart) -> dict:
    from platform_admin.models import PlatformConfig

    config = PlatformConfig.get_solo()
    items = list(cart.items.select_related("food_item", "food_item__restaurant"))
    subtotal = Decimal("0.00")
    unavailable_items = []
    for item in items:
        if not item.food_item.is_available or item.food_item.is_deleted:
            unavailable_items.append(item.food_item.name)
        subtotal += item.food_item.effective_price * item.quantity

    tax_rate = Decimal(str(config.tax_rate_percent)) / Decimal("100")
    tax_amount = (subtotal * tax_rate).quantize(Decimal("0.01"))
    delivery_fee = Decimal("0.00")
    if items and cart.restaurant:
        delivery_fee = cart.restaurant.delivery_fee

    discount_amount = Decimal("0.00")
    coupon_error = ""
    if cart.coupon:
        valid, err = cart.coupon.is_valid_for_amount(subtotal)
        if valid:
            discount_amount = cart.coupon.calculate_discount(subtotal)
        else:
            coupon_error = err

    total = max(Decimal("0.00"), subtotal + tax_amount + delivery_fee - discount_amount).quantize(
        Decimal("0.01")
    )
    return {
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "delivery_fee": delivery_fee,
        "discount_amount": discount_amount,
        "total_amount": total,
        "unavailable_items": unavailable_items,
        "coupon_error": coupon_error,
    }


def broadcast_order_update(order: Order):
    """Push real-time order update to Django Channels subscribers."""
    from django.conf import settings

    if getattr(settings, "TESTING", False):
        return
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(
                f"order_{order.id}",
                {
                    "type": "order_status_event",
                    "payload": {
                        "order_id": order.id,
                        "order_number": order.order_number,
                        "status": order.status,
                        "payment_status": order.payment_status,
                        "updated_at": order.updated_at.isoformat(),
                    },
                },
            )
    except Exception:
        pass


class OrderService:
    """Centralized order management service enforcing business rules & state machine."""

    @staticmethod
    @transaction.atomic
    def create_order_from_cart(
        *,
        customer,
        address_id: int,
        payment_method: str,
        special_instructions: str = "",
        idempotency_key: str | None = None,
    ) -> Order:
        if idempotency_key:
            existing = Order.objects.filter(idempotency_key=idempotency_key, customer=customer).first()
            if existing:
                return existing

        cart = Cart.objects.select_for_update().filter(customer=customer).first()
        if not cart or not cart.items.exists():
            raise ValidationError("Your cart is empty.")

        restaurant = cart.restaurant
        if not restaurant or restaurant.is_deleted:
            raise ValidationError("Selected restaurant is no longer available.")
        if restaurant.approval_status != RestaurantProfile.ApprovalStatus.APPROVED:
            raise ValidationError("Only approved restaurants can receive orders.")
        if not restaurant.is_open:
            raise ValidationError("This restaurant is currently closed for orders.")

        address = Address.objects.filter(id=address_id, user=customer, is_deleted=False).first()
        if not address:
            raise ValidationError("Valid delivery address is required.")

        totals = compute_cart_totals(cart)
        if totals["unavailable_items"]:
            raise ValidationError(
                f"Some items are unavailable: {', '.join(totals['unavailable_items'])}. Remove them to proceed."
            )
        if totals["subtotal"] < restaurant.min_order_amount:
            raise ValidationError(
                f"Minimum order amount for {restaurant.name} is ₹{restaurant.min_order_amount}."
            )

        commission_rate = restaurant.commission_rate / Decimal("100")
        platform_commission = (totals["subtotal"] * commission_rate).quantize(Decimal("0.01"))
        restaurant_payout = (totals["subtotal"] - totals["discount_amount"] - platform_commission).quantize(
            Decimal("0.01")
        )
        if restaurant_payout < 0:
            restaurant_payout = Decimal("0.00")

        coupon_code = ""
        if cart.coupon and totals["discount_amount"] > 0:
            coupon_code = cart.coupon.code
            cart.coupon.used_count += 1
            cart.coupon.save(update_fields=["used_count"])

        order = Order.objects.create(
            customer=customer,
            restaurant=restaurant,
            status=Order.Status.PLACED,
            payment_status=Order.PaymentStatus.PENDING,
            payment_method=payment_method,
            subtotal=totals["subtotal"],
            tax_amount=totals["tax_amount"],
            delivery_fee=totals["delivery_fee"],
            discount_amount=totals["discount_amount"],
            total_amount=totals["total_amount"],
            platform_commission=platform_commission,
            restaurant_payout=restaurant_payout,
            delivery_address_snapshot={
                "label": address.label,
                "street_address": address.street_address,
                "apartment": address.apartment,
                "city": address.city,
                "state": address.state,
                "postal_code": address.postal_code,
                "country": address.country,
            },
            delivery_lat=address.latitude,
            delivery_lng=address.longitude,
            special_instructions=special_instructions,
            coupon_code=coupon_code,
            idempotency_key=idempotency_key,
        )

        for cart_item in cart.items.select_related("food_item"):
            fi = cart_item.food_item
            unit_price = fi.effective_price
            OrderItem.objects.create(
                order=order,
                food_item=fi,
                food_name_snapshot=fi.name,
                unit_price_snapshot=unit_price,
                quantity=cart_item.quantity,
                total_price=(unit_price * cart_item.quantity).quantize(Decimal("0.01")),
            )
            FoodItem.objects.filter(pk=fi.pk).update(order_count=fi.order_count + cart_item.quantity)

        OrderStatusHistory.objects.create(
            order=order,
            from_status="",
            to_status=Order.Status.PLACED,
            changed_by=customer,
            actor_role=customer.role,
            notes="Order placed by customer.",
        )

        # Clear cart after successful order creation
        cart.items.all().delete()
        cart.coupon = None
        cart.restaurant = None
        cart.save(update_fields=["coupon", "restaurant", "updated_at"])

        dispatch_notification(
            recipient=restaurant.owner,
            title=f"New Order {order.order_number}",
            message=f"You received a new order worth ₹{order.total_amount}.",
            notification_type="NEW_ORDER",
            related_order_id=order.id,
        )
        dispatch_notification(
            recipient=customer,
            title=f"Order {order.order_number} Placed",
            message=f"Your order at {restaurant.name} has been placed.",
            notification_type="ORDER_UPDATE",
            related_order_id=order.id,
        )
        return order

    @staticmethod
    @transaction.atomic
    def transition_status(*, order: Order, new_status: str, actor, notes: str = "") -> Order:
        order = Order.objects.select_for_update().get(pk=order.pk)
        old_status = order.status

        if new_status == old_status:
            return order

        if new_status not in ALLOWED_TRANSITIONS.get(old_status, set()):
            raise ValidationError(f"Invalid order transition from {old_status} to {new_status}.")

        # Role & object-level authorization checks
        role = actor.role
        if role == Role.CUSTOMER:
            if order.customer_id != actor.id:
                raise PermissionDenied("You cannot modify another customer's order.")
            if new_status != Order.Status.CANCELLED:
                raise PermissionDenied("Customers can only cancel eligible orders.")
            if old_status not in (Order.Status.PLACED, Order.Status.CONFIRMED):
                raise ValidationError("Order cannot be cancelled once preparation has started.")

        elif role == Role.RESTAURANT_OWNER:
            if order.restaurant.owner_id != actor.id:
                raise PermissionDenied("You cannot update orders for another restaurant.")
            if new_status not in (
                Order.Status.CONFIRMED,
                Order.Status.PREPARING,
                Order.Status.READY_FOR_PICKUP,
                Order.Status.REJECTED,
            ):
                raise PermissionDenied(f"Restaurant owners cannot transition orders to {new_status}.")
            if new_status == Order.Status.CONFIRMED and order.payment_method != Order.PaymentMethod.COD:
                if order.payment_status != Order.PaymentStatus.PAID:
                    raise ValidationError("Payment must be verified before confirming a prepaid order.")

        elif role == Role.DELIVERY_PARTNER:
            assignment = getattr(order, "delivery_assignment", None)
            if not assignment or not assignment.delivery_partner or assignment.delivery_partner.user_id != actor.id:
                raise PermissionDenied("Only the assigned delivery partner can update this order.")
            if new_status not in (
                Order.Status.PICKED_UP,
                Order.Status.OUT_FOR_DELIVERY,
                Order.Status.DELIVERED,
            ):
                raise PermissionDenied(f"Delivery partners cannot transition orders to {new_status}.")

        elif role != Role.SUPER_ADMIN:
            raise PermissionDenied("Unauthorized role.")

        # Business rule: Delivery partner must be assigned before PICKED_UP
        if new_status == Order.Status.PICKED_UP:
            assignment = getattr(order, "delivery_assignment", None)
            if not assignment or not assignment.delivery_partner:
                raise ValidationError("A delivery partner must be assigned before the order can be picked up.")

        order.status = new_status
        if new_status == Order.Status.REJECTED:
            order.rejection_reason = notes or "Rejected by restaurant."
        if new_status == Order.Status.CANCELLED:
            order.cancellation_reason = notes or "Cancelled by customer."
        order.save()

        OrderStatusHistory.objects.create(
            order=order,
            from_status=old_status,
            to_status=new_status,
            changed_by=actor,
            actor_role=role,
            notes=notes,
        )

        # Refund rule when paid order is cancelled or rejected
        if new_status in (Order.Status.CANCELLED, Order.Status.REJECTED) and order.payment_status == Order.PaymentStatus.PAID:
            from payments.models import Payment, Refund

            payment = Payment.objects.filter(order=order, status=Payment.Status.VERIFIED).first()
            if payment and not Refund.objects.filter(order=order).exists():
                Refund.objects.create(
                    payment=payment,
                    order=order,
                    amount=order.total_amount,
                    reason=notes or f"Automatic refund due to order {new_status.lower()}.",
                    status=Refund.Status.PENDING,
                )
                order.status = Order.Status.REFUND_PENDING
                order.payment_status = Order.PaymentStatus.REFUND_PENDING
                order.save(update_fields=["status", "payment_status", "updated_at"])
                OrderStatusHistory.objects.create(
                    order=order,
                    from_status=new_status,
                    to_status=Order.Status.REFUND_PENDING,
                    changed_by=actor,
                    actor_role=role,
                    notes="Refund initiated for paid order.",
                )

        # Notify customer & restaurant
        dispatch_notification(
            recipient=order.customer,
            title=f"Order {order.order_number}: {order.get_status_display()}",
            message=f"Your order from {order.restaurant.name} is now {order.get_status_display().lower()}.",
            notification_type="ORDER_UPDATE",
            related_order_id=order.id,
        )
        broadcast_order_update(order)
        return order
