from datetime import timedelta
from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.models import Role
from accounts.permissions import IsActiveAuthenticated, IsCustomer, IsRestaurantOwner, IsSuperAdminOrReadOnly
from orders.models import Order, OrderItem
from .models import (
    CuisineCategory,
    FavouriteRestaurant,
    FoodCategory,
    FoodItem,
    RestaurantOperatingHours,
    RestaurantProfile,
)
from .serializers import (
    CuisineCategorySerializer,
    FavouriteRestaurantSerializer,
    FoodCategorySerializer,
    FoodItemSerializer,
    RestaurantOperatingHoursSerializer,
    RestaurantProfileSerializer,
)


class CuisineCategoryViewSet(viewsets.ModelViewSet):
    queryset = CuisineCategory.objects.filter(is_active=True)
    serializer_class = CuisineCategorySerializer
    permission_classes = [IsSuperAdminOrReadOnly]
    pagination_class = None

    def get_queryset(self):
        if self.request.user.is_authenticated and self.request.user.role == Role.SUPER_ADMIN:
            return CuisineCategory.objects.all()
        return CuisineCategory.objects.filter(is_active=True)


class RestaurantViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantProfileSerializer
    filterset_fields = ["is_open", "is_featured"]
    search_fields = ["name", "description", "cuisines__name", "address__city", "food_items__name"]
    ordering_fields = ["average_rating", "avg_delivery_time_mins", "price_for_two", "created_at"]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "menu"):
            return [permissions.AllowAny()]
        if self.action in ("create", "my_restaurant", "update", "partial_update", "operating_hours", "analytics"):
            return [IsRestaurantOwner()]
        return [IsActiveAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        base_qs = RestaurantProfile.objects.filter(is_deleted=False).select_related("address", "owner").prefetch_related(
            "cuisines", "operating_hours"
        )
        if user.is_authenticated and user.role == Role.DELIVERY_PARTNER and self.action in ("list", "retrieve", "menu"):
            # Delivery partners only view pickup details on assigned orders, not menu browsing
            if self.action == "menu":
                raise PermissionDenied("Delivery partners cannot access restaurant menus.")
        if user.is_authenticated and user.role == Role.SUPER_ADMIN:
            qs = base_qs
        elif user.is_authenticated and user.role == Role.RESTAURANT_OWNER and self.action in (
            "update",
            "partial_update",
            "my_restaurant",
            "operating_hours",
            "analytics",
        ):
            qs = base_qs.filter(owner=user)
        else:
            qs = base_qs.filter(approval_status=RestaurantProfile.ApprovalStatus.APPROVED)

        params = self.request.query_params
        cuisine = params.get("cuisine")
        if cuisine:
            qs = qs.filter(Q(cuisines__slug__iexact=cuisine) | Q(cuisines__name__iexact=cuisine))
        city = params.get("city")
        if city:
            qs = qs.filter(address__city__icontains=city)
        min_rating = params.get("min_rating")
        if min_rating:
            qs = qs.filter(average_rating__gte=min_rating)
        max_delivery_time = params.get("max_delivery_time")
        if max_delivery_time:
            qs = qs.filter(avg_delivery_time_mins__lte=max_delivery_time)
        max_price = params.get("max_price")
        if max_price:
            qs = qs.filter(price_for_two__lte=max_price)
        featured = params.get("featured")
        if featured and featured.lower() in ("true", "1"):
            qs = qs.filter(is_featured=True)
        return qs.distinct()

    def perform_create(self, serializer):
        if RestaurantProfile.objects.filter(owner=self.request.user, is_deleted=False).exists():
            raise ValidationError("You already have a registered restaurant.")
        serializer.save(owner=self.request.user, approval_status=RestaurantProfile.ApprovalStatus.PENDING)

    def perform_update(self, serializer):
        if serializer.instance.owner != self.request.user:
            raise PermissionDenied("You can only modify your own restaurant.")
        serializer.save()

    @action(detail=True, methods=["get"])
    def menu(self, request, pk=None):
        if request.user.is_authenticated and request.user.role == Role.DELIVERY_PARTNER:
            raise PermissionDenied("Delivery partners are not permitted to browse restaurant menus.")
        restaurant = self.get_object()
        categories = FoodCategory.objects.filter(restaurant=restaurant, is_active=True)
        items = FoodItem.objects.filter(restaurant=restaurant, is_deleted=False)
        if not (
            request.user.is_authenticated
            and (request.user == restaurant.owner or request.user.role == Role.SUPER_ADMIN)
        ):
            items = items.filter(is_available=True)

        veg = request.query_params.get("veg")
        if veg and veg.lower() in ("true", "1"):
            items = items.filter(is_vegetarian=True)
        q = request.query_params.get("q")
        if q:
            items = items.filter(Q(name__icontains=q) | Q(description__icontains=q))

        return Response(
            {
                "restaurant": RestaurantProfileSerializer(restaurant, context={"request": request}).data,
                "categories": FoodCategorySerializer(categories, many=True).data,
                "items": FoodItemSerializer(items, many=True, context={"request": request}).data,
            }
        )

    @action(detail=False, methods=["get", "patch"], url_path="my")
    def my_restaurant(self, request):
        restaurant = RestaurantProfile.objects.filter(owner=request.user, is_deleted=False).first()
        if not restaurant:
            return Response({"detail": "No restaurant registered yet."}, status=status.HTTP_404_NOT_FOUND)
        if request.method == "PATCH":
            serializer = self.get_serializer(restaurant, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(self.get_serializer(restaurant).data)

    @action(detail=False, methods=["get", "put"], url_path="my/operating-hours")
    def operating_hours(self, request):
        restaurant = RestaurantProfile.objects.filter(owner=request.user, is_deleted=False).first()
        if not restaurant:
            return Response({"detail": "No restaurant found."}, status=status.HTTP_404_NOT_FOUND)
        if request.method == "PUT":
            hours_list = request.data.get("hours", [])
            for item in hours_list:
                RestaurantOperatingHours.objects.update_or_create(
                    restaurant=restaurant,
                    day_of_week=item["day_of_week"],
                    defaults={
                        "open_time": item.get("open_time", "09:00"),
                        "close_time": item.get("close_time", "23:00"),
                        "is_closed": item.get("is_closed", False),
                    },
                )
        qs = restaurant.operating_hours.all()
        return Response(RestaurantOperatingHoursSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="my/analytics")
    def analytics(self, request):
        restaurant = RestaurantProfile.objects.filter(owner=request.user, is_deleted=False).first()
        if not restaurant:
            return Response({"detail": "No restaurant found."}, status=status.HTTP_404_NOT_FOUND)

        orders = Order.objects.filter(restaurant=restaurant)
        today = timezone.localdate()
        today_orders = orders.filter(created_at__date=today)
        completed = orders.filter(status=Order.Status.DELIVERED)
        pending = orders.filter(
            status__in=[
                Order.Status.PLACED,
                Order.Status.CONFIRMED,
                Order.Status.PREPARING,
                Order.Status.READY_FOR_PICKUP,
            ]
        )

        sales_agg = completed.aggregate(total=Sum("restaurant_payout"), avg=Avg("total_amount"))
        total_sales = float(sales_agg["total"] or 0)
        avg_order_value = float(sales_agg["avg"] or 0)

        since_30 = timezone.now() - timedelta(days=30)
        daily_series = list(
            completed.filter(created_at__gte=since_30)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(revenue=Sum("restaurant_payout"), orders=Count("id"))
            .order_by("day")
        )
        for row in daily_series:
            row["day"] = str(row["day"])
            row["revenue"] = float(row["revenue"] or 0)

        since_12w = timezone.now() - timedelta(weeks=12)
        weekly_series = list(
            completed.filter(created_at__gte=since_12w)
            .annotate(week=TruncWeek("created_at"))
            .values("week")
            .annotate(revenue=Sum("restaurant_payout"), orders=Count("id"))
            .order_by("week")
        )
        for row in weekly_series:
            row["week"] = str(row["week"].date()) if hasattr(row["week"], "date") else str(row["week"])
            row["revenue"] = float(row["revenue"] or 0)

        since_12m = timezone.now() - timedelta(days=365)
        monthly_series = list(
            completed.filter(created_at__gte=since_12m)
            .annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(revenue=Sum("restaurant_payout"), orders=Count("id"))
            .order_by("month")
        )
        for row in monthly_series:
            row["month"] = row["month"].strftime("%Y-%m") if hasattr(row["month"], "strftime") else str(row["month"])
            row["revenue"] = float(row["revenue"] or 0)

        best_selling = list(
            OrderItem.objects.filter(order__restaurant=restaurant, order__status=Order.Status.DELIVERED)
            .values("food_name_snapshot")
            .annotate(quantity=Sum("quantity"), revenue=Sum("total_price"))
            .order_by("-quantity")[:6]
        )
        for item in best_selling:
            item["revenue"] = float(item["revenue"] or 0)

        status_dist = list(orders.values("status").annotate(count=Count("id")).order_by("-count"))

        return Response(
            {
                "total_orders": orders.count(),
                "today_orders": today_orders.count(),
                "pending_orders": pending.count(),
                "completed_orders": completed.count(),
                "total_sales": round(total_sales, 2),
                "average_order_value": round(avg_order_value, 2),
                "daily_sales": daily_series,
                "weekly_sales": weekly_series,
                "monthly_revenue": monthly_series,
                "best_selling_items": best_selling,
                "status_distribution": status_dist,
            }
        )


class FoodCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = FoodCategorySerializer
    permission_classes = [IsRestaurantOwner]
    pagination_class = None

    def get_queryset(self):
        return FoodCategory.objects.filter(restaurant__owner=self.request.user)

    def perform_create(self, serializer):
        restaurant = RestaurantProfile.objects.filter(owner=self.request.user, is_deleted=False).first()
        if not restaurant:
            raise ValidationError("Register your restaurant before creating menu categories.")
        serializer.save(restaurant=restaurant)


class FoodItemViewSet(viewsets.ModelViewSet):
    serializer_class = FoodItemSerializer
    search_fields = ["name", "description", "restaurant__name"]
    filterset_fields = ["restaurant", "category", "is_vegetarian", "is_available"]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [IsRestaurantOwner()]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and user.role == Role.DELIVERY_PARTNER:
            raise PermissionDenied("Delivery partners cannot access restaurant menus.")
        qs = FoodItem.objects.filter(is_deleted=False).select_related("restaurant", "category")
        if user.is_authenticated and user.role == Role.RESTAURANT_OWNER and self.action in (
            "update",
            "partial_update",
            "destroy",
        ):
            return qs.filter(restaurant__owner=user)
        if user.is_authenticated and user.role == Role.RESTAURANT_OWNER and self.request.query_params.get("mine"):
            return qs.filter(restaurant__owner=user)
        return qs.filter(
            restaurant__approval_status=RestaurantProfile.ApprovalStatus.APPROVED,
            restaurant__is_deleted=False,
        )

    def perform_create(self, serializer):
        restaurant = RestaurantProfile.objects.filter(owner=self.request.user, is_deleted=False).first()
        if not restaurant:
            raise ValidationError("Register a restaurant before adding food items.")
        category = serializer.validated_data.get("category")
        if category and category.restaurant_id != restaurant.id:
            raise PermissionDenied("Selected category does not belong to your restaurant.")
        serializer.save(restaurant=restaurant)

    def perform_update(self, serializer):
        if serializer.instance.restaurant.owner != self.request.user:
            raise PermissionDenied("You cannot edit food items belonging to another restaurant.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.restaurant.owner != self.request.user:
            raise PermissionDenied("You cannot delete food items belonging to another restaurant.")
        instance.is_deleted = True
        instance.is_available = False
        instance.save(update_fields=["is_deleted", "is_available"])


class FavouriteRestaurantView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        favs = FavouriteRestaurant.objects.filter(user=request.user).select_related("restaurant", "restaurant__address")
        return Response(FavouriteRestaurantSerializer(favs, many=True, context={"request": request}).data)

    def post(self, request):
        restaurant_id = request.data.get("restaurant_id")
        restaurant = RestaurantProfile.objects.filter(
            id=restaurant_id, approval_status=RestaurantProfile.ApprovalStatus.APPROVED, is_deleted=False
        ).first()
        if not restaurant:
            return Response({"detail": "Restaurant not found."}, status=status.HTTP_404_NOT_FOUND)
        fav, created = FavouriteRestaurant.objects.get_or_create(user=request.user, restaurant=restaurant)
        if not created:
            fav.delete()
            return Response({"is_favourite": False})
        return Response({"is_favourite": True}, status=status.HTTP_201_CREATED)
