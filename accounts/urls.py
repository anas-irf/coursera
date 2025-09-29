# accounts/urls.py
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', views.get_user_profile, name='user_profile'),
    path('verify-email/<str:token>/', views.verify_email, name='verify_email'),

    # Student Plus subscription endpoints
    path('student/subscription-status/', views.student_subscription_status, name='student_subscription_status'),
    path('student/create-subscription/', views.create_plus_subscription, name='create_plus_subscription'),
    path('student/cancel-subscription/', views.cancel_plus_subscription, name='cancel_plus_subscription'),
    path('student/stats/', views.student_stats, name='student_stats'),
    path('student/weekly-progress/', views.student_weekly_progress, name='student_weekly_progress'),
    path('student/debug-subscription/', views.debug_subscription, name='debug_subscription'),
]