import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from accounts.models import Role
from orders.models import Order


class OrderTrackingConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer streaming real-time status changes for authorized order participants."""

    async def connect(self):
        self.order_id = self.scope["url_route"]["kwargs"]["order_id"]
        self.group_name = f"order_{self.order_id}"
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        allowed = await self._user_can_track_order(user, self.order_id)
        if not allowed:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def order_status_event(self, event):
        await self.send(text_data=json.dumps({"type": "ORDER_STATUS", "data": event["payload"]}))

    @database_sync_to_async
    def _user_can_track_order(self, user, order_id):
        try:
            order = Order.objects.select_related("restaurant", "delivery_assignment__delivery_partner").get(
                pk=order_id
            )
        except Order.DoesNotExist:
            return False
        if user.role == Role.SUPER_ADMIN:
            return True
        if user.role == Role.CUSTOMER and order.customer_id == user.id:
            return True
        if user.role == Role.RESTAURANT_OWNER and order.restaurant.owner_id == user.id:
            return True
        if (
            user.role == Role.DELIVERY_PARTNER
            and hasattr(order, "delivery_assignment")
            and order.delivery_assignment.delivery_partner
            and order.delivery_assignment.delivery_partner.user_id == user.id
        ):
            return True
        return False


class UserNotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return
        self.group_name = f"user_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notification_message(self, event):
        await self.send(text_data=json.dumps({"type": "NOTIFICATION", "data": event["payload"]}))
