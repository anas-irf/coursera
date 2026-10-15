"""HTTP adapters of learning: the catalogue, enrolling, the player and progress."""

import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import IsInstructor, IsStudent
from apps.billing.selectors import has_plus_access
from apps.core.api.errors import PermissionDenied, ServiceError
from apps.core.api.pagination import paginate
from apps.core.api.params import object_body
from apps.core.api.throttling import ProgressThrottle
from apps.courses.models import Course, Lecture

from .. import selectors, services
from . import serializers

logger = logging.getLogger(__name__)

CATALOG_PAGE_SIZE = 20  # what the catalogue answers when the caller does not ask for a page


@api_view(['GET'])
@permission_classes([AllowAny])
def all_courses(request):
    """Get all available courses for students to explore"""
    params = request.GET
    courses, headers = paginate(
        request,
        selectors.catalog(
            request.user,
            category=params.get('category', 'all'),
            level=params.get('level', 'all'),
            course_type=params.get('type', 'all'),
            search=params.get('search', ''),
            sort=params.get('sort', 'popular'),
        ),
        default_size=CATALOG_PAGE_SIZE,
    )

    is_student = request.user.is_authenticated and request.user.user_type == 'student'
    has_plus = is_student and has_plus_access(request.user)

    return Response([
        serializers.catalog_card(course, student_view=is_student, has_plus=has_plus)
        for course in courses
    ], headers=headers)


@api_view(['GET'])
@permission_classes([IsStudent])
def student_enrolled_courses(request):
    """The student's courses with progress; ``?status=active`` (default), ``completed`` or ``all``."""
    view = request.query_params.get('status', 'active')
    if view not in selectors.ENROLLED_VIEWS:
        raise ServiceError(f"status must be one of {', '.join(selectors.ENROLLED_VIEWS)}")
    enrollments, headers = paginate(request, selectors.enrolled_courses(request.user, view=view))
    return Response([serializers.enrolled_course_row(enrollment) for enrollment in enrollments],
                    headers=headers)


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

    enrollment = selectors.enrollment_for_access(student, course)
    if enrollment is None:
        raise PermissionDenied('You must be enrolled in this course to access learning materials')

    outline = selectors.player_outline(course)
    progress = selectors.progress_by_lecture(
        enrollment, [lecture for _, lectures in outline for lecture in lectures])

    return Response(serializers.player_payload(course, enrollment, student, outline, progress))


@api_view(['POST'])
@permission_classes([IsStudent])
def mark_lecture_complete(request, course_uuid, lecture_uuid):
    """Mark a lecture as completed for the student"""
    course = get_object_or_404(Course, uuid=course_uuid, status='published')
    lecture = get_object_or_404(Lecture, uuid=lecture_uuid, section__course=course)

    enrollment = selectors.enrollment_for_access(request.user, course)
    if enrollment is None:
        raise PermissionDenied('You must be enrolled in this course')

    services.complete_lecture(enrollment, lecture)

    return Response({
        'success': True,
        'message': 'Lecture marked as completed',
        'progress_percentage': enrollment.progress_percentage
    })


@api_view(['POST'])
@permission_classes([IsStudent])
@throttle_classes([ProgressThrottle])
def record_watch_progress(request, course_uuid, lecture_uuid):
    """Heartbeat of the video player: ``{position, finished?}`` in seconds.

    Remembers where to resume and counts the time spent watching.
    """
    course = get_object_or_404(Course, uuid=course_uuid, status='published')
    lecture = get_object_or_404(Lecture, uuid=lecture_uuid, section__course=course)

    enrollment = selectors.enrollment_for_access(request.user, course)
    if enrollment is None:
        raise PermissionDenied('You must be enrolled in this course')

    body = object_body(request)
    progress = services.record_watch(
        enrollment, lecture, body.get('position'), finished=body.get('finished') is True)

    return Response({
        'last_watched_position': progress.last_watched_position,
        'progress_seconds': progress.progress_seconds,
        'watch_count': progress.watch_count,
        'total_time_spent': enrollment.total_time_spent,
    })


# --------------------------------------------------------------------------- #
# the instructor's view on the learners of their courses
# --------------------------------------------------------------------------- #
@api_view(['GET'])
@permission_classes([IsInstructor])
def course_students(request, course_uuid):
    """Get list of enrolled students"""
    course = get_object_or_404(Course, uuid=course_uuid, instructor=request.user)

    enrollments, headers = paginate(request, selectors.course_roster(course))
    return Response([serializers.roster_entry(enrollment) for enrollment in enrollments],
                    headers=headers)


@api_view(['GET'])
@permission_classes([IsInstructor])
def instructor_students(request):
    """Get all students enrolled in instructor's courses"""
    enrollments, headers = paginate(request, selectors.instructor_roster(request.user))
    return Response(serializers.student_directory(enrollments), headers=headers)
