"""The API is versioned: /api/v1/<slice>/ is canonical, /api/<slice>/ is a deprecated alias.

The aliases reach the same views, so a client written for the first release keeps
working while it is told, on every answer, where to go.  Stripe's webhook is
configured in the Stripe dashboard and is neither versioned nor deprecated.
"""
import pytest
from django.test import override_settings

pytestmark = pytest.mark.django_db


def test_the_alias_answers_like_the_versioned_path_and_says_it_is_deprecated(api):
    versioned = api.get('/api/v1/learning/courses/')
    alias = api.get('/api/learning/courses/')

    assert versioned.status_code == alias.status_code == 200
    assert versioned.json() == alias.json()
    assert 'Deprecation' not in versioned
    assert alias['Deprecation'] == 'true'
    assert alias['Link'] == '</api/v1/learning/courses/>; rel="successor-version"'
    assert 'Sunset' not in alias


def test_the_sunset_date_is_announced_when_one_is_configured(api, settings):
    settings.API_LEGACY_SUNSET = 'Thu, 31 Dec 2026 23:59:59 GMT'

    assert api.get('/api/learning/courses/')['Sunset'] == 'Thu, 31 Dec 2026 23:59:59 GMT'
    assert 'Sunset' not in api.get('/api/v1/learning/courses/')


def test_authenticated_calls_are_identical_on_both_prefixes(auth_client, student):
    client = auth_client(student)

    versioned = client.get('/api/v1/auth/profile/')
    alias = client.get('/api/auth/profile/')

    assert versioned.status_code == alias.status_code == 200
    assert versioned.json() == alias.json()
    assert alias['Deprecation'] == 'true'


def test_the_stripe_webhook_is_neither_versioned_nor_deprecated(api):
    response = api.post('/api/payments/stripe/webhook/', {}, format='json')

    assert response.status_code == 400  # an unsigned body is refused, the route is the point
    assert 'Deprecation' not in response
    assert api.post('/api/v1/payments/stripe/webhook/', {}, format='json').status_code == 404
    assert api.post('/api/billing/stripe/webhook/', {}, format='json').status_code == 404


@override_settings(ROOT_URLCONF='urls_v1_only')
def test_once_the_aliases_are_switched_off_only_the_versioned_paths_answer(api):
    assert api.get('/api/v1/learning/courses/').status_code == 200
    assert api.get('/api/learning/courses/').status_code == 404
