"""Learning slice: the course player payload, lazy progress rows and lecture
completion."""
import uuid

import pytest

import factories as f

pytestmark = pytest.mark.django_db


def learn_url(course):
    return f'/api/v1/learning/courses/{course.uuid}/learn/'


def complete_url(course, lecture):
    return f'/api/v1/learning/courses/{course.uuid}/lectures/{lecture.uuid}/complete/'


LECTURE_COMMON_KEYS = {'id', 'title', 'description', 'content_type', 'order', 'is_preview',
                       'is_downloadable', 'is_completed', 'progress_seconds',
                       'last_watched_position', 'watch_count'}
# each content type adds its own block to the common keys (and nothing else)
VIDEO_KEYS = {'video_type', 'video_file_url', 'video_url', 'duration', 'thumbnail', 'subtitles'}
READING_KEYS = {'content', 'estimated_reading_time', 'file_url', 'is_downloadable'}
QUIZ_KEYS = {'quiz_id', 'max_attempts', 'passing_score', 'attempts_taken', 'best_score',
             'passed', 'can_attempt'}
ASSIGNMENT_KEYS = {'assignment_id', 'title', 'description', 'instructions', 'due_date',
                   'max_points', 'passing_score', 'allow_late_submission', 'attachment',
                   'attachment_name', 'submission'}
OPEN_SUBMISSION_KEYS = {'submitted', 'submission_date', 'is_late', 'grade', 'feedback', 'graded'}
SUBMITTED_KEYS = OPEN_SUBMISSION_KEYS | {'id', 'submission_text', 'has_file', 'file_url',
                                         'original_filename'}


@pytest.fixture
def enrolled(course_bundle, student):
    """(bundle, enrollment) for a student enrolled in the published course."""
    return course_bundle, f.enroll(student, course_bundle.course)


# --------------------------------------------------------------------------- #
# access rules
# --------------------------------------------------------------------------- #
def test_learn_requires_an_enrolment(api, auth_client, course_bundle, student, instructor):
    """Anonymous 401, not enrolled / instructor 403, unknown course 404."""
    course = course_bundle.course

    assert api.get(learn_url(course)).status_code == 401
    r = auth_client(student).get(learn_url(course))
    assert r.status_code == 403
    assert 'error' in r.json()
    assert auth_client(instructor).get(learn_url(course)).status_code == 403
    assert auth_client(student).get(f'/api/v1/learning/courses/{uuid.uuid4()}/learn/').status_code == 404


def test_learn_is_404_for_unpublished_courses(auth_client, instructor, student):
    """The player only serves published courses."""
    bundle = f.build_course(instructor, status='draft')
    f.enroll(student, bundle.course)

    assert auth_client(student).get(learn_url(bundle.course)).status_code == 404


# --------------------------------------------------------------------------- #
# payload shape
# --------------------------------------------------------------------------- #
def test_learn_payload_shape_and_per_type_blocks(auth_client, student, enrolled):
    """Top-level payload and the video / reading / quiz / assignment blocks."""
    bundle, enrollment = enrolled

    r = auth_client(student).get(learn_url(bundle.course))

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'course', 'enrollment', 'sections', 'progress'}
    assert set(body['course']) == {'id', 'title', 'description', 'instructor', 'thumbnail',
                                   'level', 'category'}
    assert body['course']['id'] == str(bundle.course.uuid)
    assert set(body['enrollment']) == {'id', 'enrolled_date', 'progress_percentage',
                                       'last_accessed', 'status'}
    assert body['enrollment']['id'] == str(enrollment.uuid)
    assert body['enrollment']['status'] == 'active'
    assert body['progress'] == {'total_lectures': 4, 'completed_lectures': 0,
                                'progress_percentage': 0}

    assert len(body['sections']) == 1
    section = body['sections'][0]
    assert set(section) == {'id', 'title', 'description', 'order', 'is_preview', 'lectures',
                            'completed_lectures', 'total_lectures'}
    lectures = {lec['content_type']: lec for lec in section['lectures']}
    assert list(lectures) == ['video', 'reading', 'quiz', 'assignment']  # ordered by `order`
    for lec in lectures.values():
        assert lec['is_completed'] is False

    assert set(lectures['video']) == LECTURE_COMMON_KEYS | VIDEO_KEYS
    assert lectures['video']['video_type'] == 'youtube'
    assert lectures['video']['subtitles'] == []

    assert set(lectures['reading']) == LECTURE_COMMON_KEYS | READING_KEYS
    assert lectures['reading']['content'] == '<p>Reading body</p>'

    quiz = lectures['quiz']
    assert set(quiz) == LECTURE_COMMON_KEYS | QUIZ_KEYS
    assert quiz['quiz_id'] == str(bundle.quiz.uuid)
    assert quiz['attempts_taken'] == 0 and quiz['can_attempt'] is True
    assert 'is_correct' not in str(quiz)

    assignment = lectures['assignment']
    assert set(assignment) == LECTURE_COMMON_KEYS | ASSIGNMENT_KEYS
    assert assignment['assignment_id'] == str(bundle.assignment.uuid)
    assert set(assignment['submission']) == OPEN_SUBMISSION_KEYS
    assert assignment['submission']['submitted'] is False
    assert assignment['submission']['graded'] is False


