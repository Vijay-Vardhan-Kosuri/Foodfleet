from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ComplaintViewSet, ReviewViewSet

router = DefaultRouter()
router.register("complaints", ComplaintViewSet, basename="customer-complaints")
router.register("", ReviewViewSet, basename="reviews")

urlpatterns = [
    path("", include(router.urls)),
]
