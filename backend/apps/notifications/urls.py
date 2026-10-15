"""Routes of the notifications slice, mounted at ``/api/v1/notifications/``."""

from django.urls import path

from .api import views

app_name = 'notifications'

urlpatterns = [
    path('', views.get_user_notifications, name='user-notifications'),
    path('count/', views.get_unread_notification_count, name='notification-count'),
    path('read-all/', views.mark_all_notifications_read, name='mark-all-notifications-read'),
    path('<int:notification_id>/read/', views.mark_notification_read, name='mark-notification-read'),
]
