"""Learning: enrolments, progress, quiz attempts, hand-ins, grades and bookmarks.

Everything goes through the services a student's clicks would reach, so the
progress percentages, the enrolment counters, the grades and the notifications
are the application's own.  The dates are then moved into the past (see
``clock``).  One enrolment is one unit: it is skipped when it already exists.
"""
from datetime import timedelta

from django.core.files.base import ContentFile
from django.utils import timezone

from apps.assessments.models import Assignment as AssignmentModel
from apps.assessments.models import AssignmentSubmission, QuestionResponse
from apps.assessments.models import Quiz as QuizModel
from apps.assessments.services import assignments, quizzes
from apps.core.api.errors import ServiceError
from apps.courses.models import Lecture
from apps.learning import services as learning
from apps.learning.models import CourseBookmark, Enrollment, LearningStreak, LectureProgress

from .. import assets
from ..clock import backdate, backdate_rows, notifications_at
from ..data.courses import BY_SLUG, EXTENSIONS
from ..data.people import BY_EMAIL
from ..data.stories import STORIES
from . import recognition

TITLE = 'Learning'
READING_SECONDS = 300


def run(ctx):
    enrolled = bookmarked = 0
    for story in STORIES:
        student = ctx.users[story.email]
        for spec in story.enrol:
            enrolled += _enrol(ctx, student, spec)
        for slug in story.bookmarks:
            bookmarked += _bookmark(ctx, student, slug)

    ctx.count('enrolments', enrolled)
    ctx.count('bookmarks', bookmarked)
    ctx.say(f'   {enrolled} enrolments and {bookmarked} bookmarks created')


# --------------------------------------------------------------------------- #
# one enrolment
# --------------------------------------------------------------------------- #
def _enrol(ctx, student, spec):
    course = ctx.courses[spec.course]
    if Enrollment.objects.filter(student=student, course=course).exists():
        return 0

    lectures = list(Lecture.objects.filter(section__course=course)
                    .order_by('section__order', 'order'))
    _check(student, spec, lectures)
    start = ctx.ago(spec.days)

    with notifications_at(start):
        try:
            enrollment = learning.enroll(student, course)
        except ServiceError as error:
            raise ValueError(f'{student.email} cannot enrol in {course.slug}: {error}') from error
    backdate(enrollment, created_at=start, updated_at=start, enrolled_date=start)
    backdate_rows(LectureProgress.objects.filter(enrollment=enrollment), created_at=start, updated_at=start)

    moments = _moments(ctx, spec, start)
    seconds = 0
    for lecture, when in zip(lectures, moments, strict=False):
        spent = _finish(ctx, student, course.instructor, enrollment, lecture, when, spec)
        seconds += spent
        # the day the student learned: the log is what streaks, hours and ranks read
        learning.record_activity(student, course, spent, day=timezone.localdate(when))
    _forget_the_day_of_the_run(student, moments)

    enrollment.refresh_from_db()
    last = moments[-1] if moments else None
    fields = {'total_time_spent': seconds, 'last_accessed': last, 'updated_at': last or start}
    if enrollment.status == 'completed':
        fields['completed_date'] = last
    backdate(enrollment, **fields)

    if spec.certificate:
        recognition.issue(ctx, enrollment, last)
    return 1


def _forget_the_day_of_the_run(student, moments):
    """The services log every completion on the day the seed runs; the story says it
    happened earlier, so a day with nothing but those empty marks is dropped."""
    today = timezone.localdate()
    if any(timezone.localdate(when) == today for when in moments):
        return
    LearningStreak.objects.filter(student=student, streak_date=today, seconds_learned=0).delete()


def _check(student, spec, lectures):
    """Catch a story that cannot have happened (an authoring mistake, not a runtime condition)."""
    where = f'{student.email} / {spec.course}'
    published = (BY_SLUG[spec.course].published if spec.course in BY_SLUG
                 else EXTENSIONS[spec.course]['published'])
    if spec.days > published:
        raise ValueError(f'{where}: enrolled {spec.days} days ago, but the course was published '
                         f'{published} days ago')
    if spec.days > BY_EMAIL[student.email].joined:
        raise ValueError(f'{where}: enrolled before the account existed')
    if spec.done > len(lectures):
        raise ValueError(f'{where}: done={spec.done} but the course has {len(lectures)} lectures')
    if spec.certificate and spec.done != len(lectures):
        raise ValueError(f'{where}: a certificate needs every lecture finished')

    finished = lectures[:spec.done]
    quiz_titles = {QuizModel.objects.get(lecture=lecture).title
                   for lecture in finished if lecture.content_type == 'quiz'}
    work_titles = {AssignmentModel.objects.get(lecture=lecture).title
                   for lecture in finished if lecture.content_type == 'assignment'}
    if set(spec.quiz) != quiz_titles:
        raise ValueError(f'{where}: quiz outcomes {sorted(spec.quiz)} do not match the finished '
                         f'quizzes {sorted(quiz_titles)}')
    if set(spec.work) != work_titles:
        raise ValueError(f'{where}: hand-ins {sorted(spec.work)} do not match the finished '
                         f'assignments {sorted(work_titles)}')
    if spec.done == len(lectures) and lectures and lectures[-1].content_type == 'quiz' \
            and len(spec.quiz[QuizModel.objects.get(lecture=lectures[-1]).title]) > 1:
        raise ValueError(f'{where}: retakes of the last quiz cannot happen, the course is complete '
                         'after the first attempt')


