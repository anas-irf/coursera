# billing/webhook_urls.py - mounted at /api/payments/
#
# Stripe calls this path; it is configured in the Stripe dashboard, so it keeps
# the prefix it was registered under when everything else moved to /api/billing/.
from django.urls import path

from .api import views

urlpatterns = [
    path('stripe/webhook/', views.stripe_webhook, name='stripe-webhook'),
]
