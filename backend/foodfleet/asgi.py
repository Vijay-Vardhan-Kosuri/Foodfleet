import os
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from django.urls import path

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "foodfleet.settings")
django_asgi_app = get_asgi_application()


@database_sync_to_async
def get_user_from_token(token_str):
    from django.contrib.auth.models import AnonymousUser
    from rest_framework_simplejwt.tokens import AccessToken
    from accounts.models import User

    if not token_str:
        return AnonymousUser()
    try:
        token = AccessToken(token_str)
        user_id = token.get("user_id")
        return User.objects.get(id=user_id, is_active=True, is_suspended=False)
    except Exception:
        return AnonymousUser()


class JwtAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode("utf-8")
        params = parse_qs(query_string)
        token_list = params.get("token", [])
        token = token_list[0] if token_list else None
        scope["user"] = await get_user_from_token(token)
        return await super().__call__(scope, receive, send)


from orders.consumers import OrderTrackingConsumer, UserNotificationConsumer

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JwtAuthMiddleware(
            URLRouter(
                [
                    path("ws/orders/<int:order_id>/", OrderTrackingConsumer.as_asgi()),
                    path("ws/notifications/", UserNotificationConsumer.as_asgi()),
                ]
            )
        ),
    }
)
