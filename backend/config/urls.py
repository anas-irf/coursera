"""
Root URL configuration.

Every slice mounts its urlconf under /api/<prefix>/.  Some prefixes are
historical: the learning and assessments endpoints and the notifications are
still served below /api/courses/, and a few endpoints sit under the prefix of
the app they were first written in (see ``legacy_urls``).  They are kept so the
frontend contract does not change until the URL clean-up.
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),

    # endpoints whose prefix does not match the slice that serves them
    path('', include('config.legacy_urls')),

    path('api/auth/', include('apps.accounts.urls')),
    path('api/courses/notifications/', include('apps.notifications.urls')),
    # learning and assessments are mounted before courses so that their fixed
    # paths win over the courses router
    path('api/courses/', include('apps.learning.urls')),
    path('api/courses/', include('apps.assessments.course_urls')),
    path('api/courses/', include('apps.courses.urls')),
    path('api/assessments/', include('apps.assessments.urls')),
    path('api/payments/', include('apps.billing.urls')),
    path('api/discussions/', include('apps.messaging.urls')),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
