# courses/api/serializers.py
from rest_framework import serializers

from .. import extensions
from ..models import Course, Section, Lecture


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
    through the lifecycle service (submit, approve, reject, unpublish).
    """
    class Meta:
        model = Course
        exclude = ['uuid', 'instructor', 'total_enrolled', 'total_reviews',
                  'average_rating', 'published_date']
        read_only_fields = ['status', 'is_featured', 'rejection_reason',
                            'rejection_date', 'rejected_by']

    def create(self, validated_data):
        validated_data['instructor'] = self.context['request'].user
        return super().create(validated_data)
