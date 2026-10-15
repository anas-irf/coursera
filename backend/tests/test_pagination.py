"""Opt-in pagination: the bare array stays, the totals travel in headers.

The unpaged answer of every list endpoint is what it has always been; a caller that sends
``page`` / ``page_size`` gets that page, and every answer says how many rows there are.
"""
import pytest

import factories as f

pytestmark = pytest.mark.django_db

CATALOGUE = '/api/v1/learning/courses/'
ENROLLED = '/api/v1/learning/enrolled/'
INSTRUCTOR_COURSES = '/api/v1/courses/instructor/courses/'
ADMIN_ALL = '/api/v1/courses/admin/all/'


@pytest.fixture
def catalogue(instructor):
    """Twenty-five published courses."""
    return [f.make_course(instructor, status='published') for _ in range(25)]


def ids(response):
    return [row['id'] for row in response.json()]


def test_the_unpaged_catalogue_keeps_its_cap_and_reports_the_total(api, catalogue):
    r = api.get(CATALOGUE)

    assert r.status_code == 200
    assert len(r.json()) == 20
    assert r['X-Total-Count'] == '25'
    assert r['Link'] == f'<{CATALOGUE}?page=2&page_size=20>; rel="next"'


def test_a_small_catalogue_has_no_next_link(api, instructor):
    f.make_course(instructor, status='published')

    r = api.get(CATALOGUE)

    assert len(r.json()) == 1
    assert r['X-Total-Count'] == '1'
    assert not r.has_header('Link')


def test_pages_of_the_catalogue_do_not_overlap_and_do_not_lose_a_course(api, catalogue):
    pages = [api.get(CATALOGUE, {'page': number, 'page_size': 10}) for number in (1, 2, 3)]

    assert [len(page.json()) for page in pages] == [10, 10, 5]
    assert len(set(ids(pages[0]) + ids(pages[1]) + ids(pages[2]))) == 25
    assert pages[0]['Link'] == f'<{CATALOGUE}?page=2&page_size=10>; rel="next"'
    assert pages[1]['Link'] == (f'<{CATALOGUE}?page=3&page_size=10>; rel="next", '
                                f'<{CATALOGUE}?page=1&page_size=10>; rel="prev"')
    assert pages[2]['Link'] == f'<{CATALOGUE}?page=2&page_size=10>; rel="prev"'
    assert {page['X-Total-Count'] for page in pages} == {'25'}


def test_paging_keeps_the_filters_of_the_request(api, instructor):
    for _ in range(3):
        f.make_course(instructor, status='published', level='advanced')
    f.make_course(instructor, status='published', level='beginner')

    r = api.get(CATALOGUE, {'level': 'advanced', 'page_size': 2})

    assert r['X-Total-Count'] == '3'
    assert len(r.json()) == 2
    assert 'level=advanced' in r['Link']


def test_a_page_past_the_end_is_empty_and_not_an_error(api, catalogue):
    r = api.get(CATALOGUE, {'page': 9})

    assert r.status_code == 200
    assert r.json() == []
    assert r['X-Total-Count'] == '25'


@pytest.mark.parametrize('params', [
    {'page': 0}, {'page': 'two'}, {'page_size': 0}, {'page_size': 101}, {'page_size': 'all'},
])
def test_paging_parameters_that_make_no_sense_are_a_400(api, catalogue, params):
    r = api.get(CATALOGUE, params)

    assert r.status_code == 400
    assert 'error' in r.json()


def test_a_list_without_a_cap_is_complete_until_a_page_is_asked_for(auth_client, instructor):
    for _ in range(23):
        f.make_course(instructor)
    client = auth_client(instructor)

    everything = client.get(INSTRUCTOR_COURSES)
    assert len(everything.json()) == 23
    assert everything['X-Total-Count'] == '23'
    assert not everything.has_header('Link')

    last = client.get(INSTRUCTOR_COURSES, {'page': 3, 'page_size': 10})
    assert len(last.json()) == 3
    assert last['Link'] == f'<{INSTRUCTOR_COURSES}?page=2&page_size=10>; rel="prev"'


def test_the_students_own_courses_report_their_total(auth_client, student, instructor):
    for _ in range(3):
        f.enroll(student, f.make_course(instructor, status='published'))

    r = auth_client(student).get(ENROLLED, {'page_size': 2})

    assert len(r.json()) == 2
    assert r['X-Total-Count'] == '3'


def test_the_admin_course_list_pages(auth_client, admin, instructor):
    for _ in range(4):
        f.make_course(instructor)

    r = auth_client(admin).get(ADMIN_ALL, {'page_size': 3, 'page': 2})

    assert len(r.json()) == 1
    assert r['X-Total-Count'] == '4'


def test_the_deprecated_alias_adds_its_link_to_the_paging_links(api, catalogue):
    r = api.get('/api/learning/courses/')

    assert r['Link'] == ('</api/learning/courses/?page=2&page_size=20>; rel="next", '
                         '</api/v1/learning/courses/>; rel="successor-version"')


def test_browsers_may_read_the_paging_headers(api, catalogue):
    r = api.get(CATALOGUE, HTTP_ORIGIN='http://localhost:3000')

    exposed = {name.strip().lower() for name in r['Access-Control-Expose-Headers'].split(',')}
    assert {'x-total-count', 'link'} <= exposed
