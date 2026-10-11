"""Data builders and model access for the characterization suite.

This is the ONLY module of the suite that imports application packages
(``accounts``, ``courses`` ...).  Every other test module obtains models through
this module (``from factories import Enrollment``), so the package renames /
model moves planned for the refactor only ever touch the import block below.

Nothing in here depends on URL names, namespaces or view modules.
"""
import io
import itertools
import uuid as _uuid
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from django.utils.text import slugify
from PIL import Image

# --------------------------------------------------------------------------- #
# MODEL IMPORT BLOCK - the only place where application packages are imported #
# --------------------------------------------------------------------------- #
from apps.accounts.models import User, StudentProfile, InstructorProfile  # noqa: E402,F401
from apps.core.models import Category, Language  # noqa: E402,F401
from apps.courses.models import Course, Section, Lecture  # noqa: E402,F401
from apps.content.models import VideoContent, Reading, Subtitle  # noqa: E402,F401
from apps.learning.models import (  # noqa: E402,F401
    Enrollment, LectureProgress, CourseBookmark,
)
from apps.assessments.models import (  # noqa: E402,F401
    Quiz, Question, QuestionOption, QuizAttempt, QuestionResponse,
    Assignment, AssignmentSubmission,
)
from apps.notifications.models import Notification  # noqa: E402,F401
from apps.billing.models import (  # noqa: E402,F401
    InstructorEarning, SubscriptionPlan, StudentPlusSubscription, StudentPlusPayment,
)
from apps.certificates.models import Certificate  # noqa: E402,F401
from apps.messaging.models import DirectMessage  # noqa: E402,F401
# --------------------------------------------------------------------------- #

DEFAULT_PASSWORD = 'Str0ng-Passw0rd!x'

_counter = itertools.count(1)


def _uniq():
    return f'{next(_counter)}{_uuid.uuid4().hex[:6]}'


# --------------------------------------------------------------------------- #
# Files
# --------------------------------------------------------------------------- #
def png_file(name='thumbnail.png', size=(8, 8), color=(200, 30, 30)):
    """A tiny but fully valid PNG generated with Pillow."""
    buf = io.BytesIO()
    Image.new('RGB', size, color).save(buf, format='PNG')
    return SimpleUploadedFile(name, buf.getvalue(), content_type='image/png')


def pdf_file(name='document.pdf'):
    """Minimal PDF payload (only the extension is validated by the app)."""
    body = b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'
    return SimpleUploadedFile(name, body, content_type='application/pdf')


def txt_file(name='notes.txt', text='plain text submission'):
    return SimpleUploadedFile(name, text.encode(), content_type='text/plain')


def markdown_file(name='reading.md', text='# Heading\n\nSome text.\n'):
    return SimpleUploadedFile(name, text.encode(), content_type='text/markdown')


def named_file(name, content=b'content', content_type='application/octet-stream'):
    """An arbitrary upload (used for file-name / extension validation tests)."""
    return SimpleUploadedFile(name, content, content_type=content_type)


def video_file(name='clip.mp4'):
    """Not a real video - the app never inspects the bytes."""
    return SimpleUploadedFile(name, b'\x00\x00\x00\x18ftypmp42', content_type='video/mp4')


def subtitle_file(name='subtitles.vtt'):
    return SimpleUploadedFile(name, b'WEBVTT\n\n', content_type='text/vtt')


# --------------------------------------------------------------------------- #
# Users
# --------------------------------------------------------------------------- #
def make_user(user_type='student', *, email=None, password=DEFAULT_PASSWORD,
              first_name=None, last_name=None, profile=True, **extra):
    """Create a user the way the app expects (USERNAME_FIELD is email)."""
    email = email or f'{user_type}-{_uniq()}@example.com'
    first_name = first_name if first_name is not None else user_type.title()
    last_name = last_name if last_name is not None else 'Tester'
    user = User.objects.create_user(
        username=email, email=email, password=password, user_type=user_type,
        first_name=first_name, last_name=last_name, **extra,
    )
    if profile:
        if user_type == 'student':
            StudentProfile.objects.create(user=user)
        elif user_type == 'instructor':
            InstructorProfile.objects.create(user=user)
    return user


def make_student(**kw):
    return make_user('student', **kw)


def make_instructor(**kw):
    return make_user('instructor', **kw)


def make_admin(**kw):
    return make_user('admin', **kw)


def give_plus(student, *, status='active', plan='monthly', days=30):
    """Give a student a Plus subscription (active by default)."""
    now = timezone.now()
    return StudentPlusSubscription.objects.create(
        student=student,
        subscription_type=plan,
        status=status,
        start_date=now,
        end_date=now + timedelta(days=days),
        next_billing_date=now + timedelta(days=days),
        payment_method='stripe',
        last_payment_date=now,
    )


def get_subscription(student):
    return StudentPlusSubscription.objects.filter(student=student).first()


def reload(obj):
    obj.refresh_from_db()
    return obj


# --------------------------------------------------------------------------- #
# Catalogue data
# --------------------------------------------------------------------------- #
def make_category(name=None, slug=None):
    name = name or f'Category {_uniq()}'
    return Category.objects.create(name=name, slug=slug or slugify(name))


