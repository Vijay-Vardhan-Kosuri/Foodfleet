from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response({"status": "ok", "service": "FoodFleet API", "version": "1.0.0"})


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("restaurants.urls")),
    path("api/", include("orders.urls")),
    path("api/delivery/", include("delivery.urls")),
    path("api/payments/", include("payments.urls")),
    path("api/reviews/", include("reviews.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/admin/", include("platform_admin.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
