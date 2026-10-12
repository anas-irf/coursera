# seeding/management/commands/seed_demo.py
"""Fill an empty database with a small, complete demo.

Idempotent: running it again only creates what is missing.  Users get a
random password that is printed once, when the user is created (or the one
given with ``--password``); nothing is stored in the repository.

``seed_dev`` builds on this: it runs it first and adds the rest of the cast.
"""
import io
import secrets
from decimal import Decimal

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from PIL import Image

from apps.accounts.models import InstructorProfile, StudentProfile, User
from apps.assessments.models import Assignment, Question, QuestionOption, Quiz
from apps.content.models import Reading, VideoContent
from apps.core.models import Category, Language
from apps.courses.models import Course, Lecture, Section

# the slugs are the ones the Explore filter of the frontend offers
CATEGORIES = ['Programming', 'Data Science', 'Business', 'Design']
LANGUAGES = [('en', 'English'), ('es', 'Spanish')]

DEMO_USERS = [
    # (email, user_type, first_name, last_name)
    ('demo.admin@example.com', 'admin', 'Demo', 'Admin'),
    ('demo.instructor@example.com', 'instructor', 'Demo', 'Instructor'),
    ('demo.student@example.com', 'student', 'Demo', 'Student'),
]

COURSES = [
    # (title, course_type, level, category)
    ('Introduction to Python', 'free', 'beginner', 'Programming'),
    ('Applied Machine Learning', 'coursera_plus', 'intermediate', 'Data Science'),
]


class Command(BaseCommand):
    help = 'Create demo users, plans and sample courses (safe to run repeatedly)'

    def add_arguments(self, parser):
        parser.add_argument('--password', help='password of the demo users (default: random per user)')

    @transaction.atomic
    def handle(self, *args, **options):
        categories = {name: self._category(name) for name in CATEGORIES}
        language = self._languages()
        users = self._users(options.get('password'))

        call_command('create_subscription_plans', stdout=io.StringIO())
        self.stdout.write('Subscription plans: ready')

        for title, course_type, level, category in COURSES:
            self._course(users['instructor'], categories[category], language,
                         title=title, course_type=course_type, level=level)

        self.stdout.write(self.style.SUCCESS('Demo data is ready.'))

    # ------------------------------------------------------------------ users
    def _users(self, password):
        users = {}
        for email, user_type, first_name, last_name in DEMO_USERS:
            user = User.objects.filter(email=email).first()
            if user is not None:
                self.stdout.write(f'{user_type:<11} {email}: already exists (password unchanged)')
                users[user_type] = user
                continue

            secret = password or secrets.token_urlsafe(12)
            user = User.objects.create_user(
                username=email, email=email, password=secret, user_type=user_type,
                first_name=first_name, last_name=last_name, is_active=True, email_verified=True,
            )
            if user_type == 'admin':
                user.is_staff = True
                user.is_superuser = True
                user.save(update_fields=['is_staff', 'is_superuser'])
            elif user_type == 'instructor':
                InstructorProfile.objects.create(user=user)
            else:
                StudentProfile.objects.create(user=user)

            self.stdout.write(self.style.SUCCESS(f'{user_type:<11} {email}: password {secret}'))
            users[user_type] = user
        return users

    # --------------------------------------------------------------- catalogue
    def _category(self, name):
        category, _ = Category.objects.get_or_create(
            slug=slugify(name), defaults={'name': name}
        )
        return category

    def _languages(self):
        languages = [Language.objects.get_or_create(code=code, defaults={'name': name})[0]
                     for code, name in LANGUAGES]
        return languages[0]

    # ------------------------------------------------------------------ course
    def _course(self, instructor, category, language, *, title, course_type, level):
        slug = slugify(title)
        course = Course.objects.filter(slug=slug).first()
        if course is not None:
            self.stdout.write(f'Course "{title}": already exists')
            return course

        course = Course(
            title=title,
            slug=slug,
            subtitle=f'A hands-on course: {title.lower()}',
            description=f'{title} - a small sample course with a video, a reading, '
                        'a quiz and an assignment.',
            instructor=instructor,
            course_type=course_type,
            category=category,
            level=level,
            language=language,
            status='published',
            published_date=timezone.now(),
            what_you_learn=['The basics', 'How the platform works'],
            requirements=['Curiosity'],
        )
        course.thumbnail.save(f'{slug}.png', ContentFile(self._thumbnail()), save=False)
        course.save()

        section = Section.objects.create(course=course, title='Week 1', order=1,
                                         description='Getting started')

        video = Lecture.objects.create(section=section, title='Welcome', content_type='video', order=1,
                                       is_preview=True)
        VideoContent.objects.create(lecture=video, duration=300,
                                    video_url='https://www.youtube.com/watch?v=rfscVS0vtbw')

        reading = Lecture.objects.create(section=section, title='Course notes', content_type='reading',
                                         order=2)
        Reading.objects.create(lecture=reading, content='<h2>Notes</h2><p>Read this before the quiz.</p>')

        self._quiz(section, order=3)
        self._assignment(section, order=4)

        self.stdout.write(self.style.SUCCESS(f'Course "{title}": created ({course_type})'))
        return course

    def _quiz(self, section, order):
        lecture = Lecture.objects.create(section=section, title='Check your understanding',
                                         content_type='quiz', order=order)
        quiz = Quiz.objects.create(
            course=section.course, section=section, lecture=lecture, title=lecture.title,
            passing_score=60, max_attempts=3, weight=Decimal('40'),
        )
        questions = [
            ('multiple_choice', 'Which of these is a programming language?', 1,
             [('Python', True), ('Pasta', False), ('Piano', False)]),
            ('true_false', 'A quiz can be attempted more than once.', 1,
             [('True', True), ('False', False)]),
            ('multiple_select', 'Pick the even numbers.', 2,
             [('2', True), ('4', True), ('7', False)]),
        ]
        for position, (kind, text, points, options) in enumerate(questions):
            question = Question.objects.create(quiz=quiz, question_text=text, question_type=kind,
                                               order=position, points=points)
            for option_position, (option_text, correct) in enumerate(options):
                QuestionOption.objects.create(question=question, option_text=option_text,
                                              is_correct=correct, order=option_position)

    def _assignment(self, section, order):
        lecture = Lecture.objects.create(section=section, title='Write a short summary',
                                         content_type='assignment', order=order)
        Assignment.objects.create(
            course=section.course, section=section, lecture=lecture, title=lecture.title,
            description='Summarise what you learned this week.',
            instructions='Write two or three sentences, or upload a document.',
            max_points=100, passing_score=60, weight=Decimal('60'),
        )

    @staticmethod
    def _thumbnail():
        image = Image.new('RGB', (640, 360), (79, 70, 229))
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        return buffer.getvalue()