def make_language(code=None, name='English'):
    return Language.objects.create(code=code or f'l{_uniq()}'[:10], name=name)


# --------------------------------------------------------------------------- #
# Course structure
# --------------------------------------------------------------------------- #
def make_course(instructor, *, title=None, status='draft', course_type='free',
                level='beginner', category=None, description=None, **extra):
    """Create a course through the ORM.

    ``course_type`` defaults to ``free`` so that enrolling never needs a Plus
    subscription unless a test asks for ``coursera_plus``.
    """
    title = title or f'Course {_uniq()}'
    course = Course.objects.create(
        title=title,
        slug=f'{slugify(title)}-{_uuid.uuid4().hex[:6]}',
        description=description or f'Description of {title}',
        instructor=instructor,
        course_type=course_type,
        level=level,
        category=category,
        status=status,
        thumbnail=extra.pop('thumbnail', 'course_thumbnails/test-thumbnail.png'),
        **extra,
    )
    if status == 'published' and course.published_date is None:
        course.published_date = timezone.now()
        course.save(update_fields=['published_date'])
    return course


def publish(course):
    course.status = 'published'
    course.published_date = timezone.now()
    course.save()
    return course


def make_section(course, *, title=None, order=None):
    if order is None:
        order = course.sections.count() + 1
    return Section.objects.create(
        course=course, title=title or f'Section {_uniq()}', order=order,
    )


def make_lecture(section, *, content_type='video', title=None, order=None, **extra):
    if order is None:
        order = section.lectures.count() + 1
    return Lecture.objects.create(
        section=section, title=title or f'{content_type.title()} {_uniq()}',
        content_type=content_type, order=order, **extra,
    )


def make_video(section, *, title=None, video_url='https://www.youtube.com/watch?v=dQw4w9WgXcQ',
               duration=600, order=None, video_file=None):
    lecture = make_lecture(section, content_type='video', title=title, order=order)
    VideoContent.objects.create(lecture=lecture, video_url=video_url, duration=duration,
                                video_file=video_file or None)
    return lecture


def make_reading(section, *, title=None, content='<p>Reading body</p>', order=None):
    lecture = make_lecture(section, content_type='reading', title=title, order=order)
    Reading.objects.create(lecture=lecture, content=content)
    return lecture


# ---- quizzes ------------------------------------------------------------- #
def mc_question(text='Capital of France?', points=1):
    return {'type': 'multiple_choice', 'text': text, 'points': points,
            'options': [('Paris', True), ('Berlin', False), ('Madrid', False)]}


def tf_question(text='The sky is blue.', points=1):
    return {'type': 'true_false', 'text': text, 'points': points,
            'options': [('True', True), ('False', False)]}


def ms_question(text='Pick the primes.', points=1):
    return {'type': 'multiple_select', 'text': text, 'points': points,
            'options': [('2', True), ('3', True), ('4', False)]}


def fill_question(text='Fill in: 2 + 2 = ?', points=1, answers=('four', '4')):
    return {'type': 'fill_blank', 'text': text, 'points': points,
            'options': [], 'correct_answers': list(answers)}


ALL_QUESTION_TYPES = (mc_question, tf_question, ms_question, fill_question)


def make_quiz_lecture(section, *, title=None, questions=None, weight=Decimal('40'),
                      max_attempts=3, passing_score=60, order=None, time_limit=None):
    """Quiz lecture + Quiz + questions/options; returns a namespace."""
    lecture = make_lecture(section, content_type='quiz', title=title, order=order)
    quiz = Quiz.objects.create(
        course=section.course, section=section, lecture=lecture,
        title=lecture.title, passing_score=passing_score, max_attempts=max_attempts,
        weight=weight, time_limit=time_limit,
    )
    if questions is None:
        questions = [mc_question(), tf_question()]
    for q_order, spec in enumerate(questions):
        question = Question.objects.create(
            quiz=quiz, question_text=spec['text'], question_type=spec['type'],
            order=q_order, points=spec.get('points', 1),
            correct_answers=spec.get('correct_answers', []),
        )
        for o_order, (text, is_correct) in enumerate(spec.get('options', [])):
            QuestionOption.objects.create(
                question=question, option_text=text, is_correct=is_correct, order=o_order,
            )
    return SimpleNamespace(lecture=lecture, quiz=quiz)


def build_answers(quiz, correct):
    """Build the ``answers`` payload for the quiz submit endpoint.

    ``correct`` is a collection of question indexes (0-based, by order) that must
    be answered correctly; every other question receives a wrong answer.
    """
    answers = {}
    for index, question in enumerate(quiz.questions.all().order_by('order')):
        want_correct = index in set(correct)
        options = list(question.options.all().order_by('order'))
        good = [o for o in options if o.is_correct]
        bad = [o for o in options if not o.is_correct]
        qtype = question.question_type
        if qtype in ('multiple_choice', 'true_false'):
            chosen = good[0] if want_correct else bad[0]
            payload = {'selected_option': str(chosen.uuid)}
        elif qtype == 'multiple_select':
            chosen = good if want_correct else bad[:1]
            payload = {'selected_options': [str(o.uuid) for o in chosen]}
        elif qtype == 'fill_blank':
            payload = {'text_answer': question.correct_answers[0] if want_correct else 'definitely wrong'}
        else:  # pragma: no cover - essay etc. are not graded by the app
            payload = {'text_answer': 'essay'}
        answers[str(question.uuid)] = payload
    return answers


