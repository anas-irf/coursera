"""Authoring slice: instructor course / section / lecture management and the
publish workflow (``apply_for_publish`` / ``unpublish`` / ``delete-course``).

Characterization tests: they pin today's behaviour, including quirks that are
called out as "current behaviour (bug)" in the docstrings / comments.
"""
import json
import uuid
from decimal import Decimal

import pytest
from django.utils import timezone

import factories as f

pytestmark = pytest.mark.django_db

COURSES = '/api/courses/instructor/courses/'

LECTURE_KEYS = {
    'id', 'title', 'description', 'content_type', 'order', 'is_preview',
    'is_downloadable', 'resources', 'completion_rate', 'quiz_settings',
    'questions', 'assignment_settings', 'reading_document', 'video_content',
    'article_content', 'subtitle_file', 'existing_video_name',
    'existing_subtitle_name',
}
SECTION_KEYS = {'id', 'title', 'description', 'order', 'is_preview', 'lectures',
                'total_duration'}


# --------------------------------------------------------------------------- #
# helpers (HTTP only - the data under test is created through the real API)
# --------------------------------------------------------------------------- #
def create_course(client, **overrides):
    data = {
        'title': f'API Course {uuid.uuid4().hex[:6]}',
        'subtitle': 'A subtitle',
        'description': 'A course created through the API',
        'level': 'beginner',
        'course_type': 'free',
        'estimated_hours': '4',
        'status': 'draft',
        'thumbnail': f.png_file(),
    }
    data.update(overrides)
    data.setdefault('slug', f"slug-{uuid.uuid4().hex[:8]}")
    return client.post(COURSES, data, format='multipart')


def create_section(client, course_id, title='Section'):
    return client.post(f'{COURSES}{course_id}/sections/',
                       {'title': title, 'description': 'about'}, format='json')


def create_lecture(client, section_id, **fields):
    fields.setdefault('description', 'lecture description')
    return client.post(f'/api/courses/instructor/sections/{section_id}/lectures/',
                       fields, format='multipart')


def update_lecture(client, lecture_id, **fields):
    return client.put(f'/api/courses/instructor/lectures/{lecture_id}/',
                      fields, format='multipart')


def quiz_payload(weight=40, n_questions=2):
    questions = [
        {'question_text': 'Capital of France?', 'question_type': 'multiple_choice', 'points': 2,
         'options': [{'option_text': 'Paris', 'is_correct': True},
                     {'option_text': 'Berlin', 'is_correct': False}]},
        {'question_text': 'The sky is blue.', 'question_type': 'true_false', 'points': 1,
         'options': [{'option_text': 'True', 'is_correct': True},
                     {'option_text': 'False', 'is_correct': False}]},
    ][:n_questions]
    return {
        'quiz_settings': json.dumps({'passing_score': 70, 'max_attempts': 2, 'weight': weight,
                                     'time_limit': 15, 'randomize_questions': True,
                                     'show_answers': False}),
        'questions': json.dumps(questions),
    }


def assignment_payload(weight=60, **settings_overrides):
    settings_json = {'max_points': 50, 'passing_score': 55, 'weight': weight,
                     'instructions': 'Write an essay', 'allow_late_submission': False,
                     'due_date': '2031-05-17T09:30'}
    settings_json.update(settings_overrides)
    return {'assignment_settings': json.dumps(settings_json)}


def orders(queryset):
    return list(queryset.order_by('order').values_list('order', flat=True))


# --------------------------------------------------------------------------- #
# courses
# --------------------------------------------------------------------------- #
def test_instructor_creates_course_with_thumbnail(auth_client, instructor):
    """Multipart course creation answers 201 {id, message, title} and stores the thumbnail."""
    client = auth_client(instructor)
    r = create_course(client, title='Brand New Course', slug='brand-new-course')

    assert r.status_code == 201
    body = r.json()
    assert set(body) == {'id', 'message', 'title'}
    assert body['title'] == 'Brand New Course'

    course = f.Course.objects.get(uuid=body['id'])
    assert course.instructor_id == instructor.id
    assert course.status == 'draft'
    assert course.slug == 'brand-new-course'
    assert course.thumbnail.name.startswith('course_thumbnails/')
    assert course.thumbnail.storage.exists(course.thumbnail.name)  # temp MEDIA_ROOT


def test_create_course_validation_errors(auth_client, instructor):
    """Thumbnail and slug are required, only images are accepted."""
    client = auth_client(instructor)

    # thumbnail is mandatory
    r = create_course(client, thumbnail='')
    assert r.status_code == 400
    assert 'thumbnail' in r.json()

    # only images are accepted
    r = create_course(client, thumbnail=f.txt_file('thumb.txt'))
    assert r.status_code == 400
    assert 'thumbnail' in r.json()

    # current behaviour: the slug is required by the serializer, so the view's
    # "generate slug from title" fallback can never run
    data = {'title': 'No slug', 'description': 'd', 'thumbnail': f.png_file()}
    r = client.post(COURSES, data, format='multipart')
    assert r.status_code == 400
    assert 'slug' in r.json()


