"""Routes of the billing slice, mounted at ``/api/v1/billing/``."""

from django.urls import path

from .api import views

app_name = 'billing'

urlpatterns = [
    # checkout
    path('checkout/', views.checkout_page_data, name='checkout-data'),
    path('checkout/session/', views.create_stripe_checkout_session, name='stripe-checkout-session'),
    path('checkout/verify/', views.verify_stripe_session, name='verify-stripe-session'),

    # the student's own subscription
    path('subscription/', views.student_subscription_status, name='student_subscription_status'),
    path('subscription/cancel/', views.cancel_plus_subscription, name='cancel_plus_subscription'),
]
