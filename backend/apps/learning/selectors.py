"""Read side of the learning slice: catalogue, my courses, player data, rosters."""
from datetime import date, timedelta

from django.db.models import Count, Exists, OuterRef, Q, Subquery, Sum
from django.utils import timezone

from apps.content.models import VideoContent
from apps.core.utils import sanitize_search_query
from apps.courses.models import Course, Lecture, Section

from .models import CourseBookmark, Enrollment, LearningStreak, LectureProgress

ACTIVE = ('active',)
# a finished course stays open: the student may revisit it and retake what it contains
ACCESS = ('active', 'completed')
ENROLLED_VIEWS = {'active': ACTIVE, 'completed': ('completed',), 'all': ACCESS}


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


def catalog(user, *, category='all', level='all', course_type='all', search='', sort='popular'):
    """Published courses for the explore page, flagged with the viewer's own state.

    A queryset in a stable order, so a caller can take a page of it.
    """
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

    # the id breaks ties, so the same query always pages in the same order
    if sort == 'rating':
        courses = courses.order_by('-average_rating', 'id')
    elif sort == 'newest':
        courses = courses.order_by('-created_at', 'id')
    else:  # 'popular', which is also what an unknown value has always meant
        courses = courses.order_by('-total_enrolled', 'id')

    courses = _with_card_data(courses)

    if user.is_authenticated:
        own_enrollment = Enrollment.objects.filter(course=OuterRef('pk'), student=user)
        courses = courses.annotate(
            is_enrolled=Exists(own_enrollment),
            is_bookmarked=Exists(CourseBookmark.objects.filter(course=OuterRef('pk'), student=user)),
            own_progress=Subquery(own_enrollment.values('progress_percentage')[:1]),
        )

    return courses


def enrollment_for(student, course, *, statuses=ACTIVE):
    """The student's enrollment in ``course`` if its status is one of ``statuses``, else ``None``."""
    return Enrollment.objects.filter(student=student, course=course, status__in=statuses).first()


def enrollment_for_access(student, course):
    """The enrollment that lets the student into the course: running or finished."""
    return enrollment_for(student, course, statuses=ACCESS)


def course_enrollments(course, *, statuses=ACTIVE):
    """The learners of ``course`` whose enrollment is in one of ``statuses``."""
    return Enrollment.objects.filter(course=course, status__in=statuses).select_related('student')


def student_enrollments(student, *, statuses=ACTIVE):
    """The enrollments of ``student`` in one of ``statuses``."""
    return Enrollment.objects.filter(student=student, status__in=statuses)


def enrolled_courses(student, *, view='active'):
    """The student's courses (``view`` is a key of ``ENROLLED_VIEWS``), most recently visited first."""
    return student_enrollments(student, statuses=ENROLLED_VIEWS[view]).select_related(
        'course', 'course__instructor'
    ).order_by('-last_accessed', '-id')


def progress_by_lecture(enrollment, lectures):
    """``{lecture pk: LectureProgress}``; a lecture without a row yet gets an unsaved default.

    Reading never writes: rows appear when the student does something.
    """
    rows = {row.lecture_id: row for row in LectureProgress.objects.filter(enrollment=enrollment)}
    return {
        lecture.pk: rows.get(lecture.pk) or LectureProgress(enrollment=enrollment, lecture=lecture)
        for lecture in lectures
    }


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
    """Enrollments of one course with their students, oldest first."""
    return Enrollment.objects.filter(course=course).select_related('student').order_by('id')


def instructor_roster(instructor):
    """Every enrollment in the instructor's courses, newest first."""
    return Enrollment.objects.filter(
        course__instructor=instructor
    ).select_related('student', 'course').order_by('-enrolled_date')


# --------------------------------------------------------------------------- #
# the activity log: what was really learned, and when
# --------------------------------------------------------------------------- #
STREAK_LOOKBACK_DAYS = 400


def video_seconds(lecture):
    """Length of a video lecture in seconds (0 when it was never recorded)."""
    return VideoContent.objects.filter(lecture=lecture).values_list('duration', flat=True).first() or 0


def month_start(day, back=0):
    """The first day of the month ``back`` months before ``day``'s month."""
    index = day.year * 12 + day.month - 1 - back
    return date(index // 12, index % 12 + 1, 1)


def _log(since=None):
    rows = LearningStreak.objects.all()
    return rows if since is None else rows.filter(streak_date__gte=since)


def total_seconds(student, *, since=None):
    """Seconds the student spent learning, all time or since a day."""
    return _log(since).filter(student=student).aggregate(total=Sum('seconds_learned'))['total'] or 0


def streak_run(student, *, today=None):
    """``(length, last day)`` of the run of consecutive days with activity that ends today.

    A day that has not seen activity yet does not break the run: it then ends yesterday.
    """
    today = today or timezone.localdate()
    days = set(
        LearningStreak.objects
        .filter(student=student, streak_date__gte=today - timedelta(days=STREAK_LOOKBACK_DAYS))
        .values_list('streak_date', flat=True)
    )
    day = today if today in days else today - timedelta(days=1)
    last, length = day, 0
    while day in days:
        length += 1
        day -= timedelta(days=1)
    return length, (last if length else None)


def current_streak(student, *, today=None):
    """Consecutive days with learning activity, counting back from today."""
    return streak_run(student, today=today)[0]


def seconds_by_month(student, months, *, today=None):
    """``[(first day of the month, seconds), ...]`` of the last ``months`` calendar months, oldest first."""
    today = today or timezone.localdate()
    first = month_start(today, back=months - 1)
    totals = {}
    rows = LearningStreak.objects.filter(student=student, streak_date__gte=first)
    for day, seconds in rows.values_list('streak_date', 'seconds_learned'):
        key = day.replace(day=1)
        totals[key] = totals.get(key, 0) + seconds
    starts = [month_start(today, back=months - 1 - index) for index in range(months)]
    return [(start, totals.get(start, 0)) for start in starts]


def rank_by_seconds(student, *, since=None):
    """Place of the student among everyone by time learned (1 = most; a tie shares the place)."""
    mine = total_seconds(student, since=since)
    ahead = (
        _log(since).values('student')
        .annotate(total=Sum('seconds_learned'))
        .filter(total__gt=mine)
        .count()
    )
    return ahead + 1