def test_create_course_ignores_privileged_fields(auth_client, api, instructor):
    """``status`` / ``is_featured`` / rejection fields are read-only: a course only
    becomes visible through the moderation workflow.  (The serializer used to
    accept ``status='published'``; fixed in refactor step S4.)"""
    client = auth_client(instructor)
    r = create_course(client, title='Self published', slug='self-published',
                      status='published', is_featured='true',
                      rejection_reason='nope')

    assert r.status_code == 201
    course = f.Course.objects.get(uuid=r.json()['id'])
    assert course.status == 'draft'
    assert course.is_featured is False
    assert not course.rejection_reason
    # not in the public catalogue
    listing = api.get('/api/learning/courses/').json()
    assert str(course.uuid) not in [c['id'] for c in listing]


def test_instructor_lists_only_own_courses_with_revenue(auth_client, instructor, other_instructor):
    """The own-course list has a fixed key set including ``total_revenue``."""
    mine = f.make_course(instructor, title='Mine')
    f.make_course(other_instructor, title='Not mine')
    f.make_earning(instructor, mine, amount=Decimal('25.00'))

    r = auth_client(instructor).get(COURSES)

    assert r.status_code == 200
    rows = r.json()
    assert [row['id'] for row in rows] == [str(mine.uuid)]
    row = rows[0]
    assert set(row) == {'id', 'title', 'status', 'course_type', 'total_enrolled',
                        'average_rating', 'total_revenue', 'created_at', 'thumbnail'}
    assert row['total_revenue'] == pytest.approx(25.0)
    assert row['status'] == 'draft'


def test_course_detail_and_partial_update_for_owner(auth_client, instructor):
    """Detail returns nested sections; PATCH works with JSON and with a multipart thumbnail."""
    client = auth_client(instructor)
    course = f.make_course(instructor, title='Before')
    f.make_section(course, title='S1')

    r = client.get(f'{COURSES}{course.uuid}/')
    assert r.status_code == 200
    body = r.json()
    assert body['id'] == str(course.uuid)
    assert {'sections', 'title', 'status', 'course_type', 'level'} <= set(body)
    assert len(body['sections']) == 1

    r = client.patch(f'{COURSES}{course.uuid}/', {'title': 'After'}, format='json')
    assert r.status_code == 200
    course.refresh_from_db()
    assert course.title == 'After'

    # the frontend sends multipart when the thumbnail is replaced
    old_thumbnail = course.thumbnail.name
    r = client.patch(f'{COURSES}{course.uuid}/', {'subtitle': 'new subtitle',
                                                  'thumbnail': f.png_file('replacement.png')},
                     format='multipart')
    assert r.status_code == 200
    course.refresh_from_db()
    assert course.subtitle == 'new subtitle'
    assert course.thumbnail.name != old_thumbnail
    assert course.thumbnail.storage.exists(course.thumbnail.name)


def test_instructor_cannot_see_or_touch_another_instructors_course(auth_client, instructor, other_instructor):
    """Foreign course actions answer 404 (the section list answers an empty 200)."""
    theirs = f.make_course(other_instructor, title='Theirs')
    f.make_section(theirs)
    client = auth_client(instructor)
    base = f'{COURSES}{theirs.uuid}/'

    assert client.get(base).status_code == 404
    assert client.patch(base, {'title': 'hack'}, format='json').status_code == 404
    assert client.post(f'{base}apply_for_publish/').status_code == 404
    assert client.post(f'{base}unpublish/').status_code == 404
    assert client.get(f'{base}students/').status_code == 404
    assert client.get(f'{base}analytics/').status_code == 404
    assert create_section(client, theirs.uuid).status_code == 404
    # current behaviour: the section list is filtered, not 404'd
    r = client.get(f'{base}sections/')
    assert r.status_code == 200
    assert r.json() == []

    theirs.refresh_from_db()
    assert theirs.title == 'Theirs'


def test_delete_course_of_another_instructor_is_a_404(auth_client, instructor, other_instructor):
    """A foreign course is 404 like on every other action (it used to be a 500)."""
    theirs = f.make_course(other_instructor, title='Theirs')

    r = auth_client(instructor).post(
        f'{COURSES}{theirs.uuid}/delete-course/',
        {'confirmation': f'{instructor.email}/{theirs.title}'}, format='json')

    assert r.status_code == 404
    assert f.Course.objects.filter(pk=theirs.pk).exists()


