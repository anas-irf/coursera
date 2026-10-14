"""
Root URL configuration.

The API is served at ``/api/v1/<slice>/``.  The unversioned ``/api/<slice>/``
paths of the first release stay as aliases while ``API_LEGACY_ALIASES`` is on:
they reach the very same views and answer with ``Deprecation`` and ``Link``
headers (``apps.core.middleware.LegacyApiMiddleware``), so the day they can be
switched off is a decision made from data.  The only path outside the scheme is
Stripe's webhook, which is configured in the Stripe dashboard and is neither
versioned nor aliased (see ``apps/billing/webhook_urls.py``).
"""
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

# (path prefix, urlconf) of every slice
SLICES = (
    ('auth/', 'apps.accounts.urls'),
    ('courses/', 'apps.courses.urls'),
    ('learning/', 'apps.learning.urls'),
    ('assessments/', 'apps.assessments.urls'),
    ('billing/', 'apps.billing.urls'),
    ('insights/', 'apps.insights.urls'),
    ('certificates/', 'apps.certificates.urls'),
    ('messaging/', 'apps.messaging.urls'),
    ('notifications/', 'apps.notifications.urls'),
)


def api_routes():
    """The routes of every slice, relative to the API prefix."""
    return [path(prefix, include(module)) for prefix, module in SLICES]


def build_urlpatterns(legacy):
    """The URL patterns, with or without the unversioned aliases."""
    patterns = [
        path('api/v1/', include((api_routes(), 'api'), namespace='v1')),
        path('api/payments/', include('apps.billing.webhook_urls')),
    ]
    if legacy:
        patterns.append(path('api/', include((api_routes(), 'api'), namespace='legacy')))
    return patterns


urlpatterns = build_urlpatterns(settings.API_LEGACY_ALIASES)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
