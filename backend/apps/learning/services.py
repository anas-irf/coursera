"""Use-cases of the learning slice: enrolling, progress, watch time and bookmarks."""
import logging
import math
from decimal import ROUND_HALF_UP, Decimal

from django.db import DatabaseError, transaction
from django.db.models import F
from django.utils import timezone

from apps.accounts.models import StudentProfile
from apps.billing.selectors import has_plus_access
from apps.core.api.errors import NotFound, ServiceError
from apps.core.events import course_completed, emit, student_enrolled
from apps.courses.models import Course

from . import selectors
from .models import CourseBookmark, Enrollment, LearningStreak, LectureProgress

logger = logging.getLogger(__name__)

# a quiz or an assignment finishes its lecture itself, when it is taken or handed in
SELF_COMPLETING = ('quiz', 'assignment')

# What a heartbeat can add to the time spent, whatever the client claims (the player
# sends one every ~15 s), and the furthest position accepted for a video of unknown length.
HEARTBEAT_CREDIT_CAP = 60
MAX_VIDEO_POSITION = 24 * 3600


def enroll(student, course):
    """Enroll ``student`` in a published course and tell the other slices."""
    if course.status != 'published':
        raise NotFound('Course not found')

    if Enrollment.objects.filter(course=course, student=student).exists():
        raise ServiceError('Already enrolled in this course')

    if course.course_type == 'coursera_plus' and not has_plus_access(student):
        raise ServiceError(
            'Coursera Plus subscription required',
            status_code=402,
            requires_subscription=True,
            course_type='coursera_plus',
            course_title=course.title,
            checkout_url='/checkout',  # the frontend redirects here
            message=f'Upgrade to Coursera Plus to access "{course.title}" and thousands of other courses',
        )

    with transaction.atomic():
        enrollment = Enrollment.objects.create(
            student=student,
            course=course,
            enrolled_date=timezone.now(),
        )
        Course.objects.filter(pk=course.pk).update(total_enrolled=F('total_enrolled') + 1)

    emit(student_enrolled, enrollment=enrollment)
    return enrollment


def progress_for(enrollment, lecture):
    """The progress row of a lecture, created on first write (rows of lectures added later too)."""
    progress, _ = LectureProgress.objects.get_or_create(
        enrollment=enrollment,
        lecture=lecture,
        defaults={
            'is_completed': False,
            'progress_seconds': 0,
            'last_watched_position': 0,
            'watch_count': 0,
        },
    )
    return progress


def refresh_progress(enrollment):
    """Recompute the enrollment's progress from the lectures completed so far.

    The course is completed when every lecture is.  Returns ``True`` when this very call
    completed it, so the caller can announce it once.
    """
    total, done = selectors.lesson_counts(enrollment)
    if total == 0:
        return False

    percentage = min(Decimal(done) * 100 / Decimal(total), Decimal(100))
    enrollment.progress_percentage = percentage.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    fields = ['progress_percentage']

    just_completed = done >= total and enrollment.status == 'active'
    if just_completed:
        enrollment.status = 'completed'
        enrollment.completed_date = timezone.now()
        fields += ['status', 'completed_date']
    enrollment.save(update_fields=fields)
    return just_completed


def _finish(enrollment, progress):
    """Stamp ``progress`` completed and refresh the course; ``True`` when the course just completed."""
    now = timezone.now()
    if not progress.is_completed:
        progress.is_completed = True
        progress.completed_date = now
        progress.save(update_fields=['is_completed', 'completed_date', 'updated_at'])

    just_completed = refresh_progress(enrollment)

    enrollment.last_accessed = now
    enrollment.save(update_fields=['last_accessed'])
    record_activity(enrollment.student, enrollment.course)
    return just_completed


def complete_lecture(enrollment, lecture):
    """Mark a video or reading lecture completed (again is harmless) and refresh the progress."""
    if lecture.content_type in SELF_COMPLETING:
        raise ServiceError(
            f'A {lecture.content_type} lecture is completed by taking it, not by marking it as done')

    with transaction.atomic():
        progress = progress_for(enrollment, lecture)
        # work on the caller's enrollment so its progress is up to date afterwards
        progress.enrollment = enrollment
        just_completed = _finish(enrollment, progress)

    if just_completed:
        emit(course_completed, enrollment=enrollment)
    return progress