def test_instructor_endpoints_reject_students_admins_and_anonymous(api, auth_client, student, admin, instructor):
    """Instructor endpoints: 403 for students and admins, 401 anonymous."""
    course = f.make_course(instructor)
    section = f.make_section(course)
    lecture = f.make_lecture(section)
    endpoints = [
        ('get', COURSES),
        ('post', COURSES),
        ('get', f'{COURSES}{course.uuid}/'),
        ('post', f'{COURSES}{course.uuid}/apply_for_publish/'),
        ('get', f'{COURSES}{course.uuid}/sections/'),
        ('post', f'{COURSES}{course.uuid}/sections/'),
        ('post', f'/api/courses/instructor/sections/{section.uuid}/lectures/'),
        ('put', f'/api/courses/instructor/lectures/{lecture.uuid}/'),
        ('get', '/api/insights/instructor/dashboard/'),
        ('get', '/api/assessments/instructor/assignments/'),
        ('get', f'{COURSES}students/'),
    ]
    def call(client, method, url):
        if method == 'get':
            return client.get(url)
        return getattr(client, method)(url, {}, format='json')

    for user in (student, admin):
        client = auth_client(user)
        for method, url in endpoints:
            r = call(client, method, url)
            assert r.status_code == 403, (user.user_type, method, url, r.status_code)

    for method, url in endpoints:
        r = call(api, method, url)
        assert r.status_code == 401, (method, url, r.status_code)


# --------------------------------------------------------------------------- #
# sections
# --------------------------------------------------------------------------- #
def test_create_sections_assigns_sequential_orders(auth_client, instructor):
    """New sections get orders 1, 2, 3 and the documented key set."""
    client = auth_client(instructor)
    course = f.make_course(instructor)

    created = []
    for title in ('A', 'B', 'C'):
        r = create_section(client, course.uuid, title)
        assert r.status_code == 201
        assert set(r.json()) == SECTION_KEYS
        created.append(r.json())

    assert [s['order'] for s in created] == [1, 2, 3]
    r = client.get(f'{COURSES}{course.uuid}/sections/')
    assert r.status_code == 200
    assert [s['title'] for s in r.json()] == ['A', 'B', 'C']


def test_update_and_fetch_single_section(auth_client, instructor):
    """PUT and GET of a single section."""
    client = auth_client(instructor)
    course = f.make_course(instructor)
    section = f.make_section(course, title='Old')

    r = client.put(f'/api/courses/instructor/sections/{section.uuid}/',
                   {'title': 'New', 'description': 'changed'}, format='json')
    assert r.status_code == 200
    assert r.json()['title'] == 'New'

    r = client.get(f'/api/courses/instructor/sections/{section.uuid}/')
    assert r.status_code == 200
    assert r.json()['title'] == 'New'


def test_reorder_sections(auth_client, instructor):
    """Section reorder applies the posted orders and skips unknown uuids."""
    client = auth_client(instructor)
    course = f.make_course(instructor)
    a, b, c = (f.make_section(course, title=t) for t in 'ABC')

    r = client.post(f'{COURSES}{course.uuid}/sections/reorder/', {
        'section_orders': [
            {'uuid': str(c.uuid), 'order': 1},
            {'uuid': str(a.uuid), 'order': 2},
            {'uuid': str(b.uuid), 'order': 3},
            {'uuid': str(uuid.uuid4()), 'order': 4},  # unknown uuids are skipped silently
        ]}, format='json')

    assert r.status_code == 200
    assert 'message' in r.json()
    titles = list(f.Section.objects.filter(course=course).order_by('order').values_list('title', flat=True))
    assert titles == ['C', 'A', 'B']
    assert orders(f.Section.objects.filter(course=course)) == [1, 2, 3]


def test_delete_middle_section_resequences_and_next_create_works(auth_client, instructor):
    """Deleting a middle section leaves orders 1..n and a new section gets n+1."""
    client = auth_client(instructor)
    course = f.make_course(instructor)
    a, b, c = (f.make_section(course, title=t) for t in 'ABC')

    r = client.delete(f'/api/courses/instructor/sections/{b.uuid}/')

    assert r.status_code == 204
    remaining = f.Section.objects.filter(course=course).order_by('order')
    assert [s.title for s in remaining] == ['A', 'C']
    assert orders(f.Section.objects.filter(course=course)) == [1, 2]

    r = create_section(client, course.uuid, 'D')
    assert r.status_code == 201
    assert orders(f.Section.objects.filter(course=course)) == [1, 2, 3]
    assert f.Section.objects.get(course=course, title='D').order == 3


