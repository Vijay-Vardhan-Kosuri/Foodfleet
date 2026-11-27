from django.db import models
from accounts.models import DeliveryPartnerProfile
from orders.models import Order


class DeliveryAssignment(models.Model):
    class Status(models.TextChoices):
        ASSIGNED = "ASSIGNED", "Assigned"
        ACCEPTED = "ACCEPTED", "Accepted"
        ARRIVED_AT_RESTAURANT = "ARRIVED_AT_RESTAURANT", "Arrived at Restaurant"
        PICKED_UP = "PICKED_UP", "Picked Up"
        OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY", "Out for Delivery"
        DELIVERED = "DELIVERED", "Delivered"
        REJECTED = "REJECTED", "Rejected"

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="delivery_assignment")
    delivery_partner = models.ForeignKey(
        DeliveryPartnerProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignments",
    )
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.ASSIGNED, db_index=True)
    delivery_fee_earned = models.DecimalField(max_digits=8, decimal_places=2, default=40.00)
    assigned_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(blank=True, null=True)
    picked_up_at = models.DateTimeField(blank=True, null=True)
    delivered_at = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_delivery_assignments"
        ordering = ["-assigned_at"]

    def __str__(self):
        return f"Assignment<{self.order.order_number} -> {self.status}>"
