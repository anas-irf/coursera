"""Routes of the billing slice, mounted at ``/api/v1/billing/``."""

from django.urls import path

from .api import admin, views

app_name = 'billing'

urlpatterns = [
    # the administrator's plan settings
    path('admin/plans/', admin.admin_plans, name='admin-plans'),
    path('admin/plans/<str:cycle>/', admin.admin_plan, name='admin-plan'),

    # checkout
    path('checkout/', views.checkout_page_data, name='checkout-data'),
    path('checkout/session/', views.create_stripe_checkout_session, name='stripe-checkout-session'),
    path('checkout/verify/', views.verify_stripe_session, name='verify-stripe-session'),

    # the student's own subscription
    path('subscription/', views.student_subscription_status, name='student-subscription-status'),
    path('subscription/cancel/', views.cancel_plus_subscription, name='cancel-plus-subscription'),
]
