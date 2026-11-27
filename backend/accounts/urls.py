from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    AddressViewSet,
    DeliveryPartnerSelfView,
    DemoAccountsView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    ProfileView,
    RegisterView,
    ResetPasswordView,
)

router = DefaultRouter()
router.register("addresses", AddressViewSet, basename="customer-addresses")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("profile/", ProfileView.as_view(), name="auth-profile"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("reset-password/", ResetPasswordView.as_view(), name="auth-reset-password"),
    path("delivery-profile/", DeliveryPartnerSelfView.as_view(), name="delivery-self-profile"),
    path("demo-accounts/", DemoAccountsView.as_view(), name="auth-demo-accounts"),
    path("", include(router.urls)),
]
