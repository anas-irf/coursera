# billing/urls.py
from django.urls import path

from .api import views

app_name = 'payments'

urlpatterns = [
    # Subscription checkout endpoints
    path('checkout/plans/', views.get_subscription_plans, name='subscription-plans'),
    path('checkout/data/', views.checkout_page_data, name='checkout-data'),
    path('checkout/stripe-session/', views.create_stripe_checkout_session, name='stripe-checkout-session'),
    # NOTE: this path is configured in the Stripe dashboard - do not rename it
    path('stripe/webhook/', views.stripe_webhook, name='stripe-webhook'),
    path('verify-session/', views.verify_stripe_session, name='verify-stripe-session'),
]
