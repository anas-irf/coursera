# courses/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.decorators import api_view, permission_classes
from apps.accounts.permissions import IsInstructor
from .api import curriculum, instructor, moderation
from . import views
from . import student_views

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
    path('instructor/dashboard/', views.instructor_dashboard, name='instructor-dashboard'),

    # Section management
    path('instructor/courses/<uuid:course_uuid>/sections/',
         curriculum.SectionViewSet.as_view({'get': 'list', 'post': 'create'}),
         name='course-sections'),
    path('instructor/courses/<uuid:course_uuid>/sections/reorder/',
         reorder_sections_wrapper,
         name='reorder-sections'),
    path('instructor/sections/<uuid:uuid>/',
         curriculum.SectionViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}),
         name='section-detail'),

    # Lecture management
    path('instructor/sections/<uuid:section_uuid>/lectures/',
         curriculum.LectureViewSet.as_view({'get': 'list', 'post': 'create'}),
         name='section-lectures'),
    path('instructor/sections/<uuid:section_uuid>/lectures/reorder/',
         reorder_lectures_wrapper,
         name='reorder-lectures'),
    path('instructor/lectures/<uuid:uuid>/',
         curriculum.LectureViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}),
         name='lecture-detail'),
    
    #student URLs
    path('all/', student_views.all_courses, name='all-courses'),
    path('enrolled/', student_views.student_enrolled_courses, name='enrolled-courses'),
    path('<uuid:course_uuid>/enroll/', student_views.enroll_course, name='enroll-course'),
    path('<uuid:course_uuid>/learn/', student_views.course_learn_view, name='course-learn'),
    path('<uuid:course_uuid>/lectures/<uuid:lecture_uuid>/complete/', student_views.mark_lecture_complete, name='mark-lecture-complete'),
    path('assignments/<uuid:assignment_uuid>/submit/', student_views.submit_assignment, name='submit-assignment'),
    path('assignments/submissions/<uuid:submission_uuid>/download/', student_views.download_submission_file, name='download-submission-file'),
    path('<uuid:course_uuid>/bookmark/', student_views.bookmark_course, name='bookmark-course'),

    # Student certificates and achievements
    path('student/certificates/', student_views.student_certificates, name='student-certificates'),
    path('student/achievements/', student_views.student_achievements, name='student-achievements'),

    # Admin endpoints for course publishing
    path('admin/pending/', moderation.admin_pending_courses, name='admin-pending-courses'),
    path('admin/all/', moderation.admin_all_courses, name='admin-all-courses'),
    path('admin/users/', views.admin_all_users, name='admin-all-users'),
    path('admin/<uuid:course_id>/approve/', moderation.admin_approve_course, name='admin-approve-course'),
    path('admin/<uuid:course_id>/reject/', moderation.admin_reject_course, name='admin-reject-course'),

    # Quiz attempt endpoints
    path('quizzes/<uuid:quiz_uuid>/attempt/', student_views.attempt_quiz, name='attempt-quiz'),

    # Plus courses preview for upgrade promotion
    path('plus-preview/', student_views.plus_courses_preview, name='plus-courses-preview'),

    # Instructor assignment management
    path('instructor/assignments/', views.instructor_assignments, name='instructor-assignments'),
    path('instructor/assignments/<uuid:assignment_uuid>/submissions/', views.instructor_assignment_submissions, name='instructor-assignment-submissions'),
    path('instructor/assignments/submissions/<uuid:submission_uuid>/grade/', views.grade_assignment_submission, name='grade-assignment-submission'),

    # Gradebook management
    path('instructor/courses/<uuid:course_uuid>/gradebook/', views.instructor_course_gradebook, name='instructor-course-gradebook'),
    path('student/gradebook/', views.student_gradebook, name='student-gradebook'),

    # Router paths (must come after all specific paths to avoid conflicts)
    path('', include(router.urls)),
]