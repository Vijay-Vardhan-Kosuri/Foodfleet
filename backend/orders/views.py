from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.models import Role
from accounts.permissions import IsActiveAuthenticated, IsCustomer
from restaurants.models import FoodItem, RestaurantProfile
from .models import Cart, CartItem, Coupon, Order
from .serializers import CartSerializer, CouponSerializer, CreateOrderSerializer, OrderSerializer
from .services import OrderService


class CartView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        cart, _ = Cart.objects.get_or_create(customer=request.user)
        return Response(CartSerializer(cart, context={"request": request}).data)

    def delete(self, request):
        cart, _ = Cart.objects.get_or_create(customer=request.user)
        cart.items.all().delete()
        cart.restaurant = None
        cart.coupon = None
        cart.save(update_fields=["restaurant", "coupon", "updated_at"])
        return Response(CartSerializer(cart, context={"request": request}).data)


class CartItemAddView(APIView):
    permission_classes = [IsCustomer]

    @transaction.atomic
    def post(self, request):
        food_item_id = request.data.get("food_item_id")
        quantity = int(request.data.get("quantity", 1))
        replace_cart = bool(request.data.get("replace_cart", False))
        if quantity < 1 or quantity > 50:
            raise ValidationError("Quantity must be between 1 and 50.")

        food_item = (
            FoodItem.objects.select_related("restaurant")
            .filter(
                id=food_item_id,
                is_deleted=False,
                is_available=True,
                restaurant__approval_status=RestaurantProfile.ApprovalStatus.APPROVED,
                restaurant__is_deleted=False,
            )
            .first()
        )
        if not food_item:
            return Response({"detail": "Food item is unavailable or not found."}, status=status.HTTP_404_NOT_FOUND)

        cart, _ = Cart.objects.select_for_update().get_or_create(customer=request.user)
        if cart.restaurant and cart.restaurant_id != food_item.restaurant_id and cart.items.exists():
            if not replace_cart:
                return Response(
                    {
                        "success": False,
                        "code": "DIFFERENT_RESTAURANT",
                        "message": f"Your cart contains items from {cart.restaurant.name}. Clear cart to add from {food_item.restaurant.name}?",
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            cart.items.all().delete()
            cart.coupon = None

        cart.restaurant = food_item.restaurant
        cart.save(update_fields=["restaurant", "coupon", "updated_at"])

        cart_item, created = CartItem.objects.get_or_create(
            cart=cart, food_item=food_item, defaults={"quantity": quantity}
        )
        if not created:
            cart_item.quantity = min(50, cart_item.quantity + quantity)
            cart_item.save(update_fields=["quantity", "updated_at"])

        return Response(CartSerializer(cart, context={"request": request}).data, status=status.HTTP_201_CREATED)


class CartItemDetailView(APIView):
    permission_classes = [IsCustomer]

    @transaction.atomic
    def patch(self, request, item_id):
        cart = Cart.objects.filter(customer=request.user).first()
        if not cart:
            return Response({"detail": "Cart not found."}, status=status.HTTP_404_NOT_FOUND)
        item = CartItem.objects.filter(id=item_id, cart=cart).first()
        if not item:
            return Response({"detail": "Cart item not found."}, status=status.HTTP_404_NOT_FOUND)

        quantity = int(request.data.get("quantity", 1))
        if quantity <= 0:
            item.delete()
            if not cart.items.exists():
                cart.restaurant = None
                cart.coupon = None
                cart.save(update_fields=["restaurant", "coupon", "updated_at"])
        else:
            item.quantity = min(50, quantity)
            item.save(update_fields=["quantity", "updated_at"])
        return Response(CartSerializer(cart, context={"request": request}).data)

    @transaction.atomic
    def delete(self, request, item_id):
        cart = Cart.objects.filter(customer=request.user).first()
        if not cart:
            return Response({"detail": "Cart not found."}, status=status.HTTP_404_NOT_FOUND)
        item = CartItem.objects.filter(id=item_id, cart=cart).first()
        if not item:
            return Response({"detail": "Cart item not found."}, status=status.HTTP_404_NOT_FOUND)
        item.delete()
        if not cart.items.exists():
            cart.restaurant = None
            cart.coupon = None
            cart.save(update_fields=["restaurant", "coupon", "updated_at"])
        return Response(CartSerializer(cart, context={"request": request}).data)


class CartCouponView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        code = (request.data.get("code") or "").strip().upper()
        cart, _ = Cart.objects.get_or_create(customer=request.user)
        coupon = Coupon.objects.filter(code__iexact=code).first()
        if not coupon:
            raise ValidationError("Invalid coupon code.")
        from .services import compute_cart_totals

        subtotal = sum(i.food_item.effective_price * i.quantity for i in cart.items.select_related("food_item"))
        valid, err = coupon.is_valid_for_amount(subtotal)
        if not valid:
            raise ValidationError(err)
        cart.coupon = coupon
        cart.save(update_fields=["coupon", "updated_at"])
        return Response(CartSerializer(cart, context={"request": request}).data)

    def delete(self, request):
        cart, _ = Cart.objects.get_or_create(customer=request.user)
        cart.coupon = None
        cart.save(update_fields=["coupon", "updated_at"])
        return Response(CartSerializer(cart, context={"request": request}).data)


class ActiveCouponsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.utils import timezone

        now = timezone.now()
        coupons = Coupon.objects.filter(is_active=True, valid_from__lte=now, valid_until__gte=now)
        return Response(CouponSerializer(coupons, many=True).data)


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    filterset_fields = ["status", "payment_status"]
    search_fields = ["order_number", "restaurant__name", "customer__email"]

    def get_permissions(self):
        if self.action == "create":
            return [IsCustomer()]
        return [IsActiveAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        base = (
            Order.objects.select_related("customer", "restaurant", "restaurant__address", "delivery_assignment")
            .prefetch_related("items", "status_history")
        )
        if user.role == Role.SUPER_ADMIN:
            return base
        if user.role == Role.CUSTOMER:
            return base.filter(customer=user)
        if user.role == Role.RESTAURANT_OWNER:
            return base.filter(restaurant__owner=user)
        if user.role == Role.DELIVERY_PARTNER:
            return base.filter(delivery_assignment__delivery_partner__user=user)
        return Order.objects.none()

    def create(self, request, *args, **kwargs):
        serializer = CreateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = OrderService.create_order_from_cart(
            customer=request.user,
            address_id=serializer.validated_data["address_id"],
            payment_method=serializer.validated_data["payment_method"],
            special_instructions=serializer.validated_data.get("special_instructions", ""),
            idempotency_key=serializer.validated_data.get("idempotency_key"),
        )
        return Response(OrderSerializer(order, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path="status")
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get("status")
        notes = request.data.get("notes", "")
        if not new_status:
            raise ValidationError("Target status is required.")
        updated = OrderService.transition_status(
            order=order, new_status=new_status, actor=request.user, notes=notes
        )
        return Response(OrderSerializer(updated, context={"request": request}).data)
