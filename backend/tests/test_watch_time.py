"""Watch time: the player's heartbeat, resuming, and what it feeds (hours, streak, chart).

The heartbeat is ``POST /learning/courses/<c>/lectures/<l>/progress/`` with
``{"position": seconds, "finished": bool}``.  What it credits is bounded by the distance the
position moved, the real time since the previous heartbeat and a per-beat cap, so the tests
age the progress row to simulate the time passing.
"""
import uuid
from datetime import timedelta

import pytest
from django.utils import timezone

import factories as f

pytestmark = pytest.mark.django_db

STATS = '/api/v1/insights/student/stats/'
WEEKLY = '/api/v1/insights/student/weekly-progress/'


def beat_url(course, lecture):
    return f'/api/v1/learning/courses/{course.uuid}/lectures/{lecture.uuid}/progress/'


def learn_url(course):
    return f'/api/v1/learning/courses/{course.uuid}/learn/'


def beat(client, bundle, position, lecture=None, **extra):
    return client.post(beat_url(bundle.course, lecture or bundle.video),
                       {'position': position, **extra}, format='json')


def seconds_pass(enrollment, lecture, seconds):
    """Make the previous heartbeat of the lecture ``seconds`` old."""
    f.LectureProgress.objects.filter(enrollment=enrollment, lecture=lecture).update(
        updated_at=timezone.now() - timedelta(seconds=seconds))


@pytest.fixture
def watching(instructor, student):
    """A course with a 10 minute uploaded video, the student enrolled."""
    bundle = f.build_course(instructor, status='published')
    f.VideoContent.objects.filter(lecture=bundle.video).update(duration=600)
    return bundle, f.enroll(student, bundle.course)


# --------------------------------------------------------------------------- #
# the heartbeat
# --------------------------------------------------------------------------- #
def test_a_heartbeat_remembers_the_position_and_the_player_resumes_from_it(
        auth_client, student, watching):
    bundle, enrollment = watching
    client = auth_client(student)

    r = beat(client, bundle, 42)

    assert r.status_code == 200
    assert r.json()['last_watched_position'] == 42
    assert r.json()['progress_seconds'] == 42
    lecture = client.get(learn_url(bundle.course)).json()['sections'][0]['lectures'][0]
    assert lecture['last_watched_position'] == 42
    assert lecture['progress_seconds'] == 42


def test_the_furthest_point_is_kept_when_the_student_rewinds(auth_client, student, watching):
    bundle, _ = watching
    client = auth_client(student)

    beat(client, bundle, 300)
    r = beat(client, bundle, 20)

    assert r.json()['last_watched_position'] == 20
    assert r.json()['progress_seconds'] == 300


def test_the_time_watched_is_credited_but_never_more_than_has_passed(
        auth_client, student, watching):
    bundle, enrollment = watching
    client = auth_client(student)

    seconds_pass(enrollment, bundle.video, 15)
    assert beat(client, bundle, 15).json()['total_time_spent'] == 15

    # the next beat arrives at once: no time has passed, so nothing more is credited
    assert beat(client, bundle, 30).json()['total_time_spent'] == 15

    seconds_pass(enrollment, bundle.video, 10)
    assert beat(client, bundle, 40).json()['total_time_spent'] == 25


def test_a_client_cannot_inflate_its_hours(auth_client, student, watching):
    bundle, enrollment = watching
    client = auth_client(student)

    seconds_pass(enrollment, bundle.video, 3600)
    r = beat(client, bundle, 590)           # an hour passed and the position jumped 590 s

    assert r.json()['total_time_spent'] == 60   # one heartbeat credits at most a minute


def test_finishing_a_video_counts_a_watch_and_starts_over_next_time(auth_client, student, watching):
    bundle, _ = watching
    client = auth_client(student)

    r = beat(client, bundle, 600, finished=True)

    body = r.json()
    assert body['watch_count'] == 1
    assert body['last_watched_position'] == 0
    assert body['progress_seconds'] == 600


def test_a_position_beyond_the_end_of_the_video_is_clamped(auth_client, student, watching):
    bundle, _ = watching

    r = beat(auth_client(student), bundle, 99999)

    assert r.json()['progress_seconds'] == 600


@pytest.mark.parametrize('position', [None, -1, 'ten', True, [5]])
def test_a_position_that_is_not_a_number_of_seconds_is_a_400(auth_client, student, watching, position):
    bundle, _ = watching

    r = beat(auth_client(student), bundle, position)

    assert r.status_code == 400
    assert 'position' in r.json()['error']


def test_only_videos_have_watch_time(auth_client, student, watching):
    bundle, _ = watching

    r = beat(auth_client(student), bundle, 10, lecture=bundle.reading)

    assert r.status_code == 400
    assert r.json() == {'error': 'Watch time is only recorded for video lectures'}


def test_who_may_send_a_heartbeat(api, auth_client, student, instructor, watching):
    bundle, _ = watching

    assert api.post(beat_url(bundle.course, bundle.video), {'position': 1}, format='json').status_code == 401
    assert beat(auth_client(instructor), bundle, 1).status_code == 403
    assert beat(auth_client(f.make_student()), bundle, 1).status_code == 403       # not enrolled
    assert auth_client(student).post(
        f'/api/v1/learning/courses/{bundle.course.uuid}/lectures/{uuid.uuid4()}/progress/',
        {'position': 1}, format='json').status_code == 404


def test_a_finished_course_can_still_be_watched(auth_client, instructor, student):
    bundle = f.build_course(instructor, status='published')
    f.enroll(student, bundle.course, status='completed')

    assert beat(auth_client(student), bundle, 5).status_code == 200


# --------------------------------------------------------------------------- #
# what it feeds
# --------------------------------------------------------------------------- #
def test_watching_shows_up_in_the_hours_the_streak_and_the_chart(auth_client, student, watching):
    bundle, enrollment = watching
    client = auth_client(student)
    assert client.get(STATS).json()['learning_streak'] == 0
    assert client.get(STATS).json()['total_learning_hours'] == 0

    seconds_pass(enrollment, bundle.video, 60)
    beat(client, bundle, 60)

    stats = client.get(STATS).json()
    assert stats['learning_streak'] == 1
    assert stats['total_learning_hours'] == pytest.approx(60 / 3600, abs=0.01)
    *_, this_month = client.get(WEEKLY).json()['monthly_progress']
    assert this_month['hours'] == pytest.approx(60 / 3600, abs=0.1)

    profile = f.reload(f.StudentProfile.objects.get(user=student))
    assert profile.learning_streak == 1
    assert profile.last_learning_date == timezone.localdate()


def test_a_completed_lecture_counts_as_a_day_of_learning(auth_client, student, watching):
    bundle, _ = watching
    client = auth_client(student)

    client.post(f'/api/v1/learning/courses/{bundle.course.uuid}/lectures/{bundle.reading.uuid}/complete/')

    assert client.get(STATS).json()['learning_streak'] == 1


def test_the_same_day_is_one_row_per_student(auth_client, instructor, student, other_student):
    """The date used to be unique across *all* students: a second one could not log a day."""
    bundle = f.build_course(instructor, status='published')
    for learner in (student, other_student):
        f.enroll(learner, bundle.course)
        assert auth_client(learner).post(
            f'/api/v1/learning/courses/{bundle.course.uuid}/lectures/{bundle.reading.uuid}/complete/'
        ).status_code == 200

    assert f.LearningStreak.objects.filter(streak_date=timezone.localdate()).count() == 2
