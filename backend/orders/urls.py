from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    ActiveCouponsView,
    CartCouponView,
    CartItemAddView,
    CartItemDetailView,
    CartView,
    OrderViewSet,
)

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="orders")

urlpatterns = [
    path("cart/", CartView.as_view(), name="cart-detail"),
    path("cart/items/", CartItemAddView.as_view(), name="cart-item-add"),
    path("cart/items/<int:item_id>/", CartItemDetailView.as_view(), name="cart-item-detail"),
    path("cart/coupon/", CartCouponView.as_view(), name="cart-coupon"),
    path("coupons/active/", ActiveCouponsView.as_view(), name="active-coupons"),
    path("", include(router.urls)),
]
