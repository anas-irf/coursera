# courses/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.decorators import api_view, permission_classes
from apps.accounts.permissions import IsInstructor
from .api import curriculum, instructor, moderation

router = DefaultRouter()
router.register('instructor/courses', instructor.InstructorCourseViewSet, basename='instructor-courses')

# Create wrapper functions for reordering endpoints
@api_view(['POST'])
@permission_classes([IsInstructor])
def reorder_sections_wrapper(request, course_uuid):
    viewset = curriculum.SectionViewSet()
    viewset.request = request
    viewset.kwargs = {'course_uuid': course_uuid}
    return viewset.reorder_sections(request, course_uuid)

@api_view(['POST'])
@permission_classes([IsInstructor])
def reorder_lectures_wrapper(request, section_uuid):
    viewset = curriculum.LectureViewSet()
    viewset.request = request
    viewset.kwargs = {'section_uuid': section_uuid}
    return viewset.reorder_lectures(request, section_uuid)

app_name = 'courses'

urlpatterns = [
    # Put specific paths first to avoid router conflicts

    # Section management
    path('instructor/courses/<uuid:course_uuid>/sections/',
         curriculum.SectionViewSet.as_view({'get': 'list', 'post': 'create'}),
         name='course-sections'),
    path('instructor/courses/<uuid:course_uuid>/sections/reorder/',
         reorder_sections_wrapper,
         name='reorder-sections'),
    path('instructor/sections/<uuid:uuid>/',
         curriculum.SectionViewSet.as_view({'put': 'update', 'delete': 'destroy'}),
         name='section-detail'),

    # Lecture management
    path('instructor/sections/<uuid:section_uuid>/lectures/',
         curriculum.LectureViewSet.as_view({'post': 'create'}),
         name='section-lectures'),
    path('instructor/sections/<uuid:section_uuid>/lectures/reorder/',
         reorder_lectures_wrapper,
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