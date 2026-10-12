# notifications/urls.py
from django.urls import path

from .api import views

app_name = 'notifications'

urlpatterns = [
    path('', views.get_user_notifications, name='user-notifications'),
    path('count/', views.get_unread_notification_count, name='notification-count'),
    path('<int:notification_id>/read/', views.mark_notification_read, name='mark-notification-read'),
]
