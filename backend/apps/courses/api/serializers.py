"""Serializers and list rows of the courses API."""

from django.db import IntegrityError, transaction
from rest_framework import serializers

from .. import extensions
from ..models import Course, Section, Lecture
from ..services import courses as course_service

SLUG_ATTEMPTS = 3  # two courses created in the same instant may pick the same free slug


class LectureSerializer(serializers.ModelSerializer):
    """Instructor's view of a lecture.

    The content specific keys (quiz settings, video info, ...) and the
    enrichments of higher slices (completion rate) come from the registries in
    ``courses.extensions``; every lecture exposes the same set of keys.
    """
    id = serializers.UUIDField(source='uuid', read_only=True)
    resources = serializers.SerializerMethodField()  # kept for the v1 shape: always empty
    completion_rate = serializers.SerializerMethodField()
    quiz_settings = serializers.SerializerMethodField()
    questions = serializers.SerializerMethodField()
    assignment_settings = serializers.SerializerMethodField()
    reading_document = serializers.SerializerMethodField()
    video_content = serializers.SerializerMethodField()
    article_content = serializers.SerializerMethodField()  # For reading content
    subtitle_file = serializers.SerializerMethodField()
    existing_video_name = serializers.SerializerMethodField()
    existing_subtitle_name = serializers.SerializerMethodField()

    class Meta:
        model = Lecture
        fields = ['id', 'title', 'description', 'content_type', 'order',
                 'is_preview', 'is_downloadable', 'resources', 'completion_rate',
                 'quiz_settings', 'questions', 'assignment_settings', 'reading_document',
                 'video_content', 'article_content', 'subtitle_file',
                 'existing_video_name', 'existing_subtitle_name']

    def _extra(self, obj):
        """Content/enrichment keys of ``obj`` (computed once per lecture)."""
        cache = self.__dict__.setdefault('_extra_cache', {})
        if obj.pk not in cache:
            payload = extensions.instructor_lecture_payload(obj)
            payload.update(extensions.lecture_extras(obj))
            cache[obj.pk] = payload
        return cache[obj.pk]

    def get_resources(self, obj):
        return []

    def get_completion_rate(self, obj):
        return self._extra(obj).get('completion_rate', 0)

    def get_quiz_settings(self, obj):
        return self._extra(obj).get('quiz_settings')

    def get_questions(self, obj):
        return self._extra(obj).get('questions', [])

    def get_assignment_settings(self, obj):
        return self._extra(obj).get('assignment_settings')

    def get_reading_document(self, obj):
        return self._extra(obj).get('reading_document')

    def get_video_content(self, obj):
        return self._extra(obj).get('video_content')

    def get_article_content(self, obj):
        return self._extra(obj).get('article_content', '')

    def get_subtitle_file(self, obj):
        return self._extra(obj).get('subtitle_file')

    def get_existing_video_name(self, obj):
        return self._extra(obj).get('existing_video_name')

    def get_existing_subtitle_name(self, obj):
        return self._extra(obj).get('existing_subtitle_name')


class SectionSerializer(serializers.ModelSerializer):
    """A section with its lectures, as the instructor edits them."""
    id = serializers.UUIDField(source='uuid', read_only=True)
    lectures = LectureSerializer(many=True, read_only=True)
    total_duration = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = ['id', 'title', 'description', 'order', 'is_preview',
                 'lectures', 'total_duration']

    def get_total_duration(self, obj):
        return sum(extensions.lecture_duration(lecture) for lecture in obj.lectures.all())


class CourseListSerializer(serializers.ModelSerializer):
    """Simplified serializer for course listing"""
    id = serializers.UUIDField(source='uuid', read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'title', 'slug', 'thumbnail', 'status', 'course_type', 'created_at',
                 'total_enrolled', 'average_rating', 'is_featured']


class CourseDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for course management"""
    id = serializers.UUIDField(source='uuid', read_only=True)
    sections = SectionSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    language_name = serializers.CharField(source='language.name', read_only=True)

    class Meta:
        model = Course
        fields = '__all__'
        read_only_fields = ['uuid', 'total_enrolled', 'total_reviews',
                           'average_rating', 'published_date']


class CourseCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating courses.

    The status workflow fields are read-only: a course only changes state
    through the lifecycle service (submit, approve, reject, unpublish).  The
    slug is optional: one is made from the title (and kept when the title changes,
    so links to the course keep working); a client that sends one still decides.
    """
    class Meta:
        model = Course
        exclude = ['uuid', 'instructor', 'total_enrolled', 'total_reviews',
                  'average_rating', 'published_date']
        read_only_fields = ['status', 'is_featured', 'rejection_reason',
                            'rejection_date', 'rejected_by']
        extra_kwargs = {'slug': {'required': False}}

    def create(self, validated_data):
        validated_data['instructor'] = self.context['request'].user
        generated = not validated_data.get('slug')

        for attempt in range(SLUG_ATTEMPTS):
            if generated:
                validated_data['slug'] = course_service.unique_slug(validated_data['title'])
            try:
                with transaction.atomic():
                    return super().create(validated_data)
            except IntegrityError:
                if not generated or attempt == SLUG_ATTEMPTS - 1:
                    raise


# --------------------------------------------------------------------------- #
# list rows (plain dicts: some carry columns that slices above courses add)
# --------------------------------------------------------------------------- #
def instructor_course_row(course):
    """One row of the instructor's course list."""
    row = {
        'id': str(course.uuid),
        'title': course.title,
        'status': course.status,
        'course_type': course.course_type,
        'total_enrolled': course.total_enrolled or 0,
        'average_rating': float(course.average_rating or 0),
        'created_at': course.created_at.isoformat(),
        'thumbnail': course.thumbnail.url if course.thumbnail else None,
    }
    return extensions.enrich_course_row(course, row)


def _admin_course_summary(course):
    """Fields shared by the pending and the all-courses lists of the admin."""
    instructor = course.instructor
    # the counters are annotated by the selector; a course loaded some other way is counted here
    sections = getattr(course, 'sections_total', None)
    lectures = getattr(course, 'lectures_total', None)
    if sections is None:
        sections = course.sections.count()
        lectures = sum(section.lectures.count() for section in course.sections.all())

    return {
        'id': str(course.uuid),
        'title': course.title,
        'instructor': {
            'id': str(instructor.uuid),
            'name': f"{instructor.first_name} {instructor.last_name}".strip() or instructor.email,
            'email': instructor.email,
        },
        'category': course.category.name if course.category else 'Uncategorized',
        'course_type': course.course_type,
        'sections_count': sections,
        'lectures_count': lectures,
        'total_weight': float(extensions.total_grade_weight(course)),
        'description': course.description,
        'thumbnail': course.thumbnail.url if course.thumbnail else None,
        'duration_hours': float(course.duration_hours) if course.duration_hours else 0,
    }


def pending_course_row(course):
    """A course waiting for review."""
    return {**_admin_course_summary(course), 'submitted_date': course.updated_at.isoformat()}


def admin_course_row(course):
    """A course in the admin overview."""
    return {
        **_admin_course_summary(course),
        'status': course.status,
        'created_date': course.created_at.isoformat(),
        'published_date': course.published_date.isoformat() if course.published_date else None,
        'total_enrolled': course.total_enrolled,
        'average_rating': float(course.average_rating) if course.average_rating else 0,
    }


def category_row(category):
    """What the create form needs of a category: the id it sends back, and the label."""
    return {'id': category.pk, 'name': category.name, 'slug': category.slug}


def language_row(language):
    return {'id': language.pk, 'code': language.code, 'name': language.name}