# --------------------------------------------------------------------------- #
# lectures
# --------------------------------------------------------------------------- #
def test_create_reading_lecture_with_content_and_pdf(auth_client, instructor):
    """Reading lecture from multipart: text + PDF stored, full lecture key set."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))

    r = create_lecture(client, section.uuid, title='Reading', content_type='reading',
                       article_content='<p>Body</p>', reading_file=f.pdf_file('guide.pdf'))

    assert r.status_code == 201
    body = r.json()
    assert set(body) == LECTURE_KEYS
    assert body['article_content'] == '<p>Body</p>'
    assert body['reading_document']['file_type'] == 'pdf_file'
    assert body['reading_document']['file']
    assert body['video_content'] is None and body['quiz_settings'] is None

    reading = f.Reading.objects.get(lecture__uuid=body['id'])
    assert reading.content == '<p>Body</p>'
    assert reading.file.name.startswith('lectures/readings/')


def test_create_reading_lecture_with_markdown_and_text_only(auth_client, instructor):
    """Markdown upload and text-only reading lectures."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))

    r = create_lecture(client, section.uuid, title='MD', content_type='reading',
                       markdown_file=f.markdown_file('notes.md'))
    assert r.status_code == 201
    assert r.json()['reading_document']['file_type'] == 'markdown_file'

    r = create_lecture(client, section.uuid, title='Text', content_type='reading',
                       article_content='just text')
    assert r.status_code == 201
    assert r.json()['reading_document']['file'] is None


@pytest.mark.pinned_bug
def test_reading_with_unsupported_file_is_400_but_lecture_row_is_left_behind(auth_client, instructor):
    """Current behaviour (bug): the lecture is saved first and the file type is
    validated afterwards, so the 400 response leaves an orphan lecture behind."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))

    r = create_lecture(client, section.uuid, title='Bad file', content_type='reading',
                       reading_file=f.txt_file('notes.txt'))

    assert r.status_code == 400
    lecture = f.Lecture.objects.get(section=section, title='Bad file')
    assert not f.Reading.objects.filter(lecture=lecture).exists()


def test_create_video_lecture_with_url_and_with_file(auth_client, instructor):
    """Video lecture from a URL, and from an uploaded file with a subtitle."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))

    r = create_lecture(client, section.uuid, title='Video by url', content_type='video',
                       video_url='https://www.youtube.com/watch?v=abc123')
    assert r.status_code == 201
    body = r.json()
    assert body['video_content']['video_url'] == 'https://www.youtube.com/watch?v=abc123'
    assert body['video_content']['video_file'] is None
    video = f.VideoContent.objects.get(lecture__uuid=body['id'])
    assert video.video_url == 'https://www.youtube.com/watch?v=abc123'

    r = create_lecture(client, section.uuid, title='Video by file', content_type='video',
                       video_file=f.video_file(), subtitle_file=f.subtitle_file())
    assert r.status_code == 201
    video = f.VideoContent.objects.get(lecture__uuid=r.json()['id'])
    assert video.video_file.name.startswith('lectures/videos/')
    assert video.video_url == ''
    assert video.subtitles.count() == 1
    assert r.json()['video_content']['video_file']


def test_video_lecture_without_url_or_file_has_no_video_content_row(auth_client, instructor):
    """No URL and no file -> no VideoContent row, empty video block."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))

    r = create_lecture(client, section.uuid, title='Empty video', content_type='video')

    assert r.status_code == 201
    assert not f.VideoContent.objects.filter(lecture__uuid=r.json()['id']).exists()
    # the serializer still emits a full (empty) video block
    assert r.json()['video_content'] == {'video_url': '', 'video_file': None,
                                         'duration': 0, 'existing_video_name': None}


def test_create_quiz_lecture_from_json_strings(auth_client, instructor):
    """quiz_settings / questions JSON strings create the Quiz, Questions and Options."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))

    r = create_lecture(client, section.uuid, title='Quiz', content_type='quiz', **quiz_payload(weight=40))

    assert r.status_code == 201
    body = r.json()
    assert set(body) == LECTURE_KEYS
    assert body['quiz_settings'] == {'passing_score': 70, 'time_limit': 15, 'max_attempts': 2,
                                     'weight': 40.0, 'randomize_questions': True,
                                     'show_answers': False}
    assert [q['question_text'] for q in body['questions']] == ['Capital of France?', 'The sky is blue.']
    assert [o['is_correct'] for o in body['questions'][0]['options']] == [True, False]

    quiz = f.Quiz.objects.get(lecture__uuid=body['id'])
    assert quiz.course_id == section.course_id and quiz.section_id == section.id
    assert quiz.weight == Decimal('40')
    assert quiz.questions.count() == 2
    assert [q.order for q in quiz.questions.order_by('order')] == [0, 1]
    assert f.QuestionOption.objects.filter(question__quiz=quiz).count() == 4