# ---- assignments ---------------------------------------------------------- #
def make_assignment_lecture(section, *, title=None, weight=Decimal('60'), max_points=100,
                            passing_score=60, due_date=None, allow_late_submission=True,
                            order=None, instructions='Do the work.'):
    lecture = make_lecture(section, content_type='assignment', title=title, order=order)
    assignment = Assignment.objects.create(
        course=section.course, section=section, lecture=lecture,
        title=lecture.title, description='Assignment description',
        instructions=instructions, max_points=max_points, passing_score=passing_score,
        weight=weight, due_date=due_date, allow_late_submission=allow_late_submission,
    )
    return SimpleNamespace(lecture=lecture, assignment=assignment)


def make_submission(assignment, student, *, text='my answer', enrollment=None, **extra):
    enrollment = enrollment or Enrollment.objects.get(course=assignment.course, student=student)
    return AssignmentSubmission.objects.create(
        assignment=assignment, student=student, enrollment=enrollment,
        submission_text=text, **extra,
    )


# ---- composite course ----------------------------------------------------- #
def build_course(instructor, *, status='published', course_type='free',
                 quiz_weight=Decimal('40'), assignment_weight=Decimal('60'),
                 quiz_questions=None, category=None, title=None, **extra):
    """A course with one section holding one lecture of every type.

    Grade weights default to 40 (quiz) + 60 (assignment) = 100.
    """
    course = make_course(instructor, status=status, course_type=course_type,
                         category=category, title=title, **extra)
    section = make_section(course, title='Week 1')
    video = make_video(section, title='Intro video')
    reading = make_reading(section, title='Reading 1')
    quiz = make_quiz_lecture(section, title='Quiz 1', weight=quiz_weight,
                             questions=quiz_questions)
    assignment = make_assignment_lecture(section, title='Assignment 1',
                                         weight=assignment_weight)
    return SimpleNamespace(
        course=course, section=section,
        video=video, reading=reading,
        quiz_lecture=quiz.lecture, quiz=quiz.quiz,
        assignment_lecture=assignment.lecture, assignment=assignment.assignment,
        lectures=[video, reading, quiz.lecture, assignment.lecture],
    )


# ---- enrolment ------------------------------------------------------------ #
def enroll(student, course, *, status='active'):
    """Create an Enrollment through the ORM (creates LectureProgress rows)."""
    if course.course_type == 'coursera_plus' and get_subscription(student) is None:
        # Enrollment.clean() demands an active Plus subscription for Plus courses
        give_plus(student)
    enrollment = Enrollment.objects.create(
        student=student, course=course, enrolled_date=timezone.now(),
    )
    if status != 'active':
        Enrollment.objects.filter(pk=enrollment.pk).update(status=status)
        enrollment.refresh_from_db()
    return enrollment


# ---- misc ----------------------------------------------------------------- #
def make_notification(user, *, notification_type='system', title='Title',
                      message='Message', is_read=False, action_url=None, age_minutes=None):
    note = Notification.objects.create(
        recipient=user, notification_type=notification_type, title=title,
        message=message, is_read=is_read, action_url=action_url,
    )
    if age_minutes is not None:  # created_at is auto_now_add -> adjust afterwards
        Notification.objects.filter(pk=note.pk).update(
            created_at=timezone.now() - timedelta(minutes=age_minutes))
        note.refresh_from_db()
    return note


def make_message(sender, recipient, content='hello'):
    return DirectMessage.objects.create(sender=sender, recipient=recipient, content=content)


def make_certificate(enrollment, *, grade=Decimal('95.50')):
    # numbers are given explicitly: Certificate.save() cannot generate them
    # (it slices the integer course id), see test_insights.
    token = _uniq()
    return Certificate.objects.create(
        enrollment=enrollment, student=enrollment.student, course=enrollment.course,
        certificate_number=f'CERT-TEST-{token}', verification_code=f'VERIFY{token}',
        completion_date=timezone.now(), final_grade=grade,
    )


def make_earning(instructor, course, *, month=None, amount=Decimal('25.00'), is_paid=False):
    month = month or timezone.now().date().replace(day=1)
    return InstructorEarning.objects.create(
        instructor=instructor, course=course, month=month, enrollments_count=2,
        completions_count=1, engagement_score=Decimal('50'),
        base_amount=amount, performance_multiplier=Decimal('1.0'),
        final_amount=amount, is_paid=is_paid,
    )


def access_token_for(user):
    """A valid JWT access token for ``user`` (library call, not app code)."""
    from rest_framework_simplejwt.tokens import RefreshToken
    return str(RefreshToken.for_user(user).access_token)


def refresh_token_for(user):
    from rest_framework_simplejwt.tokens import RefreshToken
    return str(RefreshToken.for_user(user))
