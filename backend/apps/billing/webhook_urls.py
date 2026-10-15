"""The Stripe webhook, mounted at ``/api/payments/``: the path is configured in the Stripe dashboard, so it
keeps the prefix it was registered under and is neither versioned nor aliased.
"""

from django.urls import path

from .api import views

urlpatterns = [
    path('stripe/webhook/', views.stripe_webhook, name='stripe-webhook'),
]