def complete_lecture_once(enrollment, lecture):
    """Complete a lecture as a side effect of another action (a quiz taken, work handed in).

    Does nothing when the lecture is already completed.  Progress bookkeeping must not undo
    the action that caused it, so a database failure is logged with its traceback and
    answered with ``None``; the savepoint keeps the caller's transaction usable.  Anything
    else is a bug and surfaces as one.
    """
    try:
        with transaction.atomic():
            progress = progress_for(enrollment, lecture)
            if progress.is_completed:
                return progress
            progress.enrollment = enrollment
            just_completed = _finish(enrollment, progress)
    except DatabaseError:
        logger.exception('Could not complete lecture %s for enrollment %s', lecture.pk, enrollment.pk)
        return None

    if just_completed:
        emit(course_completed, enrollment=enrollment)
    return progress


def record_activity(student, course, seconds=0, *, day=None):
    """Add ``seconds`` to the student's learning log of ``day`` (today) and note the course.

    The first activity of a day also refreshes the totals kept on the student's profile.
    """
    day = day or timezone.localdate()
    entry, created = LearningStreak.objects.get_or_create(student=student, streak_date=day)
    if seconds:
        LearningStreak.objects.filter(pk=entry.pk).update(
            seconds_learned=F('seconds_learned') + seconds)
    entry.courses_accessed.add(course)
    if created:
        sync_profile_totals(student)
    return entry


def sync_profile_totals(student):
    """Refresh the streak, the hours and the last day of learning on the student's profile
    from the log (the log is the source; the profile columns are a convenience)."""
    last = LearningStreak.objects.filter(student=student).order_by('-streak_date').first()
    hours = (Decimal(selectors.total_seconds(student)) / 3600).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP)
    StudentProfile.objects.filter(user=student).update(
        learning_streak=selectors.current_streak(student),
        total_learning_hours=hours,
        last_learning_date=last.streak_date if last else None,
    )


def record_watch(enrollment, lecture, position, *, finished=False, now=None):
    """Store where the student is in a video and credit the time they spent watching it.

    ``position`` is the playback position in seconds as the player reports it, ``finished``
    is sent when the video played to its end.  What is credited is bounded three ways, so a
    client cannot inflate its hours: by how far the position moved forward, by the real time
    since the previous heartbeat and by ``HEARTBEAT_CREDIT_CAP``.
    """
    if lecture.content_type != 'video':
        raise ServiceError('Watch time is only recorded for video lectures')
    if (isinstance(position, bool) or not isinstance(position, (int, float))
            or not math.isfinite(position) or position < 0):
        raise ServiceError('position must be a number of seconds, zero or more')

    now = now or timezone.now()
    position = min(int(position), selectors.video_seconds(lecture) or MAX_VIDEO_POSITION)

    with transaction.atomic():
        progress = progress_for(enrollment, lecture)
        elapsed = max(0, int((now - progress.updated_at).total_seconds()))
        advanced = max(0, position - progress.last_watched_position)
        credited = min(advanced, elapsed, HEARTBEAT_CREDIT_CAP)

        # a finished video starts from the beginning the next time
        progress.last_watched_position = 0 if finished else position
        progress.progress_seconds = max(progress.progress_seconds, position)
        if finished:
            progress.watch_count += 1
        progress.save(update_fields=[
            'last_watched_position', 'progress_seconds', 'watch_count', 'updated_at'])

        Enrollment.objects.filter(pk=enrollment.pk).update(
            total_time_spent=F('total_time_spent') + credited, last_accessed=now)
        enrollment.total_time_spent += credited
        enrollment.last_accessed = now
        record_activity(enrollment.student, enrollment.course, credited)
    return progress


def toggle_bookmark(student, course):
    """Bookmark ``course`` or remove the bookmark; returns ``True`` when it is now bookmarked."""
    bookmark, created = CourseBookmark.objects.get_or_create(student=student, course=course)
    if not created:
        bookmark.delete()
    return created
