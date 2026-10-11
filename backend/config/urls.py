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

from apps.billing.api import views as billing_views
from apps.insights.api import views as insights_views

urlpatterns = [
    path('admin/', admin.site.urls),

    # Endpoints that historically lived under /api/auth/, /api/payments/ and
    # /api/courses/ although they belong to billing and insights.  Paths are
    # frozen until the URL clean-up; only the code moved.
    path('api/auth/student/subscription-status/', billing_views.student_subscription_status,
         name='student_subscription_status'),
    path('api/auth/student/cancel-subscription/', billing_views.cancel_plus_subscription,
         name='cancel_plus_subscription'),
    path('api/auth/student/stats/', insights_views.student_stats, name='student_stats'),
    path('api/auth/student/weekly-progress/', insights_views.student_weekly_progress,
         name='student_weekly_progress'),
    path('api/payments/instructor/earnings/', insights_views.instructor_earnings,
         name='instructor-earnings'),
    path('api/courses/instructor/courses/<uuid:course_uuid>/analytics/', insights_views.course_analytics,
         name='instructor-courses-analytics'),

    path('api/auth/', include('apps.accounts.urls')),
    # notifications are still served below /api/courses/ (frontend contract)
    path('api/courses/notifications/', include('apps.notifications.urls')),
    # learning is mounted first so its fixed paths win over the courses router
    path('api/courses/', include('apps.learning.urls')),
    path('api/courses/', include('apps.assessments.course_urls')),
    path('api/courses/', include('apps.courses.urls')),
    path('api/assessments/', include('apps.assessments.urls')),
    path('api/certificates/', include('apps.certificates.urls')),
    path('api/payments/', include('apps.billing.urls')),
    path('api/discussions/', include('apps.messaging.urls')),
    path('api/analytics/', include('apps.insights.urls')),
    path('api/content/', include('apps.content.urls')),
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
