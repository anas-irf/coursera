"""Routes of the messaging slice, mounted at ``/api/v1/messaging/`` (the sockets are in
``routing.py``).
"""

from django.urls import path

from .api import views

app_name = 'messaging'

urlpatterns = [
    path('conversations/', views.get_conversations, name='get-conversations'),
    path('conversations/<str:conversation_id>/', views.get_conversation_messages,
         name='get-conversation-messages'),
    path('conversations/<str:conversation_id>/mark-read/', views.mark_messages_read,
         name='mark-messages-read'),
    path('send/', views.send_message, name='send-message'),
    path('users/', views.get_available_users, name='get-available-users'),
]
