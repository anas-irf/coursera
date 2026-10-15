"""Routes of the accounts slice, mounted at ``/api/v1/auth/``."""

from django.urls import path

from .api import views

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('token/refresh/', views.refresh, name='token_refresh'),
    path('profile/', views.get_user_profile, name='user_profile'),
]