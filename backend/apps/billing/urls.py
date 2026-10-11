# payments/urls.py
from django.urls import path
from . import views

app_name = 'payments'

urlpatterns = [
    path('instructor/earnings/', views.instructor_earnings, name='instructor-earnings'),

    # Subscription checkout endpoints
    path('checkout/plans/', views.get_subscription_plans, name='subscription-plans'),
    path('checkout/data/', views.checkout_page_data, name='checkout-data'),
    path('checkout/stripe-session/', views.create_stripe_checkout_session, name='stripe-checkout-session'),
    path('stripe/webhook/', views.stripe_webhook, name='stripe-webhook'),
    path('verify-session/', views.verify_stripe_session, name='verify-stripe-session'),
]