def test_learn_assignment_block_after_submission_and_grading(auth_client, instructor, student, enrolled):
    """A submitted / graded assignment exposes the student's submission block."""
    bundle, enrollment = enrolled
    submission = f.make_submission(bundle.assignment, student, enrollment=enrollment, text='done')
    f.AssignmentSubmission.objects.filter(pk=submission.pk).update(
        grade=88, feedback='Well done', graded_by=instructor)

    r = auth_client(student).get(learn_url(bundle.course))

    lecture = [lec for lec in r.json()['sections'][0]['lectures']
               if lec['content_type'] == 'assignment'][0]
    block = lecture['submission']
    assert set(block) == SUBMITTED_KEYS
    assert block['submitted'] is True and block['graded'] is True
    assert block['grade'] == pytest.approx(88.0)
    assert block['feedback'] == 'Well done'
    assert block['submission_text'] == 'done'
    assert block['has_file'] is False and block['file_url'] is None
    assert block['id'] == str(submission.uuid)


def test_learn_payload_for_a_locally_hosted_video(auth_client, instructor, student):
    """An uploaded video is reported as video_type "local"."""
    bundle = f.build_course(instructor, status='published')
    local = f.make_video(bundle.section, title='Local video', video_url='',
                         video_file='lectures/videos/clip.mp4')
    f.enroll(student, bundle.course)

    r = auth_client(student).get(learn_url(bundle.course))

    lectures = {lec['id']: lec for lec in r.json()['sections'][0]['lectures']}
    entry = lectures[str(local.uuid)]
    assert entry['video_type'] == 'local'
    assert entry['video_file_url']
    assert entry['video_url'] is None


def test_progress_rows_are_created_lazily_for_lectures_added_after_enrolment(auth_client, student, enrolled):
    """Opening the player creates missing LectureProgress rows."""
    bundle, enrollment = enrolled
    assert f.LectureProgress.objects.filter(enrollment=enrollment).count() == 4

    extra = f.make_reading(bundle.section, title='Added later')
    assert f.LectureProgress.objects.filter(enrollment=enrollment).count() == 4

    r = auth_client(student).get(learn_url(bundle.course))

    assert r.status_code == 200
    assert f.LectureProgress.objects.filter(enrollment=enrollment).count() == 5
    assert f.LectureProgress.objects.filter(enrollment=enrollment, lecture=extra).exists()
    assert r.json()['progress']['total_lectures'] == 5


# --------------------------------------------------------------------------- #
# completing lectures
# --------------------------------------------------------------------------- #
def test_mark_lecture_complete_updates_progress(auth_client, student, enrolled):
    """Completing lectures updates the enrolment progress percentage."""
    bundle, enrollment = enrolled
    client = auth_client(student)

    r = client.post(complete_url(bundle.course, bundle.video))

    assert r.status_code == 200
    body = r.json()
    assert body['success'] is True
    assert 'progress_percentage' in body

    progress = f.LectureProgress.objects.get(enrollment=enrollment, lecture=bundle.video)
    assert progress.is_completed is True
    assert progress.completed_date is not None
    enrollment.refresh_from_db()
    assert enrollment.progress_percentage == 25
    assert enrollment.status == 'active'
    assert enrollment.last_accessed is not None

    assert client.post(complete_url(bundle.course, bundle.reading)).status_code == 200
    enrollment.refresh_from_db()
    assert enrollment.progress_percentage == 50

    payload = client.get(learn_url(bundle.course)).json()
    assert payload['progress'] == {'total_lectures': 4, 'completed_lectures': 2,
                                   'progress_percentage': 50}
    assert payload['enrollment']['progress_percentage'] == pytest.approx(50.0)
    assert payload['sections'][0]['completed_lectures'] == 2


def test_mark_lecture_complete_is_idempotent(auth_client, student, enrolled):
    """Completing the same lecture twice changes nothing more."""
    bundle, enrollment = enrolled
    client = auth_client(student)

    first = client.post(complete_url(bundle.course, bundle.video))
    second = client.post(complete_url(bundle.course, bundle.video))

    assert first.status_code == second.status_code == 200
    enrollment.refresh_from_db()
    assert enrollment.progress_percentage == 25
    assert f.LectureProgress.objects.filter(enrollment=enrollment, is_completed=True).count() == 1
    assert f.LectureProgress.objects.filter(enrollment=enrollment).count() == 4


