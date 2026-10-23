"""The administrator's platform page: the rules the platform runs by and its catalogue vocabulary.

The rules are settings (``backend/.env.example``), read-only here: they change with a deployment,
not with a click.  The environment block says what this instance runs on.
"""
from django.conf import settings
from django.db.models import Count, Q

from apps.core.models import Category, Language


def _database():
    engine = settings.DATABASES['default']['ENGINE']
    return 'postgresql' if 'postgresql' in engine else 'sqlite' if 'sqlite' in engine else engine


def overview():
    """Rules, categories and languages with their course counts, and what the instance runs on."""
    jwt = settings.SIMPLE_JWT
    categories = (Category.objects.annotate(
        n_courses=Count('courses', distinct=True),
        n_published=Count('courses', filter=Q(courses__status='published'), distinct=True),
    ).order_by('name'))
    languages = Language.objects.annotate(n_courses=Count('course', distinct=True)).order_by('name')
    return {
        'rules': {
            'revenue_share_percent': settings.INSTRUCTOR_REVENUE_SHARE_PERCENT,
            'course_passing_grade': settings.COURSE_PASSING_GRADE,
            'quiz_submit_grace_seconds': settings.QUIZ_SUBMIT_GRACE_SECONDS,
            'access_token_minutes': int(jwt['ACCESS_TOKEN_LIFETIME'].total_seconds() // 60),
            'refresh_token_days': jwt['REFRESH_TOKEN_LIFETIME'].days,
        },
        'categories': [
            {'id': category.id, 'name': category.name, 'slug': category.slug,
             'courses': category.n_courses, 'published': category.n_published}
            for category in categories
        ],
        'languages': [
            {'id': language.id, 'code': language.code, 'name': language.name, 'courses': language.n_courses}
            for language in languages
        ],
        'environment': {
            'demo_mode': bool(settings.DEMO_MODE),
            'debug': bool(settings.DEBUG),
            'database': _database(),
            'realtime': 'redis' if settings.REDIS_URL else 'memory',
            'stripe': bool(settings.STRIPE_SECRET_KEY),
            'api_version': 'v1',
        },
    }
