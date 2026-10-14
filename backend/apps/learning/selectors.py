"""Read side of the learning slice: catalogue, my courses, player data, rosters."""
from django.db.models import Count, Exists, OuterRef, Q, Subquery, Sum

from apps.content.models import VideoContent
from apps.core.utils import sanitize_search_query
from apps.courses.models import Course, Lecture, Section

from .models import CourseBookmark, Enrollment, LectureProgress

CATALOG_LIMIT = 20


def _with_card_data(courses):
    """Annotate what a course card shows: module count and video seconds."""
    video_seconds = (
        VideoContent.objects
        .filter(lecture__section__course=OuterRef('pk'), lecture__content_type='video')
        .order_by()
        .values('lecture__section__course')
        .annotate(total=Sum('duration'))
        .values('total')
    )
    return courses.select_related('instructor', 'category').annotate(
        module_count=Count('sections', distinct=True),
        video_seconds=Subquery(video_seconds),
    )


def catalog(user, *, category='all', level='all', course_type='all', search='', sort='popular',
            limit=CATALOG_LIMIT):
    """Published courses for the explore page, flagged with the viewer's own state."""
    courses = Course.objects.filter(status='published')

    if category != 'all':
        courses = courses.filter(category__slug=category)
    if level != 'all':
        courses = courses.filter(level=level)
    if course_type != 'all':
        courses = courses.filter(course_type=course_type)

    search = sanitize_search_query(search) if search else ''
    if search:
        courses = courses.filter(
            Q(title__icontains=search) |
            Q(description__icontains=search) |
            Q(instructor__first_name__icontains=search) |
            Q(instructor__last_name__icontains=search)
        )

    if sort == 'popular':
        courses = courses.order_by('-total_enrolled')
    elif sort == 'rating':
        courses = courses.order_by('-average_rating')
    elif sort == 'newest':
        courses = courses.order_by('-created_at')

    courses = _with_card_data(courses)

    if user.is_authenticated:
        own_enrollment = Enrollment.objects.filter(course=OuterRef('pk'), student=user)
        courses = courses.annotate(
            is_enrolled=Exists(own_enrollment),
            is_bookmarked=Exists(CourseBookmark.objects.filter(course=OuterRef('pk'), student=user)),
            own_progress=Subquery(own_enrollment.values('progress_percentage')[:1]),
        )

    return list(courses[:limit])


def enrolled_courses(student):
    """The student's running enrollments, most recently visited first."""
    return Enrollment.objects.filter(
        student=student,
        status='active'
    ).select_related('course', 'course__instructor').order_by('-last_accessed')


def lesson_counts(enrollment):
    """``(total, completed)`` lectures of the enrollment's course."""
    total = Lecture.objects.filter(section__course=enrollment.course).count()
    completed = LectureProgress.objects.filter(enrollment=enrollment, is_completed=True).count()
    return total, completed


def next_lecture(enrollment):
    """The first lecture, in course order, the student has not completed yet."""
    done = LectureProgress.objects.filter(
        enrollment=enrollment, is_completed=True
    ).values_list('lecture_id', flat=True)
    return Lecture.objects.filter(
        section__course=enrollment.course
    ).exclude(id__in=done).order_by('section__order', 'order').first()


def player_outline(course):
    """Sections of a course with their lectures in order: ``[(section, [lecture, ...]), ...]``."""
    sections = Section.objects.filter(course=course).order_by('order').prefetch_related('lectures')
    return [
        (section, sorted(section.lectures.all(), key=lambda lecture: lecture.order))
        for section in sections
    ]


def course_roster(course):
    """Enrollments of one course with their students, in database order."""
    return Enrollment.objects.filter(course=course).select_related('student')


def instructor_roster(instructor):
    """Every enrollment in the instructor's courses, newest first."""
    return Enrollment.objects.filter(
        course__instructor=instructor
    ).select_related('student', 'course').order_by('-enrolled_date')
