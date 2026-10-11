"""Courses: curriculum, content, thumbnails and the moderation state of each course.

States are reached through the lifecycle services, so the admins and
instructors receive the notifications the application itself would send.
"""
from decimal import Decimal

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db.models import F, Sum

from apps.assessments.models import Assignment as AssignmentModel
from apps.assessments.models import Question, QuestionOption
from apps.assessments.models import Quiz as QuizModel
from apps.content.models import Reading as ReadingContent
from apps.content.models import VideoContent
from apps.courses.models import Course, Lecture, Section
from apps.courses.services import lifecycle

from .. import assets
from ..clock import backdate, backdate_rows, notifications_at
from ..data.courses import COURSES, EXTENSIONS
from ..data.spec import Assignment, Quiz, Reading, Video

TITLE = 'Courses'
ADMIN = 'demo.admin@example.com'
MUST_WEIGHT_100 = ('published', 'taken_offline', 'pending_review', 'rejected')


def run(ctx):
    for slug, extension in EXTENSIONS.items():
        _extend_demo_course(ctx, slug, extension)
        ctx.courses[slug] = Course.objects.get(slug=slug)

    created = 0
    for spec in COURSES:
        course = Course.objects.filter(slug=spec.slug).first()
        if course is None:
            course = _create(ctx, spec)
            created += 1
        ctx.courses[spec.slug] = course

    ctx.count('courses', created)
    ctx.say(f'   {created} created, {len(COURSES) - created} already there')


# --------------------------------------------------------------------------- #
# a course from its spec
# --------------------------------------------------------------------------- #
def total_weight(spec):
    return sum(item.weight for section in spec.sections for item in section.items
               if isinstance(item, (Quiz, Assignment)))


def _create(ctx, spec):
    if spec.state in MUST_WEIGHT_100 and total_weight(spec) != 100:
        raise ValueError(f'{spec.slug}: grade weights add up to {total_weight(spec)}, not 100')

    course = Course(
        title=spec.title, slug=spec.slug, subtitle=spec.subtitle, description=spec.description,
        instructor=ctx.users[spec.instructor], course_type=spec.kind,
        category=ctx.categories.get(spec.category), language=ctx.languages[spec.language],
        level=spec.level, status='draft', is_featured=spec.featured,
        what_you_learn=list(spec.outcomes), requirements=list(spec.requirements), who_is_for=spec.audience,
        average_rating=Decimal(str(spec.rating)), total_reviews=spec.reviews,
    )
    _thumbnail(course, spec.title, spec.category)
    course.save()

    minutes = _curriculum(course, spec.sections)
    # the lifecycle services save the whole row: the instance must carry the hours
    course.duration_hours = round(Decimal(minutes) / 60, 2)
    course.estimated_hours = round(Decimal(minutes) / 60, 1)
    course.save(update_fields=['duration_hours', 'estimated_hours'])

    _moderate(ctx, course, spec)
    course.refresh_from_db()
    return course


def _thumbnail(course, title, category_slug):
    name = f'{course.slug}.png'
    path = f'course_thumbnails/{name}'
    if default_storage.exists(path):
        default_storage.delete(path)      # a leftover of an earlier run, not a second copy
    course.thumbnail.save(name, ContentFile(assets.thumbnail(title, category_slug)), save=False)


def _curriculum(course, sections, first_section=1):
    """Create sections, lectures and their content; returns the minutes of video."""
    minutes = 0
    for position, section_spec in enumerate(sections, start=first_section):
        section = Section.objects.create(course=course, title=section_spec.title,
                                         description=section_spec.description, order=position)
        for order, item in enumerate(section_spec.items, start=1):
            minutes += _lecture(course, section, order, item)
    return minutes


