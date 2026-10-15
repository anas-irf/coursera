"""Routes of the insights slice, mounted at ``/api/v1/insights/``."""

from django.urls import path

from .api import directory, instructor, student

app_name = 'insights'

urlpatterns = [
    # student
    path('student/stats/', student.student_stats, name='student_stats'),
    path('student/weekly-progress/', student.student_weekly_progress, name='student_weekly_progress'),
    path('student/achievements/', student.student_achievements, name='student-achievements'),

    # instructor
    path('instructor/dashboard/', instructor.instructor_dashboard, name='instructor-dashboard'),
    path('instructor/earnings/', instructor.instructor_earnings, name='instructor-earnings'),
    path('instructor/courses/<uuid:course_uuid>/analytics/', instructor.course_analytics,
         name='instructor-courses-analytics'),

    # administrator
    path('admin/users/', directory.admin_all_users, name='admin-all-users'),
]
