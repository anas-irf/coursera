"""Routes of the learning slice, mounted at ``/api/v1/learning/``."""

from django.urls import path

from .api import views

app_name = 'learning'

urlpatterns = [
    # discovery
    path('courses/', views.all_courses, name='all-courses'),

    # learning
    path('enrolled/', views.student_enrolled_courses, name='enrolled-courses'),
    path('courses/<uuid:course_uuid>/enroll/', views.enroll_course, name='enroll-course'),
    path('courses/<uuid:course_uuid>/learn/', views.course_learn_view, name='course-learn'),
    path('courses/<uuid:course_uuid>/lectures/<uuid:lecture_uuid>/complete/', views.mark_lecture_complete,
         name='mark-lecture-complete'),
    path('courses/<uuid:course_uuid>/lectures/<uuid:lecture_uuid>/progress/', views.record_watch_progress,
         name='record-watch-progress'),
    path('courses/<uuid:course_uuid>/bookmark/', views.bookmark_course, name='bookmark-course'),

    # the instructor's learners
    path('instructor/students/', views.instructor_students, name='instructor-courses-students-list'),
    path('instructor/courses/<uuid:course_uuid>/students/', views.course_students,
         name='instructor-courses-students'),
]
