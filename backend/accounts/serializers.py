import secrets
from datetime import timedelta
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Address, CustomerProfile, DeliveryPartnerProfile, Role, User


class CustomerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerProfile
        fields = ["id", "default_city", "dietary_preference", "loyalty_points", "created_at", "updated_at"]
        read_only_fields = ["id", "loyalty_points", "created_at", "updated_at"]


class DeliveryPartnerProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()
    phone = serializers.CharField(source="user.phone", read_only=True)

    class Meta:
        model = DeliveryPartnerProfile
        fields = [
            "id",
            "email",
            "full_name",
            "phone",
            "vehicle_type",
            "vehicle_number",
            "license_number",
            "verification_status",
            "id_document",
            "license_document",
            "availability_status",
            "current_lat",
            "current_lng",
            "total_deliveries",
            "rating_avg",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "verification_status",
            "total_deliveries",
            "rating_avg",
            "created_at",
            "updated_at",
        ]

    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    customer_profile = CustomerProfileSerializer(read_only=True)
    delivery_profile = DeliveryPartnerProfileSerializer(read_only=True)
    restaurant_id = serializers.SerializerMethodField()
    restaurant_approval_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "role",
            "is_active",
            "is_suspended",
            "avatar",
            "customer_profile",
            "delivery_profile",
            "restaurant_id",
            "restaurant_approval_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "role", "is_active", "is_suspended", "created_at", "updated_at"]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def get_restaurant_id(self, obj):
        if obj.role == Role.RESTAURANT_OWNER and hasattr(obj, "owned_restaurant"):
            return obj.owned_restaurant.id
        return None

    def get_restaurant_approval_status(self, obj):
        if obj.role == Role.RESTAURANT_OWNER and hasattr(obj, "owned_restaurant"):
            return obj.owned_restaurant.approval_status
        return None


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    username = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    role = serializers.ChoiceField(
        choices=[
            (Role.CUSTOMER, "Customer"),
            (Role.RESTAURANT_OWNER, "Restaurant Owner"),
            (Role.DELIVERY_PARTNER, "Delivery Partner"),
        ],
        default=Role.CUSTOMER,
    )
    vehicle_type = serializers.CharField(max_length=40, required=False, default="Motorbike")
    vehicle_number = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    license_number = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    default_city = serializers.CharField(max_length=100, required=False, default="Bengaluru")

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    def validate_password(self, value):
        validate_password(value)
        return value

    @transaction.atomic
    def create(self, validated_data):
        email = validated_data["email"]
        raw_username = (validated_data.get("username") or email.split("@")[0]).strip()
        username = raw_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{raw_username}{counter}"
            counter += 1

        role = validated_data["role"]
        user = User.objects.create_user(
            username=username,
            email=email,
            password=validated_data["password"],
            first_name=validated_data["first_name"].strip(),
            last_name=validated_data.get("last_name", "").strip(),
            phone=validated_data.get("phone", "").strip(),
            role=role,
        )

        if role == Role.CUSTOMER:
            CustomerProfile.objects.create(
                user=user,
                default_city=validated_data.get("default_city", "Bengaluru"),
            )
        elif role == Role.DELIVERY_PARTNER:
            DeliveryPartnerProfile.objects.create(
                user=user,
                vehicle_type=validated_data.get("vehicle_type", "Motorbike"),
                vehicle_number=validated_data.get("vehicle_number", ""),
                license_number=validated_data.get("license_number", ""),
            )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        password = attrs["password"]
        user = authenticate(request=self.context.get("request"), username=email, password=password)
        if not user:
            # Fallback if someone passed username instead of email
            try:
                user_obj = User.objects.get(email__iexact=email)
                if not user_obj.check_password(password):
                    raise serializers.ValidationError("Invalid email or password.")
                user = user_obj
            except User.DoesNotExist:
                raise serializers.ValidationError("Invalid email or password.")

        if not user.is_active:
            raise serializers.ValidationError("This account has been deactivated.")
        if user.is_suspended:
            raise serializers.ValidationError("This account is currently suspended. Please contact support.")

        refresh = RefreshToken.for_user(user)
        return {
            "user": user,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = [
            "id",
            "label",
            "street_address",
            "apartment",
            "city",
            "state",
            "postal_code",
            "country",
            "latitude",
            "longitude",
            "is_default",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        if validated_data.get("is_default"):
            Address.objects.filter(user=user, is_deleted=False).update(is_default=False)
        elif not Address.objects.filter(user=user, is_deleted=False).exists():
            validated_data["is_default"] = True
        return Address.objects.create(user=user, **validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        if validated_data.get("is_default"):
            Address.objects.filter(user=instance.user, is_deleted=False).exclude(pk=instance.pk).update(
                is_default=False
            )
        return super().update(instance, validated_data)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def create_reset_token(self):
        email = self.validated_data["email"].strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return None
        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expires_at = timezone.now() + timedelta(hours=1)
        user.save(update_fields=["reset_token", "reset_token_expires_at"])
        return token


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def save(self):
        token = self.validated_data["token"]
        user = User.objects.filter(
            reset_token=token, reset_token_expires_at__gte=timezone.now()
        ).first()
        if not user:
            raise serializers.ValidationError({"token": "Reset token is invalid or has expired."})
        user.set_password(self.validated_data["new_password"])
        user.reset_token = None
        user.reset_token_expires_at = None
        user.save()
        return user
