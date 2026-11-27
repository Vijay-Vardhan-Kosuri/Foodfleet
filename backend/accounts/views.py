from django.conf import settings
from django.db import transaction
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from .models import Address, DeliveryPartnerProfile, Role
from .permissions import IsActiveAuthenticated, IsCustomer, IsDeliveryPartner
from .serializers import (
    AddressSerializer,
    DeliveryPartnerProfileSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    UserSerializer,
)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_sensitive"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "success": True,
                "user": UserSerializer(user, context={"request": request}).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_sensitive"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return Response(
            {
                "success": True,
                "user": UserSerializer(data["user"], context={"request": request}).data,
                "access": data["access"],
                "refresh": data["refresh"],
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass
        return Response({"success": True, "message": "Logged out successfully."}, status=status.HTTP_200_OK)


class ProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsActiveAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

    @transaction.atomic
    def patch(self, request, *args, **kwargs):
        user = self.get_object()
        for field in ("first_name", "last_name", "phone", "avatar"):
            if field in request.data:
                setattr(user, field, request.data[field])
        user.full_clean()
        user.save()
        if user.role == Role.CUSTOMER and hasattr(user, "customer_profile"):
            cp = user.customer_profile
            if "default_city" in request.data:
                cp.default_city = request.data["default_city"]
            if "dietary_preference" in request.data:
                cp.dietary_preference = request.data["dietary_preference"]
            cp.save()
        return Response(UserSerializer(user, context={"request": request}).data)


class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_sensitive"

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.create_reset_token()
        payload = {
            "success": True,
            "message": "If an account exists for this email, password reset instructions have been generated.",
        }
        if settings.DEBUG and token:
            payload["dev_reset_token"] = token
        return Response(payload)


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_sensitive"

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"success": True, "message": "Password reset successfully. You may now log in."})


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [IsCustomer]
    pagination_class = None

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user, is_deleted=False)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.is_default = False
        instance.save(update_fields=["is_deleted", "is_default"])


class DeliveryPartnerSelfView(APIView):
    permission_classes = [IsDeliveryPartner]

    def get(self, request):
        profile, _ = DeliveryPartnerProfile.objects.get_or_create(user=request.user)
        return Response(DeliveryPartnerProfileSerializer(profile, context={"request": request}).data)

    def patch(self, request):
        profile, _ = DeliveryPartnerProfile.objects.get_or_create(user=request.user)
        serializer = DeliveryPartnerProfileSerializer(
            profile, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DemoAccountsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not settings.ENABLE_DEMO_ACCOUNTS:
            return Response({"detail": "Demo accounts are disabled."}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {
                "demo_accounts": [
                    {"role": "SUPER_ADMIN", "email": "admin@foodfleet.dev", "password": "Password123!"},
                    {"role": "CUSTOMER", "email": "customer@foodfleet.dev", "password": "Password123!"},
                    {"role": "RESTAURANT_OWNER", "email": "owner@foodfleet.dev", "password": "Password123!"},
                    {"role": "DELIVERY_PARTNER", "email": "rider@foodfleet.dev", "password": "Password123!"},
                ]
            }
        )
