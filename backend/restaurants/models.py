from django.conf import settings
from django.db import models
from django.utils.text import slugify
from accounts.validators import validate_uploaded_image


class CuisineCategory(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)
    description = models.CharField(max_length=255, blank=True, default="")
    image_url = models.URLField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_cuisine_categories"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class RestaurantProfile(models.Model):
    class ApprovalStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        SUSPENDED = "SUSPENDED", "Suspended"

    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_restaurant"
    )
    name = models.CharField(max_length=150, db_index=True)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    description = models.TextField(blank=True, default="")
    cuisines = models.ManyToManyField(CuisineCategory, related_name="restaurants", blank=True)
    phone = models.CharField(max_length=20)
    email = models.EmailField(max_length=191)
    logo = models.ImageField(
        upload_to="restaurants/logos/", blank=True, null=True, validators=[validate_uploaded_image]
    )
    cover_image = models.ImageField(
        upload_to="restaurants/covers/", blank=True, null=True, validators=[validate_uploaded_image]
    )
    image_url = models.URLField(max_length=500, blank=True, default="")
    approval_status = models.CharField(
        max_length=20, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING, db_index=True
    )
    rejection_reason = models.TextField(blank=True, default="")
    is_open = models.BooleanField(default=True, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=4.50, db_index=True)
    total_reviews = models.PositiveIntegerField(default=0)
    avg_delivery_time_mins = models.PositiveIntegerField(default=30, db_index=True)
    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=35.00)
    min_order_amount = models.DecimalField(max_digits=8, decimal_places=2, default=149.00)
    price_for_two = models.DecimalField(max_digits=8, decimal_places=2, default=450.00, db_index=True)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)
    is_deleted = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_restaurants"
        ordering = ["-is_featured", "-average_rating", "name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or "restaurant"
            slug = base
            counter = 1
            while RestaurantProfile.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.approval_status})"


class RestaurantAddress(models.Model):
    restaurant = models.OneToOneField(
        RestaurantProfile, on_delete=models.CASCADE, related_name="address"
    )
    street_address = models.CharField(max_length=255)
    city = models.CharField(max_length=100, db_index=True)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, default=12.971599)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, default=77.594563)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_restaurant_addresses"

    def __str__(self):
        return f"{self.street_address}, {self.city}"


class RestaurantOperatingHours(models.Model):
    DAYS = [
        (0, "Monday"),
        (1, "Tuesday"),
        (2, "Wednesday"),
        (3, "Thursday"),
        (4, "Friday"),
        (5, "Saturday"),
        (6, "Sunday"),
    ]
    restaurant = models.ForeignKey(
        RestaurantProfile, on_delete=models.CASCADE, related_name="operating_hours"
    )
    day_of_week = models.PositiveSmallIntegerField(choices=DAYS)
    open_time = models.TimeField(default="09:00")
    close_time = models.TimeField(default="23:00")
    is_closed = models.BooleanField(default=False)

    class Meta:
        db_table = "ff_restaurant_operating_hours"
        unique_together = ("restaurant", "day_of_week")
        ordering = ["day_of_week"]


class FoodCategory(models.Model):
    restaurant = models.ForeignKey(
        RestaurantProfile, on_delete=models.CASCADE, related_name="food_categories"
    )
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True, default="")
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_food_categories"
        unique_together = ("restaurant", "name")
        ordering = ["sort_order", "name"]

    def __str__(self):
        return f"{self.restaurant.name} - {self.name}"


class FoodItem(models.Model):
    class SpiceLevel(models.TextChoices):
        MILD = "MILD", "Mild"
        MEDIUM = "MEDIUM", "Medium"
        SPICY = "SPICY", "Spicy"
        EXTRA_SPICY = "EXTRA_SPICY", "Extra Spicy"

    restaurant = models.ForeignKey(
        RestaurantProfile, on_delete=models.CASCADE, related_name="food_items"
    )
    category = models.ForeignKey(
        FoodCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="items"
    )
    name = models.CharField(max_length=150, db_index=True)
    description = models.TextField(blank=True, default="")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    image = models.ImageField(
        upload_to="food_items/", blank=True, null=True, validators=[validate_uploaded_image]
    )
    image_url = models.URLField(max_length=500, blank=True, default="")
    is_vegetarian = models.BooleanField(default=False, db_index=True)
    is_available = models.BooleanField(default=True, db_index=True)
    preparation_time_mins = models.PositiveIntegerField(default=15)
    calories = models.PositiveIntegerField(blank=True, null=True)
    spice_level = models.CharField(max_length=20, choices=SpiceLevel.choices, default=SpiceLevel.MEDIUM)
    order_count = models.PositiveIntegerField(default=0)
    is_deleted = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_food_items"
        ordering = ["-order_count", "name"]
        indexes = [
            models.Index(fields=["restaurant", "is_available", "is_deleted"]),
        ]

    @property
    def effective_price(self):
        if self.discount_price is not None and self.discount_price < self.price:
            return self.discount_price
        return self.price

    def __str__(self):
        return f"{self.name} ({self.restaurant.name})"


class FavouriteRestaurant(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favourite_restaurants"
    )
    restaurant = models.ForeignKey(
        RestaurantProfile, on_delete=models.CASCADE, related_name="favourited_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ff_favourite_restaurants"
        unique_together = ("user", "restaurant")
        ordering = ["-created_at"]
