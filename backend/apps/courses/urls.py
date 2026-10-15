"""Routes of the courses slice, mounted at ``/api/v1/courses/``."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api import curriculum, instructor, moderation

router = DefaultRouter()
router.register('instructor/courses', instructor.InstructorCourseViewSet, basename='instructor-courses')

app_name = 'courses'

urlpatterns = [
    # Put specific paths first to avoid router conflicts

    # What the create form offers
    path('categories/', instructor.categories, name='categories'),
    path('languages/', instructor.languages, name='languages'),

    # Section management
    path('instructor/courses/<uuid:course_uuid>/sections/',
         curriculum.SectionViewSet.as_view({'get': 'list', 'post': 'create'}),
         name='course-sections'),
    path('instructor/courses/<uuid:course_uuid>/sections/reorder/',
         curriculum.reorder_sections,
         name='reorder-sections'),
    path('instructor/sections/<uuid:uuid>/',
         curriculum.SectionViewSet.as_view({'put': 'update', 'delete': 'destroy'}),
         name='section-detail'),

    # Lecture management
    path('instructor/sections/<uuid:section_uuid>/lectures/',
         curriculum.LectureViewSet.as_view({'post': 'create'}),
         name='section-lectures'),
    path('instructor/sections/<uuid:section_uuid>/lectures/reorder/',
         curriculum.reorder_lectures,
         name='reorder-lectures'),
    path('instructor/lectures/<uuid:uuid>/',
         curriculum.LectureViewSet.as_view({'put': 'update', 'delete': 'destroy'}),
         name='lecture-detail'),

    # Admin endpoints for course publishing
    path('admin/pending/', moderation.admin_pending_courses, name='admin-pending-courses'),
    path('admin/all/', moderation.admin_all_courses, name='admin-all-courses'),
    path('admin/<uuid:course_id>/approve/', moderation.admin_approve_course, name='admin-approve-course'),
    path('admin/<uuid:course_id>/reject/', moderation.admin_reject_course, name='admin-reject-course'),

    # Router paths (must come after all specific paths to avoid conflicts)
    path('', include(router.urls)),
]
