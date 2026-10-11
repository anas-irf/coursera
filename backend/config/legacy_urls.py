"""Endpoints that are served from a prefix that no longer matches their slice.

The frontend was written against these paths when the code lived in the
accounts, payments and courses apps.  Only the code moved; the paths are kept
until the URL clean-up renames them together with the frontend (then this
module is deleted).
"""
from django.urls import path

from apps.billing.api import views as billing
from apps.certificates.api import views as certificates
from apps.insights.api import directory, instructor, student

urlpatterns = [
    # billing (was accounts)
    path('api/auth/student/subscription-status/', billing.student_subscription_status,
         name='student_subscription_status'),
    path('api/auth/student/cancel-subscription/', billing.cancel_plus_subscription,
         name='cancel_plus_subscription'),

    # insights (was accounts / payments / courses)
    path('api/auth/student/stats/', student.student_stats, name='student_stats'),
    path('api/auth/student/weekly-progress/', student.student_weekly_progress,
         name='student_weekly_progress'),
    path('api/payments/instructor/earnings/', instructor.instructor_earnings,
         name='instructor-earnings'),
    path('api/courses/instructor/dashboard/', instructor.instructor_dashboard,
         name='instructor-dashboard'),
    path('api/courses/instructor/courses/<uuid:course_uuid>/analytics/', instructor.course_analytics,
         name='instructor-courses-analytics'),
    path('api/courses/student/achievements/', student.student_achievements,
         name='student-achievements'),
    path('api/courses/admin/users/', directory.admin_all_users, name='admin-all-users'),

    # certificates (was courses)
    path('api/courses/student/certificates/', certificates.student_certificates,
         name='student-certificates'),
]
