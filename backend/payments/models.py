from django.conf import settings
from django.db import models
from orders.models import Order


class Payment(models.Model):
    class Gateway(models.TextChoices):
        RAZORPAY = "RAZORPAY", "Razorpay Test"
        SIMULATED = "SIMULATED", "Simulated Gateway"

    class Status(models.TextChoices):
        CREATED = "CREATED", "Created"
        VERIFIED = "VERIFIED", "Verified"
        FAILED = "FAILED", "Failed"
        REFUNDED = "REFUNDED", "Refunded"

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="payment")
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payments"
    )
    gateway = models.CharField(max_length=24, choices=Gateway.choices, default=Gateway.SIMULATED)
    gateway_order_id = models.CharField(max_length=120, unique=True)
    gateway_payment_id = models.CharField(max_length=120, blank=True, default="")
    gateway_signature = models.CharField(max_length=255, blank=True, default="")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default="INR")
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.CREATED, db_index=True)
    raw_response = models.JSONField(default=dict, blank=True)
    idempotency_key = models.CharField(max_length=100, unique=True, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_payments"
        ordering = ["-created_at"]


class Refund(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSED = "PROCESSED", "Processed"
        REJECTED = "REJECTED", "Rejected"

    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="refunds")
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="refund")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField()
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING, db_index=True)
    gateway_refund_id = models.CharField(max_length=120, blank=True, default="")
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_refunds"
        ordering = ["-created_at"]