@pytest.mark.pinned_bug
def test_quiz_questions_created_through_the_api_ignore_correct_answers(auth_client, instructor):
    """Current behaviour (bug): ``correct_answers`` of fill-in-the-blank questions
    is not stored by the authoring endpoint, so such questions can never be
    answered correctly by a student."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))
    questions = [{'question_text': 'Fill: 2+2', 'question_type': 'fill_blank', 'points': 1,
                  'correct_answers': ['4', 'four'], 'options': []}]

    r = create_lecture(client, section.uuid, title='Quiz', content_type='quiz',
                       quiz_settings=json.dumps({'weight': 100}), questions=json.dumps(questions))

    assert r.status_code == 201
    question = f.Question.objects.get(quiz__lecture__uuid=r.json()['id'])
    assert question.question_type == 'fill_blank'
    assert question.correct_answers == []


def test_create_assignment_lecture_with_attachment(auth_client, instructor):
    """assignment_settings JSON + attachment create the Assignment."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))

    r = create_lecture(client, section.uuid, title='Essay', content_type='assignment',
                       attachment=f.pdf_file('brief.pdf'), **assignment_payload(weight=60))

    assert r.status_code == 201
    body = r.json()
    assert set(body) == LECTURE_KEYS
    settings_block = body['assignment_settings']
    assert settings_block['max_points'] == 50
    assert settings_block['weight'] == 60.0
    assert settings_block['allow_late_submission'] is False
    assert settings_block['due_date'] == '2031-05-17T09:30'
    assert settings_block['attachment']

    assignment = f.Assignment.objects.get(lecture__uuid=body['id'])
    assert assignment.course_id == section.course_id
    assert assignment.instructions == 'Write an essay'
    assert assignment.passing_score == 55
    assert assignment.due_date is not None and timezone.is_aware(assignment.due_date)
    assert assignment.attachment.name.startswith('lectures/assignments/')


def test_lecture_serializer_key_set_is_identical_for_every_content_type(auth_client, instructor):
    """Every content type serialises to the same 18 keys; the type blocks are null / empty otherwise."""
    client = auth_client(instructor)
    course = f.make_course(instructor)
    section = f.make_section(course)
    f.make_video(section)
    f.make_reading(section)
    f.make_quiz_lecture(section)
    f.make_assignment_lecture(section)

    r = client.get(f'{COURSES}{course.uuid}/sections/')

    assert r.status_code == 200
    lectures = r.json()[0]['lectures']
    assert [lec['content_type'] for lec in lectures] == ['video', 'reading', 'quiz', 'assignment']
    for lec in lectures:
        assert set(lec) == LECTURE_KEYS

    # the per-section lecture list uses the very same serializer
    r = client.get(f'/api/courses/instructor/sections/{section.uuid}/lectures/')
    assert r.status_code == 200
    assert [lec['id'] for lec in r.json()] == [lec['id'] for lec in lectures]
    video, reading, quiz, assignment = lectures
    assert video['video_content'] is not None and video['quiz_settings'] is None
    assert reading['reading_document'] is not None and reading['video_content'] is None
    assert quiz['quiz_settings'] is not None and isinstance(quiz['questions'], list)
    assert assignment['assignment_settings'] is not None and assignment['quiz_settings'] is None


def test_section_total_duration_sums_video_durations(auth_client, instructor):
    """A section's ``total_duration`` is the sum of its video durations in seconds."""
    client = auth_client(instructor)
    course = f.make_course(instructor)
    section = f.make_section(course)
    f.make_video(section, duration=600)
    f.make_video(section, duration=900)
    f.make_reading(section)  # non video lectures do not count

    r = client.get(f'{COURSES}{course.uuid}/sections/')

    assert r.json()[0]['total_duration'] == 1500


def test_lecture_completion_rate_is_reported_to_the_instructor(auth_client, instructor, student, other_student):
    """``completion_rate`` = completed progress rows / progress rows * 100 (0 without rows)."""
    client = auth_client(instructor)
    bundle = f.build_course(instructor, status='draft')
    first = f.enroll(student, bundle.course)
    f.enroll(other_student, bundle.course)

    def rate():
        sections = client.get(f'{COURSES}{bundle.course.uuid}/sections/').json()
        return {lec['id']: lec['completion_rate'] for lec in sections[0]['lectures']}

    assert rate()[str(bundle.video.uuid)] == 0
    f.LectureProgress.objects.filter(enrollment=first, lecture=bundle.video).update(is_completed=True)

    rates = rate()
    assert rates[str(bundle.video.uuid)] == pytest.approx(50.0)
    assert rates[str(bundle.reading.uuid)] == 0


