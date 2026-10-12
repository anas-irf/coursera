"""The seed_demo command (refactor step S9)."""
import io

import pytest
from django.core.management import call_command

import factories as f

pytestmark = pytest.mark.django_db


def seed(**options):
    out = io.StringIO()
    call_command('seed_demo', stdout=out, **options)
    return out.getvalue()


def counts():
    return {
        'users': f.User.objects.count(),
        'courses': f.Course.objects.count(),
        'plans': f.SubscriptionPlan.objects.count(),
        'categories': f.Category.objects.count(),
        'quizzes': f.Quiz.objects.count(),
        'assignments': f.Assignment.objects.count(),
    }


def test_seed_creates_users_plans_and_complete_courses():
    output = seed()

    assert counts() == {'users': 3, 'courses': 2, 'plans': 2, 'categories': 4,
                        'quizzes': 2, 'assignments': 2}
    assert 'Demo data is ready.' in output
    # every course is publishable: the grade weights add up to 100 and it is live
    for course in f.Course.objects.all():
        assert course.status == 'published'
        weights = (sum(q.weight for q in course.quizzes.all())
                   + sum(a.weight for a in course.assignments.all()))
        assert weights == 100
        assert course.thumbnail
        assert [lecture.content_type for lecture in
                f.Lecture.objects.filter(section__course=course).order_by('order')] == \
            ['video', 'reading', 'quiz', 'assignment']


def test_seed_is_idempotent_and_does_not_touch_existing_passwords():
    first = seed()
    before = counts()
    instructor = f.User.objects.get(email='demo.instructor@example.com')
    hash_before = instructor.password

    second = seed()

    assert counts() == before
    assert 'already exists' in second
    instructor.refresh_from_db()
    assert instructor.password == hash_before
    assert 'password' in first  # the generated passwords are printed once


def test_generated_passwords_work_and_differ_per_user():
    output = seed()

    passwords = {}
    for line in output.splitlines():
        if ': password ' in line:
            email = line.split()[1].rstrip(':')
            passwords[email] = line.split(': password ')[1].strip()
    assert len(passwords) == 3
    assert len(set(passwords.values())) == 3
    for email, password in passwords.items():
        assert f.User.objects.get(email=email).check_password(password)


def test_a_chosen_password_is_used_for_every_new_user():
    seed(password='chosen-for-the-demo')

    assert all(user.check_password('chosen-for-the-demo') for user in f.User.objects.all())


def test_demo_roles_can_use_the_platform(auth_client):
    seed()
    admin = f.User.objects.get(email='demo.admin@example.com')
    instructor = f.User.objects.get(email='demo.instructor@example.com')
    student = f.User.objects.get(email='demo.student@example.com')

    assert admin.is_admin and admin.is_staff
    assert hasattr(instructor, 'instructor_profile')
    assert hasattr(student, 'student_profile')

    course = f.Course.objects.get(slug='introduction-to-python')
    client = auth_client(student)
    assert client.post(f'/api/learning/courses/{course.uuid}/enroll/').status_code == 201
    payload = client.get(f'/api/learning/courses/{course.uuid}/learn/').json()
    assert payload['progress']['total_lectures'] == 4
    plus = f.Course.objects.get(slug='applied-machine-learning')
    assert client.post(f'/api/learning/courses/{plus.uuid}/enroll/').status_code == 402
