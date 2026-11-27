from rest_framework.permissions import BasePermission
from .models import Role


def _is_valid_user(request):
    user = getattr(request, "user", None)
    return bool(user and user.is_authenticated and user.is_active and not getattr(user, "is_suspended", False))


class IsActiveAuthenticated(BasePermission):
    message = "Authentication required with an active, non-suspended account."

    def has_permission(self, request, view):
        return _is_valid_user(request)


class IsSuperAdmin(BasePermission):
    message = "Super Admin privileges are required for this action."

    def has_permission(self, request, view):
        return _is_valid_user(request) and request.user.role == Role.SUPER_ADMIN


class IsCustomer(BasePermission):
    message = "Customer role is required for this action."

    def has_permission(self, request, view):
        return _is_valid_user(request) and request.user.role == Role.CUSTOMER


class IsRestaurantOwner(BasePermission):
    message = "Restaurant Owner role is required for this action."

    def has_permission(self, request, view):
        return _is_valid_user(request) and request.user.role == Role.RESTAURANT_OWNER


class IsDeliveryPartner(BasePermission):
    message = "Delivery Partner role is required for this action."

    def has_permission(self, request, view):
        return _is_valid_user(request) and request.user.role == Role.DELIVERY_PARTNER


class IsSuperAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return _is_valid_user(request) and request.user.role == Role.SUPER_ADMIN


class HasAllowedRole(BasePermission):
    """Checks view.allowed_roles against authenticated user's single primary role."""

    message = "You do not have permission to perform this action with your role."

    def has_permission(self, request, view):
        if not _is_valid_user(request):
            return False
        allowed = getattr(view, "allowed_roles", None)
        if not allowed:
            return True
        return request.user.role in allowed
