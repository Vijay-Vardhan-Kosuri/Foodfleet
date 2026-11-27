import uuid
from decimal import Decimal
from django.conf import settings
from django.db import models
from django.utils import timezone
from restaurants.models import FoodItem, RestaurantProfile


class Coupon(models.Model):
    class DiscountType(models.TextChoices):
        PERCENTAGE = "PERCENTAGE", "Percentage"
        FIXED = "FIXED", "Fixed Amount"

    code = models.CharField(max_length=40, unique=True)
    description = models.CharField(max_length=255, blank=True, default="")
    discount_type = models.CharField(max_length=20, choices=DiscountType.choices, default=DiscountType.PERCENTAGE)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    min_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_discount_amount = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    valid_from = models.DateTimeField(default=timezone.now)
    valid_until = models.DateTimeField()
    usage_limit = models.PositiveIntegerField(default=1000)
    used_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_coupons"
        ordering = ["-created_at"]

    def is_valid_for_amount(self, subtotal: Decimal) -> tuple[bool, str]:
        now = timezone.now()
        if not self.is_active:
            return False, "This coupon is inactive."
        if now < self.valid_from or now > self.valid_until:
            return False, "This coupon has expired or is not yet active."
        if self.used_count >= self.usage_limit:
            return False, "Coupon usage limit has been reached."
        if subtotal < self.min_order_amount:
            return False, f"Minimum order amount of ₹{self.min_order_amount} is required."
        return True, ""

    def calculate_discount(self, subtotal: Decimal) -> Decimal:
        if self.discount_type == self.DiscountType.PERCENTAGE:
            discount = (subtotal * self.discount_value) / Decimal("100")
            if self.max_discount_amount is not None:
                discount = min(discount, self.max_discount_amount)
        else:
            discount = self.discount_value
        return min(discount, subtotal).quantize(Decimal("0.01"))

    def __str__(self):
        return self.code


class Cart(models.Model):
    customer = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cart"
    )
    restaurant = models.ForeignKey(
        RestaurantProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name="active_carts"
    )
    coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_carts"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    food_item = models.ForeignKey(FoodItem, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_cart_items"
        unique_together = ("cart", "food_item")


class Order(models.Model):
    class Status(models.TextChoices):
        PLACED = "PLACED", "Placed"
        CONFIRMED = "CONFIRMED", "Confirmed"
        PREPARING = "PREPARING", "Preparing"
        READY_FOR_PICKUP = "READY_FOR_PICKUP", "Ready for Pickup"
        PICKED_UP = "PICKED_UP", "Picked Up"
        OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY", "Out for Delivery"
        DELIVERED = "DELIVERED", "Delivered"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"
        PAYMENT_FAILED = "PAYMENT_FAILED", "Payment Failed"
        REFUND_PENDING = "REFUND_PENDING", "Refund Pending"
        REFUNDED = "REFUNDED", "Refunded"

    class PaymentStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PAID = "PAID", "Paid"
        FAILED = "FAILED", "Failed"
        REFUND_PENDING = "REFUND_PENDING", "Refund Pending"
        REFUNDED = "REFUNDED", "Refunded"

    class PaymentMethod(models.TextChoices):
        RAZORPAY = "RAZORPAY", "Razorpay"
        SIMULATED_CARD = "SIMULATED_CARD", "Card (Test)"
        UPI = "UPI", "UPI"
        COD = "COD", "Cash on Delivery"

    order_number = models.CharField(max_length=32, unique=True, db_index=True)
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders"
    )
    restaurant = models.ForeignKey(
        RestaurantProfile, on_delete=models.PROTECT, related_name="orders"
    )
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PLACED, db_index=True)
    payment_status = models.CharField(
        max_length=24, choices=PaymentStatus.choices, default=PaymentStatus.PENDING, db_index=True
    )
    payment_method = models.CharField(
        max_length=24, choices=PaymentMethod.choices, default=PaymentMethod.SIMULATED_CARD
    )
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    platform_commission = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    restaurant_payout = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_address_snapshot = models.JSONField(default=dict)
    delivery_lat = models.DecimalField(max_digits=9, decimal_places=6, default=12.971599)
    delivery_lng = models.DecimalField(max_digits=9, decimal_places=6, default=77.594563)
    special_instructions = models.TextField(blank=True, default="")
    coupon_code = models.CharField(max_length=40, blank=True, default="")
    idempotency_key = models.CharField(max_length=100, unique=True, blank=True, null=True)
    rejection_reason = models.TextField(blank=True, default="")
    cancellation_reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_orders"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["customer", "status"]),
            models.Index(fields=["restaurant", "status"]),
        ]

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = f"FF-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.order_number} ({self.status})"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    food_item = models.ForeignKey(FoodItem, on_delete=models.SET_NULL, null=True, blank=True)
    food_name_snapshot = models.CharField(max_length=150)
    unit_price_snapshot = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ff_order_items"


class OrderStatusHistory(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="status_history")
    from_status = models.CharField(max_length=24, blank=True, default="")
    to_status = models.CharField(max_length=24)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    actor_role = models.CharField(max_length=24, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ff_order_status_history"
        ordering = ["created_at"]