def _lecture(course, section, order, item):
    kind = {Video: 'video', Reading: 'reading', Quiz: 'quiz', Assignment: 'assignment'}[type(item)]
    lecture = Lecture.objects.create(
        section=section, title=item.title, content_type=kind, order=order,
        is_preview=getattr(item, 'preview', False))

    if isinstance(item, Video):
        VideoContent.objects.create(
            lecture=lecture, duration=item.minutes * 60,
            video_url=f'https://www.youtube.com/watch?v={item.youtube}')
        return item.minutes

    if isinstance(item, Reading):
        ReadingContent.objects.create(lecture=lecture, content=item.html)
    elif isinstance(item, Quiz):
        _quiz(course, section, lecture, item)
    else:
        AssignmentModel.objects.create(
            course=course, section=section, lecture=lecture, title=item.title,
            description=item.instructions.split('. ')[0].rstrip('.') + '.',
            instructions=item.instructions, max_points=item.points, passing_score=item.passing,
            weight=Decimal(item.weight), allow_late_submission=item.late_ok)
    return 0


def _quiz(course, section, lecture, spec):
    quiz = QuizModel.objects.create(
        course=course, section=section, lecture=lecture, title=spec.title, passing_score=spec.passing,
        max_attempts=spec.attempts, time_limit=spec.minutes, weight=Decimal(spec.weight),
        is_active=spec.active)
    for position, question in enumerate(spec.questions):
        row = Question.objects.create(
            quiz=quiz, question_text=question.text, question_type=question.kind, order=position,
            points=question.points, correct_answers=list(question.answers), explanation=question.why)
        for index, (text, correct) in enumerate(question.options):
            QuestionOption.objects.create(question=row, option_text=text, is_correct=correct, order=index)


# --------------------------------------------------------------------------- #
# moderation state
# --------------------------------------------------------------------------- #
def _moderate(ctx, course, spec):
    admin = ctx.users[ADMIN]
    state = spec.state
    created = ctx.ago(spec.created)

    if state in ('published', 'taken_offline'):
        submitted, decided = ctx.ago(spec.published + 2), ctx.ago(spec.published)
        with notifications_at(submitted):
            lifecycle.submit_for_review(course)
        with notifications_at(decided):
            lifecycle.approve(course, admin)
        backdate(course, created_at=created, updated_at=decided, published_date=decided)

    elif state == 'pending_review':
        submitted = ctx.ago(spec.published)
        with notifications_at(submitted):
            lifecycle.submit_for_review(course)
        if spec.edited_after_submission:
            # edited after it was submitted, so the review screen reports the missing weight
            last = QuizModel.objects.filter(course=course).order_by('-lecture__section__order',
                                                                    '-lecture__order').first()
            QuizModel.objects.filter(pk=last.pk).update(weight=F('weight') - spec.edited_after_submission)
        backdate(course, created_at=created, updated_at=submitted)

    elif state == 'rejected':
        submitted, decided = ctx.ago(spec.published + 3), ctx.ago(spec.published)
        with notifications_at(submitted):
            lifecycle.submit_for_review(course)
        with notifications_at(decided):
            lifecycle.reject(course, admin, spec.reason)
        backdate(course, created_at=created, updated_at=decided, rejection_date=decided)

    elif state == 'unpublished':
        # the application never writes this status itself; the admin filters offer it
        backdate(course, status='unpublished', created_at=created, updated_at=ctx.ago(spec.published),
                 published_date=None)

    else:   # draft
        backdate(course, created_at=created, updated_at=ctx.ago(max(spec.created // 3, 1)))


# --------------------------------------------------------------------------- #
# the two courses seed_demo creates
# --------------------------------------------------------------------------- #
def _extend_demo_course(ctx, slug, extension):
    course = Course.objects.filter(slug=slug).first()
    if course is None or course.sections.count() > 1:
        return      # not created by seed_demo, or extended already

    _curriculum(course, extension['sections'], first_section=course.sections.count() + 1)

    seconds = VideoContent.objects.filter(lecture__section__course=course).aggregate(
        total=Sum('duration'))['total'] or 0
    minutes = seconds // 60
    published = ctx.ago(extension['published'])
    category = course.category.slug if course.category else None
    _thumbnail(course, course.title, category)
    course.save(update_fields=['thumbnail'])
    backdate_rows(
        Course.objects.filter(pk=course.pk),
        duration_hours=Decimal(minutes) / 60, estimated_hours=round(Decimal(minutes) / 60, 1),
        average_rating=Decimal(str(extension['rating'])), total_reviews=extension['reviews'],
        created_at=ctx.ago(extension['created']), published_date=published, updated_at=published)
    course.refresh_from_db()
