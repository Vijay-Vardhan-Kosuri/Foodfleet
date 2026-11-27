from django.contrib.auth.models import AbstractUser
from django.db import models
from .validators import validate_uploaded_image, validate_uploaded_document


class Role(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
    CUSTOMER = "CUSTOMER", "Customer"
    RESTAURANT_OWNER = "RESTAURANT_OWNER", "Restaurant Owner"
    DELIVERY_PARTNER = "DELIVERY_PARTNER", "Delivery Partner"


class User(AbstractUser):
    """Custom FoodFleet User enforcing strict single-primary-role RBAC."""

    email = models.EmailField(unique=True, max_length=191)
    role = models.CharField(max_length=24, choices=Role.choices, default=Role.CUSTOMER, db_index=True)
    phone = models.CharField(max_length=20, blank=True, default="")
    is_suspended = models.BooleanField(default=False, db_index=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True, validators=[validate_uploaded_image])
    reset_token = models.CharField(max_length=128, blank=True, null=True)
    reset_token_expires_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "ff_users"
        indexes = [
            models.Index(fields=["role", "is_suspended"]),
        ]

    def __str__(self):
        return f"{self.email} ({self.role})"


class CustomerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="customer_profile")
    default_city = models.CharField(max_length=100, blank=True, default="Bengaluru")
    dietary_preference = models.CharField(max_length=40, blank=True, default="ALL")
    loyalty_points = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_customer_profiles"

    def __str__(self):
        return f"CustomerProfile<{self.user.email}>"


class DeliveryPartnerProfile(models.Model):
    class VerificationStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        REJECTED = "REJECTED", "Rejected"

    class AvailabilityStatus(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        BUSY = "BUSY", "Busy"
        OFFLINE = "OFFLINE", "Offline"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="delivery_profile")
    vehicle_type = models.CharField(max_length=40, default="Motorbike")
    vehicle_number = models.CharField(max_length=40, blank=True, default="")
    license_number = models.CharField(max_length=60, blank=True, default="")
    verification_status = models.CharField(
        max_length=20, choices=VerificationStatus.choices, default=VerificationStatus.PENDING, db_index=True
    )
    id_document = models.FileField(
        upload_to="partner_docs/ids/", blank=True, null=True, validators=[validate_uploaded_document]
    )
    license_document = models.FileField(
        upload_to="partner_docs/licenses/", blank=True, null=True, validators=[validate_uploaded_document]
    )
    availability_status = models.CharField(
        max_length=20, choices=AvailabilityStatus.choices, default=AvailabilityStatus.OFFLINE, db_index=True
    )
    current_lat = models.DecimalField(max_digits=9, decimal_places=6, default=12.971599)
    current_lng = models.DecimalField(max_digits=9, decimal_places=6, default=77.594563)
    total_deliveries = models.PositiveIntegerField(default=0)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=5.00)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_delivery_partner_profiles"

    def __str__(self):
        return f"DeliveryPartner<{self.user.email}>"


class Address(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addresses")
    label = models.CharField(max_length=50, default="Home")
    street_address = models.CharField(max_length=255)
    apartment = models.CharField(max_length=100, blank=True, default="")
    city = models.CharField(max_length=100, db_index=True)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=80, default="India")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, default=12.971599)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, default=77.594563)
    is_default = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_addresses"
        ordering = ["-is_default", "-updated_at"]

    def __str__(self):
        return f"{self.label}: {self.street_address}, {self.city}"
