from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    CuisineCategoryViewSet,
    FavouriteRestaurantView,
    FoodCategoryViewSet,
    FoodItemViewSet,
    RestaurantViewSet,
)

router = DefaultRouter()
router.register("cuisines", CuisineCategoryViewSet, basename="cuisine-categories")
router.register("restaurants", RestaurantViewSet, basename="restaurants")
router.register("food-categories", FoodCategoryViewSet, basename="food-categories")
router.register("food", FoodItemViewSet, basename="food-items")

urlpatterns = [
    path("favourites/", FavouriteRestaurantView.as_view(), name="customer-favourites"),
    path("", include(router.urls)),
]
