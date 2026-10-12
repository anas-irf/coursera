# learning/api/views.py
import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import IsInstructor, IsStudent
from apps.billing.selectors import has_plus_access
from apps.courses.models import Course, Lecture

from .. import selectors, services
from . import serializers

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
def all_courses(request):
    """Get all available courses for students to explore"""
    params = request.GET
    courses = selectors.catalog(
        request.user,
        category=params.get('category', 'all'),
        level=params.get('level', 'all'),
        course_type=params.get('type', 'all'),
        search=params.get('search', ''),
        sort=params.get('sort', 'popular'),
    )

    is_student = request.user.is_authenticated and request.user.user_type == 'student'
    has_plus = is_student and has_plus_access(request.user)

    return Response([
        serializers.catalog_card(course, student_view=is_student, has_plus=has_plus)
        for course in courses
    ])


@api_view(['GET'])
@permission_classes([IsStudent])
def student_enrolled_courses(request):
    """Get student's enrolled courses with progress"""
    return Response([
        serializers.enrolled_course_row(enrollment)
        for enrollment in selectors.enrolled_courses(request.user)
    ])


@api_view(['POST'])
@permission_classes([IsStudent])
def enroll_course(request, course_uuid):
    """Enroll student in a course"""
    course = get_object_or_404(Course, uuid=course_uuid)

    enrollment = services.enroll(request.user, course)

    return Response({
        'message': 'Successfully enrolled in course',
        'enrollment_id': str(enrollment.uuid)
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsStudent])
def bookmark_course(request, course_uuid):
    """Add/remove course bookmark"""
    course = get_object_or_404(Course, uuid=course_uuid)

    if services.toggle_bookmark(request.user, course):
        return Response({'message': 'Course bookmarked'})
    return Response({'message': 'Bookmark removed'})


@api_view(['GET'])
@permission_classes([IsStudent])
def course_learn_view(request, course_uuid):
    """Get course learning interface with sections, lectures, and progress"""
    course = get_object_or_404(Course, uuid=course_uuid, status='published')
    student = request.user

    enrollment = services.active_enrollment(student, course)
    if enrollment is None:
        return Response(
            {'error': 'You must be enrolled in this course to access learning materials'},
            status=status.HTTP_403_FORBIDDEN
        )

    outline = selectors.player_outline(course)
    # rows of lectures added after the enrollment are created on first view
    progress_by_lecture = {
        lecture.pk: services.progress_for(enrollment, lecture)
        for _, lectures in outline for lecture in lectures
    }

    return Response(serializers.player_payload(course, enrollment, student, outline, progress_by_lecture))


@api_view(['POST'])
@permission_classes([IsStudent])
def mark_lecture_complete(request, course_uuid, lecture_uuid):
    """Mark a lecture as completed for the student"""
    course = get_object_or_404(Course, uuid=course_uuid, status='published')
    lecture = get_object_or_404(Lecture, uuid=lecture_uuid, section__course=course)

    enrollment = services.active_enrollment(request.user, course)
    if enrollment is None:
        return Response(
            {'error': 'You must be enrolled in this course'},
            status=status.HTTP_403_FORBIDDEN
        )

    services.complete_lecture(enrollment, lecture)

    return Response({
        'success': True,
        'message': 'Lecture marked as completed',
        'progress_percentage': enrollment.progress_percentage
    })


@api_view(['GET'])
@permission_classes([IsStudent])
def plus_courses_preview(request):
    """Get preview of Plus courses for upgrade promotion"""
    if has_plus_access(request.user):
        return Response(
            {'message': 'You already have Plus access'},
            status=status.HTTP_200_OK
        )

    total_plus_courses, total_free_courses = selectors.published_counts()

    return Response({
        'preview_courses': [serializers.preview_card(course) for course in selectors.plus_preview_courses()],
        'benefits': {
            'total_plus_courses': total_plus_courses,
            'total_free_courses': total_free_courses,
            'unlimited_access': True,
            'certificates_included': True,
            'offline_download': True,
            'no_ads': True
        },
        'pricing': {
            'monthly': 49.99,
            'yearly': 399.99,
            'yearly_savings': round((49.99 * 12) - 399.99, 2),
            'yearly_savings_percentage': round(((49.99 * 12) - 399.99) / (49.99 * 12) * 100)
        },
        'checkout_url': '/api/payments/checkout/data/'
    })


# --------------------------------------------------------------------------- #
# the instructor's view on the learners of their courses
# --------------------------------------------------------------------------- #
@api_view(['GET'])
@permission_classes([IsInstructor])
def course_students(request, course_uuid):
    """Get list of enrolled students"""
    course = get_object_or_404(Course, uuid=course_uuid, instructor=request.user)

    return Response([
        serializers.roster_entry(enrollment) for enrollment in selectors.course_roster(course)
    ])


@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_students(request):
    """Get all students enrolled in instructor's courses"""
    try:
        enrollments = selectors.instructor_roster(request.user)
        return Response(serializers.student_directory(enrollments))
    except Exception:
        logger.exception('Failed to fetch students')
        return Response(
            {'error': 'Failed to fetch students'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
