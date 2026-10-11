"""
Root URL configuration.

Every slice mounts its own urlconf under /api/<slice>/.  The only path that
does not follow the scheme is Stripe's webhook, which is configured in the
Stripe dashboard (see apps/billing/webhook_urls.py).
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/auth/', include('apps.accounts.urls')),
    path('api/courses/', include('apps.courses.urls')),
    path('api/learning/', include('apps.learning.urls')),
    path('api/assessments/', include('apps.assessments.urls')),
    path('api/billing/', include('apps.billing.urls')),
    path('api/payments/', include('apps.billing.webhook_urls')),
    path('api/insights/', include('apps.insights.urls')),
    path('api/certificates/', include('apps.certificates.urls')),
    path('api/messaging/', include('apps.messaging.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
