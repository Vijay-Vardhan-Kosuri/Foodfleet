from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs"
    )
    actor_role = models.CharField(max_length=24, blank=True, default="")
    action = models.CharField(max_length=120, db_index=True)
    target_model = models.CharField(max_length=80, db_index=True)
    target_id = models.CharField(max_length=64, blank=True, default="")
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "ff_audit_logs"
        ordering = ["-created_at"]


class PlatformConfig(models.Model):
    platform_name = models.CharField(max_length=100, default="FoodFleet")
    tax_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, default=5.00)
    default_delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=35.00)
    default_commission_percent = models.DecimalField(max_digits=5, decimal_places=2, default=15.00)
    support_email = models.EmailField(default="support@foodfleet.dev")
    support_phone = models.CharField(max_length=30, default="+91-80-4000-2026")
    auto_assign_delivery = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ff_platform_config"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


def record_audit_log(request, action: str, target_model: str, target_id: str | int, details: dict | None = None):
    ip = None
    if request is not None:
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        ip = xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")
    actor = getattr(request, "user", None)
    if actor and not actor.is_authenticated:
        actor = None
    AuditLog.objects.create(
        actor=actor,
        actor_role=getattr(actor, "role", "") if actor else "",
        action=action,
        target_model=target_model,
        target_id=str(target_id),
        details=details or {},
        ip_address=ip,
    )
