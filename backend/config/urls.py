"""
Root URL configuration.

Every slice mounts its own urlconf under /api/<prefix>/.  Some prefixes are
historical (e.g. notifications and the gradebook are still served from
/api/courses/); they are kept so the frontend contract does not change.
"""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/courses/', include('apps.courses.urls')),
    path('api/enrollments/', include('apps.learning.urls')),
    path('api/assessments/', include('apps.assessments.urls')),
    path('api/certificates/', include('apps.certificates.urls')),
    path('api/payments/', include('apps.billing.urls')),
    path('api/discussions/', include('apps.messaging.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/analytics/', include('apps.insights.urls')),
    path('api/content/', include('apps.content.urls')),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