def test_update_video_lecture_video_url(auth_client, instructor):
    """PUT with a new video_url updates the VideoContent."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))
    lecture = f.make_video(section, title='Video', video_url='https://youtu.be/first')

    r = update_lecture(client, lecture.uuid, title='Video renamed', content_type='video',
                       video_url='https://youtu.be/second')

    assert r.status_code == 200
    assert r.json()['video_content']['video_url'] == 'https://youtu.be/second'
    assert f.VideoContent.objects.get(lecture=lecture).video_url == 'https://youtu.be/second'
    lecture.refresh_from_db()
    assert lecture.title == 'Video renamed'

    r = client.get(f'/api/courses/instructor/lectures/{lecture.uuid}/')
    assert r.status_code == 200
    assert r.json()['video_content']['video_url'] == 'https://youtu.be/second'


def test_update_video_lecture_creates_video_content_when_missing(auth_client, instructor):
    """PUT with a video_url creates the VideoContent when it did not exist."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))
    lecture = f.make_lecture(section, content_type='video', title='Later video')
    assert not f.VideoContent.objects.filter(lecture=lecture).exists()

    r = update_lecture(client, lecture.uuid, title='Later video', content_type='video',
                       video_url='https://youtu.be/added')

    assert r.status_code == 200
    assert f.VideoContent.objects.get(lecture=lecture).video_url == 'https://youtu.be/added'


def test_update_reading_lecture_replaces_content(auth_client, instructor):
    """PUT of a reading lecture replaces the article text."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))
    lecture = f.make_reading(section, content='old')

    r = update_lecture(client, lecture.uuid, title='Reading', content_type='reading',
                       article_content='new body')

    assert r.status_code == 200
    assert f.Reading.objects.get(lecture=lecture).content == 'new body'
    assert r.json()['article_content'] == 'new body'


@pytest.mark.pinned_bug
def test_updating_quiz_and_assignment_lectures_recreates_content_and_drops_student_data(auth_client, instructor, student):
    """Current behaviour: editing a quiz / assignment lecture deletes the Quiz /
    Assignment and creates a new one, which cascades away attempts and
    submissions of students."""
    client = auth_client(instructor)
    bundle = f.build_course(instructor, status='draft')
    enrollment = f.enroll(student, bundle.course)
    f.QuizAttempt.objects.create(student=student, quiz=bundle.quiz, enrollment=enrollment,
                                 attempt_number=1, score=Decimal('50'))
    f.make_submission(bundle.assignment, student, enrollment=enrollment)
    old_quiz_uuid, old_assignment_uuid = bundle.quiz.uuid, bundle.assignment.uuid

    r = update_lecture(client, bundle.quiz_lecture.uuid, title='Quiz 1', content_type='quiz',
                       **quiz_payload(weight=25))
    assert r.status_code == 200
    r = update_lecture(client, bundle.assignment_lecture.uuid, title='Assignment 1',
                       content_type='assignment', **assignment_payload(weight=75))
    assert r.status_code == 200

    new_quiz = f.Quiz.objects.get(lecture=bundle.quiz_lecture)
    new_assignment = f.Assignment.objects.get(lecture=bundle.assignment_lecture)
    assert new_quiz.uuid != old_quiz_uuid and new_quiz.weight == Decimal('25')
    assert new_assignment.uuid != old_assignment_uuid and new_assignment.weight == Decimal('75')
    assert f.QuizAttempt.objects.filter(student=student).count() == 0
    assert f.AssignmentSubmission.objects.filter(student=student).count() == 0


@pytest.mark.pinned_bug
def test_updating_quiz_without_quiz_fields_resets_it_to_defaults(auth_client, instructor):
    """Current behaviour: a PUT that only changes the title still re-creates the
    quiz from the request, i.e. with default settings and no questions."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))
    quiz = f.make_quiz_lecture(section, weight=Decimal('30'), max_attempts=9)

    r = update_lecture(client, quiz.lecture.uuid, title='Only the title', content_type='quiz')

    assert r.status_code == 200
    new_quiz = f.Quiz.objects.get(lecture=quiz.lecture)
    assert new_quiz.uuid != quiz.quiz.uuid
    assert new_quiz.max_attempts == 3 and new_quiz.weight == Decimal('0')
    assert new_quiz.questions.count() == 0