def _moments(ctx, spec, start):
    """When each finished lecture was finished, oldest first."""
    n = spec.done
    if n == 0:
        return []
    if spec.daily:
        return [ctx.ago(days=n - 1 - i, hours=1) for i in range(n)]

    last = spec.last if spec.last is not None else spec.days * 0.4
    end = ctx.ago(last)
    if end <= start + timedelta(minutes=10 * n):
        end = start + timedelta(minutes=10 * n)
    return [start + (end - start) * (i + 1) / n for i in range(n)]


# --------------------------------------------------------------------------- #
# finishing a lecture
# --------------------------------------------------------------------------- #
def _finish(ctx, student, instructor, enrollment, lecture, when, spec):
    """Finish one lecture the way the student would; returns the seconds spent on it."""
    if lecture.content_type == 'quiz':
        return _quiz(ctx, student, enrollment, lecture, when, spec)
    if lecture.content_type == 'assignment':
        return _assignment(ctx, student, instructor, enrollment, lecture, when, spec)

    learning.complete_lecture(enrollment, lecture)
    seconds = lecture.video_content.duration if lecture.content_type == 'video' else READING_SECONDS
    _stamp_progress(enrollment, lecture, when, seconds)
    return seconds


def _stamp_progress(enrollment, lecture, when, seconds):
    fields = {'completed_date': when, 'updated_at': when}
    if lecture.content_type == 'video':
        fields.update(progress_seconds=seconds, last_watched_position=seconds, watch_count=1)
    LectureProgress.objects.filter(enrollment=enrollment, lecture=lecture).update(**fields)


def _quiz(ctx, student, enrollment, lecture, when, spec):
    quiz = QuizModel.objects.get(lecture=lecture)
    seconds = 0
    for index, correct in enumerate(spec.quiz[quiz.title]):
        started = min(when + timedelta(hours=6 * index), ctx.now - timedelta(minutes=30))
        finished = started + timedelta(minutes=9)

        attempt = quizzes.start_attempt(student, quiz, enrollment)
        quizzes.submit_attempt(student, quiz, enrollment, attempt.uuid, _answers(quiz, correct))
        backdate(attempt, start_time=started, end_time=finished, created_at=started, updated_at=finished)
        backdate_rows(QuestionResponse.objects.filter(attempt=attempt),
                      created_at=finished, updated_at=finished)
        if index == 0:
            _stamp_progress(enrollment, lecture, finished, 0)
        seconds += 9 * 60
    return seconds


def _answers(quiz, correct):
    """The answers payload: the first ``correct`` questions right, the others wrong."""
    answers = {}
    for index, question in enumerate(quiz.questions.order_by('order')):
        right = index < correct
        options = list(question.options.order_by('order'))
        good = [option for option in options if option.is_correct]
        bad = [option for option in options if not option.is_correct]

        if question.question_type in ('multiple_choice', 'true_false'):
            answer = {'selected_option': str((good if right else bad)[0].uuid)}
        elif question.question_type == 'multiple_select':
            answer = {'selected_options': [str(option.uuid) for option in (good if right else bad[:1])]}
        else:   # fill_blank
            answer = {'text_answer': question.correct_answers[0] if right else 'no idea'}
        answers[str(question.uuid)] = answer
    return answers


def _assignment(ctx, student, instructor, enrollment, lecture, when, spec):
    assignment = AssignmentModel.objects.get(lecture=lecture)
    work = spec.work[assignment.title]

    submission = assignments.submit(student, assignment, work.text, _document(assignment, work))
    enrollment.refresh_from_db()    # the service worked on its own copy of the enrolment
    backdate(submission, submitted_at=when, created_at=when, updated_at=when)
    _stamp_progress(enrollment, lecture, when, 0)

    if work.grade is not None:
        graded = min(when + timedelta(days=1.5), ctx.now - timedelta(hours=2))
        with notifications_at(graded):
            assignments.grade(submission, instructor, work.grade, work.feedback)
        backdate_rows(AssignmentSubmission.objects.filter(pk=submission.pk),
                      graded_at=graded, updated_at=graded)
    return 20 * 60


def _document(assignment, work):
    """The uploaded file of a hand-in (``None`` for a text-only one)."""
    if not work.file:
        return None
    if work.file.endswith('.pdf'):
        content = assets.pdf(assignment.title, work.text or 'Submitted work.')
    else:
        content = (work.text or 'Submitted work.').encode()
    return ContentFile(content, name=work.file)


# --------------------------------------------------------------------------- #
# bookmarks
# --------------------------------------------------------------------------- #
def _bookmark(ctx, student, slug):
    course = ctx.courses[slug]
    bookmark, created = CourseBookmark.objects.get_or_create(student=student, course=course)
    if created:
        when = ctx.ago(days=ctx.rng.randint(1, 14))
        backdate(bookmark, created_at=when, updated_at=when)
    return int(created)
