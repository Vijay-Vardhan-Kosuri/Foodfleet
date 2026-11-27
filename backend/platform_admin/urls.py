from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    AdminAnalyticsView,
    AdminAuditLogViewSet,
    AdminCategoryViewSet,
    AdminComplaintViewSet,
    AdminConfigView,
    AdminCouponViewSet,
    AdminDashboardOverviewView,
    AdminDeliveryPartnerViewSet,
    AdminOrderViewSet,
    AdminPaymentListView,
    AdminRefundViewSet,
    AdminRestaurantViewSet,
    AdminReviewViewSet,
    AdminUserViewSet,
)

router = DefaultRouter()
router.register("users", AdminUserViewSet, basename="admin-users")
router.register("restaurants", AdminRestaurantViewSet, basename="admin-restaurants")
router.register("delivery-partners", AdminDeliveryPartnerViewSet, basename="admin-delivery-partners")
router.register("orders", AdminOrderViewSet, basename="admin-orders")
router.register("refunds", AdminRefundViewSet, basename="admin-refunds")
router.register("coupons", AdminCouponViewSet, basename="admin-coupons")
router.register("categories", AdminCategoryViewSet, basename="admin-categories")
router.register("reviews", AdminReviewViewSet, basename="admin-reviews")
router.register("complaints", AdminComplaintViewSet, basename="admin-complaints")
router.register("audit-logs", AdminAuditLogViewSet, basename="admin-audit-logs")

urlpatterns = [
    path("dashboard/", AdminDashboardOverviewView.as_view(), name="admin-dashboard"),
    path("analytics/", AdminAnalyticsView.as_view(), name="admin-analytics"),
    path("payments/", AdminPaymentListView.as_view(), name="admin-payments"),
    path("config/", AdminConfigView.as_view(), name="admin-config"),
    path("", include(router.urls)),
]