def test_reorder_lectures(auth_client, instructor):
    """Lecture reorder applies the posted orders."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))
    a, b, c = (f.make_lecture(section, title=t, content_type='reading') for t in 'ABC')

    r = client.post(f'/api/courses/instructor/sections/{section.uuid}/lectures/reorder/', {
        'lecture_orders': [{'uuid': str(b.uuid), 'order': 1},
                           {'uuid': str(c.uuid), 'order': 2},
                           {'uuid': str(a.uuid), 'order': 3}]}, format='json')

    assert r.status_code == 200
    titles = list(f.Lecture.objects.filter(section=section).order_by('order').values_list('title', flat=True))
    assert titles == ['B', 'C', 'A']


def test_delete_middle_lecture_resequences_and_next_create_works(auth_client, instructor):
    """Deleting a middle lecture leaves orders 1..n and a new lecture gets n+1."""
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))
    a, b, c = (f.make_lecture(section, title=t, content_type='reading') for t in 'ABC')

    r = client.delete(f'/api/courses/instructor/lectures/{b.uuid}/')

    assert r.status_code == 204
    assert [lec.title for lec in f.Lecture.objects.filter(section=section).order_by('order')] == ['A', 'C']
    assert orders(f.Lecture.objects.filter(section=section)) == [1, 2]

    r = create_lecture(client, section.uuid, title='D', content_type='reading', article_content='x')
    assert r.status_code == 201
    assert orders(f.Lecture.objects.filter(section=section)) == [1, 2, 3]
    assert f.Lecture.objects.get(section=section, title='D').order == 3


def test_reorder_quiz_questions_uses_the_internal_question_ids(auth_client, instructor, other_instructor, student):
    """Quiz question reorder is keyed by lecture uuid and internal question ids."""
    quiz = f.make_quiz_lecture(f.make_section(f.make_course(instructor)),
                               questions=[f.mc_question('First'), f.tf_question('Second')])
    first, second = quiz.quiz.questions.order_by('order')
    url = f'/api/assessments/quizzes/{quiz.lecture.uuid}/reorder-questions/'
    payload = {'question_orders': [{'id': first.id, 'order': 5}, {'id': second.id, 'order': 2},
                                   {'id': 999999, 'order': 9}]}  # unknown ids are skipped

    r = auth_client(instructor).post(url, payload, format='json')

    assert r.status_code == 200
    assert 'message' in r.json()
    first.refresh_from_db()
    second.refresh_from_db()
    assert (first.order, second.order) == (5, 2)

    assert auth_client(student).post(url, payload, format='json').status_code == 403
    # another instructor's quiz does not exist for you
    r = auth_client(other_instructor).post(url, payload, format='json')
    assert r.status_code == 404


# --------------------------------------------------------------------------- #
# published-course guard
# --------------------------------------------------------------------------- #
def test_published_course_cannot_be_restructured(auth_client, instructor):
    """Add / edit / delete of sections and lectures and course edits are 400 on a published course."""
    client = auth_client(instructor)
    bundle = f.build_course(instructor, status='published')
    course, section = bundle.course, bundle.section
    lecture = bundle.reading
    lectures_before = f.Lecture.objects.filter(section=section).count()

    r = create_section(client, course.uuid)
    assert r.status_code == 400
    assert f.Section.objects.filter(course=course).count() == 1

    r = client.put(f'/api/courses/instructor/sections/{section.uuid}/',
                   {'title': 'changed'}, format='json')
    assert r.status_code == 400
    assert 'error' in r.json()

    r = client.delete(f'/api/courses/instructor/sections/{section.uuid}/')
    assert r.status_code == 400
    assert f.Section.objects.filter(pk=section.pk).exists()

    r = create_lecture(client, section.uuid, title='New', content_type='reading', article_content='x')
    assert r.status_code == 400
    assert f.Lecture.objects.filter(section=section).count() == lectures_before

    r = update_lecture(client, lecture.uuid, title='changed', content_type='reading')
    assert r.status_code == 400
    assert 'error' in r.json()

    r = client.delete(f'/api/courses/instructor/lectures/{lecture.uuid}/')
    assert r.status_code == 400
    assert f.Lecture.objects.filter(pk=lecture.pk).exists()

    r = client.patch(f'{COURSES}{course.uuid}/', {'title': 'changed'}, format='json')
    assert r.status_code == 400
    assert 'error' in r.json()


@pytest.mark.pinned_bug
def test_reordering_is_not_guarded_on_published_courses_current_behaviour(auth_client, instructor):
    """Current behaviour: only add/edit/delete are guarded; reorder endpoints are not."""
    client = auth_client(instructor)
    course = f.make_course(instructor, status='published')
    a, b = f.make_section(course, title='A'), f.make_section(course, title='B')

    r = client.post(f'{COURSES}{course.uuid}/sections/reorder/', {
        'section_orders': [{'uuid': str(b.uuid), 'order': 1}, {'uuid': str(a.uuid), 'order': 2}]},
        format='json')

    assert r.status_code == 200
    assert f.Section.objects.get(pk=b.pk).order == 1


# --------------------------------------------------------------------------- #
# apply_for_publish / unpublish / delete
# --------------------------------------------------------------------------- #
def test_apply_for_publish_requires_a_section(auth_client, instructor):
    """No section -> 400 and the course stays a draft."""
    course = f.make_course(instructor)

    r = auth_client(instructor).post(f'{COURSES}{course.uuid}/apply_for_publish/')

    assert r.status_code == 400
    assert 'error' in r.json()
    course.refresh_from_db()
    assert course.status == 'draft'


def test_apply_for_publish_requires_grade_weights_to_sum_to_100(auth_client, instructor):
    """Weights != 100 -> 400 with current_weight and missing_weight."""
    course = f.make_course(instructor)
    section = f.make_section(course)
    f.make_quiz_lecture(section, weight=Decimal('40'))
    f.make_assignment_lecture(section, weight=Decimal('50'))

    r = auth_client(instructor).post(f'{COURSES}{course.uuid}/apply_for_publish/')

    assert r.status_code == 400
    body = r.json()
    assert body['current_weight'] == pytest.approx(90.0)
    assert body['missing_weight'] == pytest.approx(10.0)
    assert 'error' in body
    course.refresh_from_db()
    assert course.status == 'draft'


def test_apply_for_publish_full_api_journey_moves_course_to_pending_review(auth_client, instructor, admin):
    """Course + section + quiz(40) + assignment(60) via the API, then submit -> pending_review and admin notified."""
    client = auth_client(instructor)
    course_id = create_course(client).json()['id']
    section_id = create_section(client, course_id).json()['id']
    assert create_lecture(client, section_id, title='Quiz', content_type='quiz',
                          **quiz_payload(weight=40)).status_code == 201
    assert create_lecture(client, section_id, title='Essay', content_type='assignment',
                          **assignment_payload(weight=60)).status_code == 201

    r = client.post(f'{COURSES}{course_id}/apply_for_publish/')

    assert r.status_code == 200
    assert r.json()['status'] == 'pending_review'
    assert f.Course.objects.get(uuid=course_id).status == 'pending_review'
    # every admin is notified
    note = f.Notification.objects.get(recipient=admin, notification_type='course_submission')
    assert note.is_read is False
    # the pending course shows up in the instructor's own list with the new status
    rows = client.get(COURSES).json()
    assert [row['status'] for row in rows if row['id'] == course_id] == ['pending_review']


def test_apply_for_publish_is_allowed_again_after_rejection(auth_client, instructor, admin):
    """A rejected course can be resubmitted; rejection data is cleared."""
    bundle = f.build_course(instructor, status='rejected')
    course = bundle.course
    course.rejection_reason = 'Needs more content'
    course.rejection_date = timezone.now()
    course.rejected_by = admin
    course.save()

    r = auth_client(instructor).post(f'{COURSES}{course.uuid}/apply_for_publish/')

    assert r.status_code == 200
    course.refresh_from_db()
    assert course.status == 'pending_review'
    assert course.rejection_reason is None
    assert course.rejection_date is None
    assert course.rejected_by_id is None


def test_apply_for_publish_only_for_draft_or_rejected_courses(auth_client, instructor):
    """Pending and published courses cannot be (re)submitted."""
    client = auth_client(instructor)
    for status in ('pending_review', 'published'):
        bundle = f.build_course(instructor, status=status)
        r = client.post(f'{COURSES}{bundle.course.uuid}/apply_for_publish/')
        assert r.status_code == 400, status
        assert 'error' in r.json()
        bundle.course.refresh_from_db()
        assert bundle.course.status == status


def test_unpublish_published_course_returns_it_to_draft(auth_client, instructor):
    """Unpublish: published -> draft (published_date cleared); a draft is refused."""
    bundle = f.build_course(instructor, status='published')
    client = auth_client(instructor)

    r = client.post(f'{COURSES}{bundle.course.uuid}/unpublish/')

    assert r.status_code == 200
    body = r.json()
    assert body['status'] == 'draft'
    assert body['course_id'] == str(bundle.course.uuid)
    bundle.course.refresh_from_db()
    assert bundle.course.status == 'draft'
    assert bundle.course.published_date is None

    # unpublishing a draft is refused
    r = client.post(f'{COURSES}{bundle.course.uuid}/unpublish/')
    assert r.status_code == 400
    assert 'error' in r.json()


def test_delete_course_requires_exact_confirmation_string(auth_client, instructor):
    """delete-course needs the confirmation "<email>/<title>"."""
    client = auth_client(instructor)
    course = f.make_course(instructor, title='Delete me')
    f.make_section(course)
    url = f'{COURSES}{course.uuid}/delete-course/'

    r = client.post(url, {'confirmation': 'Delete me'}, format='json')
    assert r.status_code == 400
    assert 'error' in r.json()
    assert f.Course.objects.filter(pk=course.pk).exists()

    r = client.post(url, {'confirmation': f'{instructor.email}/{course.title}'}, format='json')
    assert r.status_code == 200
    assert 'message' in r.json()
    assert not f.Course.objects.filter(pk=course.pk).exists()
    assert not f.Section.objects.filter(course_id=course.pk).exists()


def test_delete_course_is_blocked_when_students_are_enrolled(auth_client, instructor, student):
    """A course with enrolments cannot be deleted through delete-course."""
    course = f.make_course(instructor, title='Busy course', status='published')
    f.enroll(student, course)

    r = auth_client(instructor).post(
        f'{COURSES}{course.uuid}/delete-course/',
        {'confirmation': f'{instructor.email}/{course.title}'}, format='json')

    assert r.status_code == 400
    assert 'error' in r.json()
    assert f.Course.objects.filter(pk=course.pk).exists()
