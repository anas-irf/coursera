# courses/api/curriculum.py - sections and lectures of an instructor's course
import logging

from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.permissions import IsInstructor

from .. import extensions
from ..models import Course, Lecture, Section
from ..services import curriculum
from .serializers import LectureSerializer, SectionSerializer

logger = logging.getLogger(__name__)


def _published_response(message, status_key, course):
    return Response(
        {'error': message, status_key: course.status},
        status=status.HTTP_400_BAD_REQUEST
    )


class SectionViewSet(viewsets.ModelViewSet):
    serializer_class = SectionSerializer
    permission_classes = [IsInstructor]
    lookup_field = 'uuid'

    def get_queryset(self):
        course_uuid = self.kwargs.get('course_uuid')
        if course_uuid:
            return Section.objects.filter(
                course__uuid=course_uuid,
                course__instructor=self.request.user
            )
        else:
            return Section.objects.filter(
                course__instructor=self.request.user
            )

    def perform_create(self, serializer):
        course_uuid = self.kwargs.get('course_uuid')
        course = get_object_or_404(Course, uuid=course_uuid, instructor=self.request.user)

        if course.status == 'published':
            raise ValidationError('Cannot add sections to published courses. Please unpublish the course first.')

        serializer.save(
            course=course,
            order=curriculum.next_order(Section.objects.filter(course=course)),
        )

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder_sections(self, request, course_uuid=None):
        """Reorder sections within a course"""
        try:
            # Get course_uuid from kwargs or parameter
            course_uuid = course_uuid or self.kwargs.get('course_uuid')
            course = get_object_or_404(Course, uuid=course_uuid, instructor=request.user)

            curriculum.reorder(
                Section.objects.filter(course=course),
                request.data.get('section_orders', []),
            )

            return Response({'message': 'Sections reordered successfully'})

        except Exception:
            # the cause belongs in the log, not in the response
            logger.warning('Failed to reorder sections', exc_info=True)
            return Response(
                {'error': 'Failed to reorder sections'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def update(self, request, *args, **kwargs):
        """Override update to prevent editing sections of published courses"""
        section = self.get_object()
        if section.course.status == 'published':
            return _published_response(
                'Cannot edit sections of published courses. Please unpublish the course first.',
                'course_status', section.course)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """Override partial_update to prevent editing sections of published courses"""
        section = self.get_object()
        if section.course.status == 'published':
            return _published_response(
                'Cannot edit sections of published courses. Please unpublish the course first.',
                'course_status', section.course)
        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        """Delete a section and renumber the remaining ones 1..n"""
        if instance.course.status == 'published':
            raise ValidationError('Cannot delete sections of published courses. Please unpublish the course first.')

        course = instance.course
        super().perform_destroy(instance)
        curriculum.resequence(Section.objects.filter(course=course))


class LectureViewSet(viewsets.ModelViewSet):
    serializer_class = LectureSerializer
    permission_classes = [IsInstructor]
    lookup_field = 'uuid'

    def get_queryset(self):
        section_uuid = self.kwargs.get('section_uuid')
        if section_uuid:
            return Lecture.objects.filter(
                section__uuid=section_uuid,
                section__course__instructor=self.request.user
            )
        else:
            return Lecture.objects.filter(
                section__course__instructor=self.request.user
            )

    def perform_create(self, serializer):
        section_uuid = self.kwargs.get('section_uuid')
        section = get_object_or_404(
            Section,
            uuid=section_uuid,
            course__instructor=self.request.user
        )

        if section.course.status == 'published':
            raise ValidationError('Cannot add lectures to published courses. Please unpublish the course first.')

        lecture = serializer.save(
            section=section,
            order=curriculum.next_order(Lecture.objects.filter(section=section)),
        )

        # the content slice that owns this lecture type creates its rows
        handler = extensions.get_content_handler(lecture.content_type)
        if handler is not None:
            handler.create(lecture, self.request.data, self.request.FILES)

    def perform_update(self, serializer):
        lecture = serializer.save()

        handler = extensions.get_content_handler(lecture.content_type)
        if handler is not None:
            handler.update(lecture, self.request.data, self.request.FILES)

    def perform_destroy(self, instance):
        """Delete a lecture and renumber the remaining ones 1..n"""
        if instance.section.course.status == 'published':
            raise ValidationError('Cannot delete lectures of published courses. Please unpublish the course first.')

        section = instance.section
        super().perform_destroy(instance)
        curriculum.resequence(Lecture.objects.filter(section=section))

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder_lectures(self, request, section_uuid=None):
        """Reorder lectures within a section"""
        try:
            # Get section_uuid from kwargs or parameter
            section_uuid = section_uuid or self.kwargs.get('section_uuid')
            section = get_object_or_404(
                Section,
                uuid=section_uuid,
                course__instructor=request.user
            )

            curriculum.reorder(
                Lecture.objects.filter(section=section),
                request.data.get('lecture_orders', []),
            )

            return Response({'message': 'Lectures reordered successfully'})

        except Exception:
            logger.warning('Failed to reorder lectures', exc_info=True)
            return Response(
                {'error': 'Failed to reorder lectures'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def update(self, request, *args, **kwargs):
        """Override update to prevent editing lectures of published courses"""
        lecture = self.get_object()
        if lecture.section.course.status == 'published':
            return _published_response(
                'Cannot edit lectures of published courses. Please unpublish the course first.',
                'course_status', lecture.section.course)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        """Override partial_update to prevent editing lectures of published courses"""
        lecture = self.get_object()
        if lecture.section.course.status == 'published':
            return _published_response(
                'Cannot edit lectures of published courses. Please unpublish the course first.',
                'course_status', lecture.section.course)
        return super().partial_update(request, *args, **kwargs)
