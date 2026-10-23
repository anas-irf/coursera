"""Routes of the accounts slice, mounted at ``/api/v1/auth/``."""

from django.urls import path

from .api import views

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('token/refresh/', views.refresh, name='token-refresh'),
    path('profile/', views.get_user_profile, name='user-profile'),
    path('password/', views.change_password, name='change-password'),

    # the one-click sign-in of a portfolio demo (DEMO_MODE)
    path('demo/', views.demo_accounts, name='demo-accounts'),
    path('demo/login/', views.demo_login, name='demo-login'),
]