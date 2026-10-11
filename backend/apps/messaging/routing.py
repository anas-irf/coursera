# discussions/routing.py
from django.urls import re_path, path
from . import consumers

websocket_urlpatterns = [
    path('ws/chat/<str:conversation_id>/', consumers.ChatConsumer.as_asgi()),
    path('ws/user/', consumers.UserConsumer.as_asgi()),  # New: user-specific connection
]
