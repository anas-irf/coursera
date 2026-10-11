from django.urls import path
from . import views

app_name = 'discussions'

urlpatterns = [
    # Direct messaging endpoints
    path('messages/conversations/', views.get_conversations, name='get_conversations'),
    path('messages/conversations/<str:conversation_id>/', views.get_conversation_messages, name='get_conversation_messages'),
    path('messages/conversations/<str:conversation_id>/mark-read/', views.mark_messages_read, name='mark_messages_read'),
    path('messages/send/', views.send_message, name='send_message'),
    path('messages/users/', views.get_available_users, name='get_available_users'),
]
