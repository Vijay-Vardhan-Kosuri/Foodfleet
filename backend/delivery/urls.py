from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import DeliveryAssignmentViewSet, DeliveryAvailabilityView, DeliveryEarningsView

router = DefaultRouter()
router.register("assignments", DeliveryAssignmentViewSet, basename="delivery-assignments")

urlpatterns = [
    path("availability/", DeliveryAvailabilityView.as_view(), name="delivery-availability"),
    path("earnings/", DeliveryEarningsView.as_view(), name="delivery-earnings"),
    path("", include(router.urls)),
]
