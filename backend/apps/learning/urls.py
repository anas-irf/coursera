# learning/urls.py - mounted at /api/courses/ next to the courses urlconf (legacy prefix)
from django.urls import path

from .api import views

app_name = 'enrollments'

urlpatterns = [
    # the instructor's learners; these must be matched before the courses router
    path('instructor/courses/students/', views.instructor_students, name='instructor-courses-students-list'),
    path('instructor/courses/<uuid:course_uuid>/students/', views.course_students,
         name='instructor-courses-students'),

    # discovery
    path('all/', views.all_courses, name='all-courses'),
    path('plus-preview/', views.plus_courses_preview, name='plus-courses-preview'),

    # learning
    path('enrolled/', views.student_enrolled_courses, name='enrolled-courses'),
    path('<uuid:course_uuid>/enroll/', views.enroll_course, name='enroll-course'),
    path('<uuid:course_uuid>/learn/', views.course_learn_view, name='course-learn'),
    path('<uuid:course_uuid>/lectures/<uuid:lecture_uuid>/complete/', views.mark_lecture_complete,
         name='mark-lecture-complete'),
    path('<uuid:course_uuid>/bookmark/', views.bookmark_course, name='bookmark-course'),
]
