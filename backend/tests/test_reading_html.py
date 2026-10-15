"""Reading lectures hold HTML that every learner's browser renders, so it is cleaned when stored.

What an instructor can format stays; whatever runs does not: scripts, event handlers and
``javascript:`` links.  A cleaning command repairs what was stored before.
"""
from io import StringIO

import pytest
from django.core.management import call_command

import factories as f
from apps.core.utils import sanitize_html

pytestmark = pytest.mark.django_db

DIRTY = (
    '<p onclick="steal()">Hello <b>world</b></p>'
    '<script>alert(1)</script>'
    '<img src="x" onerror="alert(2)">'
    '<a href="javascript:alert(3)">click</a>'
    '<a href="https://example.com/doc">docs</a>'
)


def create_reading(client, section, **fields):
    return client.post(f'/api/v1/courses/instructor/sections/{section.uuid}/lectures/',
                       {'title': 'Reading', 'description': 'd', 'content_type': 'reading', **fields},
                       format='multipart')


def stored(response):
    return f.Reading.objects.get(lecture__uuid=response.json()['id']).content


def assert_clean(html):
    lowered = html.lower()
    for forbidden in ('<script', 'onclick', 'onerror', 'javascript:', 'alert('):
        assert forbidden not in lowered
    assert '<b>world</b>' in html
    assert 'href="https://example.com/doc"' in html


# --------------------------------------------------------------------------- #
# the sanitiser
# --------------------------------------------------------------------------- #
def test_formatting_stays_and_anything_that_runs_goes():
    assert_clean(sanitize_html(DIRTY))


def test_cleaning_clean_html_changes_nothing():
    once = sanitize_html(DIRTY)

    assert sanitize_html(once) == once
    assert sanitize_html('<h2>Title</h2><ul><li>one</li></ul><table><tr><td>cell</td></tr></table>') == \
        '<h2>Title</h2><ul><li>one</li></ul><table><tbody><tr><td>cell</td></tr></tbody></table>'


@pytest.mark.parametrize('empty', [None, '', 0])
def test_nothing_in_nothing_out(empty):
    assert sanitize_html(empty) == ''


# --------------------------------------------------------------------------- #
# on write
# --------------------------------------------------------------------------- #
def test_a_reading_is_cleaned_when_it_is_created(auth_client, instructor):
    section = f.make_section(f.make_course(instructor))

    r = create_reading(auth_client(instructor), section, article_content=DIRTY)

    assert r.status_code == 201
    assert_clean(stored(r))
    assert_clean(r.json()['article_content'])


def test_a_reading_is_cleaned_when_it_is_updated(auth_client, instructor):
    section = f.make_section(f.make_course(instructor))
    lecture = f.make_reading(section, content='<p>plain</p>')

    r = auth_client(instructor).put(
        f'/api/v1/courses/instructor/lectures/{lecture.uuid}/',
        {'title': lecture.title, 'content_type': 'reading', 'article_content': DIRTY}, format='multipart')

    assert r.status_code == 200
    assert_clean(f.Reading.objects.get(lecture=lecture).content)


def test_an_update_that_does_not_send_the_text_keeps_it(auth_client, instructor):
    """Only the title changed: the stored text used to be replaced by an empty one."""
    section = f.make_section(f.make_course(instructor))
    lecture = f.make_reading(section, content='<p>keep me</p>')

    r = auth_client(instructor).put(
        f'/api/v1/courses/instructor/lectures/{lecture.uuid}/',
        {'title': 'Renamed', 'content_type': 'reading'}, format='multipart')

    assert r.status_code == 200
    assert f.Reading.objects.get(lecture=lecture).content == '<p>keep me</p>'


# --------------------------------------------------------------------------- #
# what was stored before
# --------------------------------------------------------------------------- #
def run(*args):
    out = StringIO()
    call_command('clean_reading_html', *args, stdout=out)
    return out.getvalue()


def test_the_command_cleans_what_was_stored_before_and_only_once(instructor):
    section = f.make_section(f.make_course(instructor))
    dirty = f.make_reading(section, title='Old reading', content=DIRTY)
    clean = f.make_reading(section, title='Fine reading', content='<p>fine</p>')

    preview = run('--dry-run')
    assert 'would clean: Old reading' in preview and 'Fine reading' not in preview
    assert '2 readings checked, 1 would change' in preview
    assert f.Reading.objects.get(lecture=dirty).content == DIRTY

    done = run()
    assert 'cleaned: Old reading' in done and '2 readings checked, 1 changed' in done
    assert_clean(f.Reading.objects.get(lecture=dirty).content)
    assert f.Reading.objects.get(lecture=clean).content == '<p>fine</p>'

    assert '1 readings checked' not in run() and '0 changed' in run()


def test_the_learner_receives_the_clean_text(auth_client, instructor, student):
    """Whatever the route into the database, the player is given what was stored; stored text is clean."""
    course = f.make_course(instructor, status='published')
    section = f.make_section(course)
    lecture = f.make_reading(section, content=DIRTY)
    f.enroll(student, course)
    run()

    player = auth_client(student).get(f'/api/v1/learning/courses/{course.uuid}/learn/').json()

    block = [lec for lec in player['sections'][0]['lectures'] if lec['id'] == str(lecture.uuid)][0]
    assert_clean(block['content'])
