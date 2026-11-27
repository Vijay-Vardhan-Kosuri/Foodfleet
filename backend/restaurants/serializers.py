from rest_framework import serializers
from .models import (
    CuisineCategory,
    FavouriteRestaurant,
    FoodCategory,
    FoodItem,
    RestaurantAddress,
    RestaurantOperatingHours,
    RestaurantProfile,
)


class CuisineCategorySerializer(serializers.ModelSerializer):
    restaurant_count = serializers.SerializerMethodField()

    class Meta:
        model = CuisineCategory
        fields = ["id", "name", "slug", "description", "image_url", "is_active", "restaurant_count"]
        read_only_fields = ["id", "slug", "restaurant_count"]

    def get_restaurant_count(self, obj):
        return obj.restaurants.filter(
            approval_status=RestaurantProfile.ApprovalStatus.APPROVED, is_deleted=False
        ).count()


class RestaurantAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantAddress
        fields = ["id", "street_address", "city", "state", "postal_code", "latitude", "longitude"]


class RestaurantOperatingHoursSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source="get_day_of_week_display", read_only=True)

    class Meta:
        model = RestaurantOperatingHours
        fields = ["id", "day_of_week", "day_name", "open_time", "close_time", "is_closed"]


class FoodCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodCategory
        fields = ["id", "restaurant", "name", "description", "sort_order", "is_active"]
        read_only_fields = ["id", "restaurant"]


class FoodItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default="")
    restaurant_name = serializers.CharField(source="restaurant.name", read_only=True)
    effective_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = FoodItem
        fields = [
            "id",
            "restaurant",
            "restaurant_name",
            "category",
            "category_name",
            "name",
            "description",
            "price",
            "discount_price",
            "effective_price",
            "image",
            "image_url",
            "is_vegetarian",
            "is_available",
            "preparation_time_mins",
            "calories",
            "spice_level",
            "order_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "restaurant", "order_count", "created_at", "updated_at"]

    def validate(self, attrs):
        price = attrs.get("price", getattr(self.instance, "price", None))
        discount_price = attrs.get("discount_price", getattr(self.instance, "discount_price", None))
        if price is not None and price <= 0:
            raise serializers.ValidationError({"price": "Price must be greater than zero."})
        if discount_price is not None and price is not None and discount_price >= price:
            raise serializers.ValidationError({"discount_price": "Discount price must be less than regular price."})
        return attrs


class RestaurantProfileSerializer(serializers.ModelSerializer):
    cuisines = CuisineCategorySerializer(many=True, read_only=True)
    cuisine_ids = serializers.PrimaryKeyRelatedField(
        queryset=CuisineCategory.objects.filter(is_active=True),
        many=True,
        write_only=True,
        required=False,
        source="cuisines",
    )
    address = RestaurantAddressSerializer(required=False)
    operating_hours = RestaurantOperatingHoursSerializer(many=True, read_only=True)
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    owner_name = serializers.SerializerMethodField()
    is_favourite = serializers.SerializerMethodField()

    class Meta:
        model = RestaurantProfile
        fields = [
            "id",
            "owner",
            "owner_email",
            "owner_name",
            "name",
            "slug",
            "description",
            "cuisines",
            "cuisine_ids",
            "phone",
            "email",
            "logo",
            "cover_image",
            "image_url",
            "approval_status",
            "rejection_reason",
            "is_open",
            "is_featured",
            "average_rating",
            "total_reviews",
            "avg_delivery_time_mins",
            "delivery_fee",
            "min_order_amount",
            "price_for_two",
            "commission_rate",
            "address",
            "operating_hours",
            "is_favourite",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "owner",
            "slug",
            "approval_status",
            "rejection_reason",
            "is_featured",
            "average_rating",
            "total_reviews",
            "commission_rate",
            "created_at",
            "updated_at",
        ]

    def get_owner_name(self, obj):
        return f"{obj.owner.first_name} {obj.owner.last_name}".strip() or obj.owner.username

    def get_is_favourite(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return FavouriteRestaurant.objects.filter(user=request.user, restaurant=obj).exists()
        return False

    def create(self, validated_data):
        address_data = validated_data.pop("address", None)
        cuisines = validated_data.pop("cuisines", [])
        restaurant = RestaurantProfile.objects.create(**validated_data)
        if cuisines:
            restaurant.cuisines.set(cuisines)
        if address_data:
            RestaurantAddress.objects.create(restaurant=restaurant, **address_data)
        for day in range(7):
            RestaurantOperatingHours.objects.create(restaurant=restaurant, day_of_week=day)
        return restaurant

    def update(self, instance, validated_data):
        address_data = validated_data.pop("address", None)
        cuisines = validated_data.pop("cuisines", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if cuisines is not None:
            instance.cuisines.set(cuisines)
        if address_data:
            RestaurantAddress.objects.update_or_create(restaurant=instance, defaults=address_data)
        return instance


class FavouriteRestaurantSerializer(serializers.ModelSerializer):
    restaurant_detail = RestaurantProfileSerializer(source="restaurant", read_only=True)

    class Meta:
        model = FavouriteRestaurant
        fields = ["id", "restaurant", "restaurant_detail", "created_at"]
        read_only_fields = ["id", "created_at"]
