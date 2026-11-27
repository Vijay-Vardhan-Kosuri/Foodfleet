from django.conf import settings
from django.db import models


class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    title = models.CharField(max_length=150)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, default="ORDER_UPDATE")
    related_order_id = models.PositiveIntegerField(blank=True, null=True)
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ff_notifications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
        ]


def dispatch_notification(recipient, title, message, notification_type="ORDER_UPDATE", related_order_id=None):
    """Create persistent notification and push over Django Channels if connected."""
    notif = Notification.objects.create(
        recipient=recipient,
        title=title,
        message=message,
        notification_type=notification_type,
        related_order_id=related_order_id,
    )
    if getattr(settings, "TESTING", False):
        return notif
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(
                f"user_{recipient.id}",
                {
                    "type": "notification_message",
                    "payload": {
                        "id": notif.id,
                        "title": notif.title,
                        "message": notif.message,
                        "notification_type": notif.notification_type,
                        "related_order_id": notif.related_order_id,
                        "created_at": notif.created_at.isoformat(),
                    },
                },
            )
    except Exception:
        pass
    return notif
