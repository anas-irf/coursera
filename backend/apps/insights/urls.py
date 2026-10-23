"""Routes of the insights slice, mounted at ``/api/v1/insights/``."""

from django.urls import path

from .api import admin, directory, instructor, student

app_name = 'insights'

urlpatterns = [
    # student
    path('student/stats/', student.student_stats, name='student-stats'),
    path('student/weekly-progress/', student.student_weekly_progress, name='student-weekly-progress'),
    path('student/achievements/', student.student_achievements, name='student-achievements'),

    # instructor
    path('instructor/dashboard/', instructor.instructor_dashboard, name='instructor-dashboard'),
    path('instructor/analytics/', instructor.instructor_analytics, name='instructor-analytics'),
    path('instructor/earnings/', instructor.instructor_earnings, name='instructor-earnings'),
    path('instructor/courses/<uuid:course_uuid>/analytics/', instructor.course_analytics,
         name='instructor-courses-analytics'),

    # administrator
    path('admin/users/', directory.admin_all_users, name='admin-all-users'),
    path('admin/revenue/', admin.admin_revenue, name='admin-revenue'),
    path('admin/reports/', admin.admin_reports, name='admin-reports'),
    path('admin/reports/<slug:report>/', admin.admin_report, name='admin-report'),
    path('admin/platform/', admin.admin_platform, name='admin-platform'),
]
