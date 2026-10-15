# courses/api/curriculum.py - sections and lectures of an instructor's course
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsInstructor
from apps.core.api.params import object_body
from apps.core.api.throttling import UploadThrottle

from .. import selectors
from ..services import curriculum
from .serializers import LectureSerializer, SectionSerializer


class SectionViewSet(viewsets.ModelViewSet):
    serializer_class = SectionSerializer
    permission_classes = [IsInstructor]
    lookup_field = 'uuid'

    def get_queryset(self):
        return selectors.instructor_sections(self.request.user, self.kwargs.get('course_uuid'))

    def perform_create(self, serializer):
        course = get_object_or_404(
            selectors.instructor_courses(self.request.user), uuid=self.kwargs.get('course_uuid'))
        serializer.instance = curriculum.add_section(course, serializer.validated_data)

    def update(self, request, *args, **kwargs):
        # a published course is refused before the payload is even looked at
        curriculum.ensure_editable(self.get_object().course, 'edit sections of')
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        curriculum.edit_section(serializer.instance, serializer.validated_data)

    def perform_destroy(self, instance):
        curriculum.delete_section(instance)


class LectureViewSet(viewsets.ModelViewSet):
    serializer_class = LectureSerializer
    permission_classes = [IsInstructor]
    throttle_classes = [UploadThrottle]  # lectures carry files
    lookup_field = 'uuid'

    def get_queryset(self):
        return selectors.instructor_lectures(self.request.user, self.kwargs.get('section_uuid'))

    def perform_create(self, serializer):
        section = get_object_or_404(
            selectors.instructor_sections(self.request.user), uuid=self.kwargs.get('section_uuid'))
        serializer.instance = curriculum.add_lecture(
            section, serializer.validated_data, self.request.data, self.request.FILES)

    def update(self, request, *args, **kwargs):
        curriculum.ensure_editable(self.get_object().section.course, 'edit lectures of')
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        curriculum.edit_lecture(
            serializer.instance, serializer.validated_data, self.request.data, self.request.FILES)

    def perform_destroy(self, instance):
        curriculum.delete_lecture(instance)


@api_view(['POST'])
@permission_classes([IsInstructor])
def reorder_sections(request, course_uuid):
    """Reorder the sections of a course: ``{"section_orders": [{"uuid", "order"}, ...]}``."""
    course = get_object_or_404(selectors.instructor_courses(request.user), uuid=course_uuid)
    curriculum.reorder_sections(course, object_body(request).get('section_orders', []))
    return Response({'message': 'Sections reordered successfully'})


@api_view(['POST'])
@permission_classes([IsInstructor])
def reorder_lectures(request, section_uuid):
    """Reorder the lectures of a section: ``{"lecture_orders": [{"uuid", "order"}, ...]}``."""
    section = get_object_or_404(selectors.instructor_sections(request.user), uuid=section_uuid)
    curriculum.reorder_lectures(section, object_body(request).get('lecture_orders', []))
    return Response({'message': 'Lectures reordered successfully'})