def test_mark_complete_response_reports_the_new_progress(auth_client, student, enrolled):
    """The response carries the progress *after* the lecture was completed (it used to
    lag one call behind the database)."""
    bundle, enrollment = enrolled
    client = auth_client(student)

    first = client.post(complete_url(bundle.course, bundle.video)).json()
    assert first['progress_percentage'] == pytest.approx(25.0)
    enrollment.refresh_from_db()
    assert enrollment.progress_percentage == 25

    second = client.post(complete_url(bundle.course, bundle.video)).json()
    assert second['progress_percentage'] == pytest.approx(25.0)


def test_completing_every_lecture_completes_the_enrollment(auth_client, student, enrolled):
    """100 % -> status completed; afterwards the player and completion answer 403."""
    bundle, enrollment = enrolled
    client = auth_client(student)

    for lecture in bundle.lectures:
        assert client.post(complete_url(bundle.course, lecture)).status_code == 200

    enrollment.refresh_from_db()
    assert enrollment.status == 'completed'
    assert enrollment.progress_percentage == 100
    assert enrollment.completed_date is not None


@pytest.mark.pinned_bug
def test_completed_enrollment_can_no_longer_open_the_player_current_behaviour(
        auth_client, student, enrolled):
    """Current behaviour (bug): the learning endpoints only accept *active*
    enrolments, so a student who finished a course can neither reopen nor
    re-complete it (403)."""
    bundle, enrollment = enrolled
    client = auth_client(student)
    for lecture in bundle.lectures:
        assert client.post(complete_url(bundle.course, lecture)).status_code == 200

    assert client.get(learn_url(bundle.course)).status_code == 403
    assert client.post(complete_url(bundle.course, bundle.video)).status_code == 403


def test_mark_complete_requires_enrolment_and_a_lecture_of_the_published_course(
        auth_client, student, instructor, course_bundle):
    """Not enrolled 403, foreign / unknown lecture 404, instructor 403."""
    other = f.build_course(instructor, status='published')
    client = auth_client(student)

    # not enrolled
    assert client.post(complete_url(course_bundle.course, course_bundle.video)).status_code == 403

    f.enroll(student, course_bundle.course)
    # lecture of a different course / unknown lecture
    assert client.post(complete_url(course_bundle.course, other.video)).status_code == 404
    assert client.post(f'/api/v1/learning/courses/{course_bundle.course.uuid}/lectures/{uuid.uuid4()}/complete/'
                       ).status_code == 404
    # instructors cannot complete lectures
    assert auth_client(instructor).post(
        complete_url(course_bundle.course, course_bundle.video)).status_code == 403


def test_a_lapsed_plus_subscription_does_not_block_completing_lectures(
        auth_client, instructor, student):
    """Plus is checked when enrolling, not on every save: a student whose subscription
    lapsed keeps their enrolments and can finish them (this used to be a 500)."""
    bundle = f.build_course(instructor, status='published', course_type='coursera_plus')
    enrollment = f.enroll(student, bundle.course)  # creates an active subscription
    subscription = f.get_subscription(student)
    subscription.status = 'cancelled'
    subscription.save()
    client = auth_client(student)

    assert client.get(learn_url(bundle.course)).status_code == 200
    r = client.post(complete_url(bundle.course, bundle.video))

    assert r.status_code == 200
    enrollment.refresh_from_db()
    assert enrollment.progress_percentage == 25


@pytest.mark.pinned_bug
def test_no_endpoint_records_watch_time_current_behaviour(auth_client, student, enrolled):
    """Current behaviour: ``progress_seconds`` / ``last_watched_position`` /
    ``watch_count`` are never written, even for completed lectures."""
    bundle, enrollment = enrolled
    client = auth_client(student)
    for lecture in bundle.lectures[:2]:
        assert client.post(complete_url(bundle.course, lecture)).status_code == 200

    payload = client.get(learn_url(bundle.course)).json()

    lectures = payload['sections'][0]['lectures']
    assert [lec['is_completed'] for lec in lectures] == [True, True, False, False]
    assert all(lec['progress_seconds'] == 0 for lec in lectures)
    assert all(lec['last_watched_position'] == 0 for lec in lectures)
    assert all(lec['watch_count'] == 0 for lec in lectures)
    assert f.LectureProgress.objects.filter(enrollment=enrollment, progress_seconds__gt=0).count() == 0
