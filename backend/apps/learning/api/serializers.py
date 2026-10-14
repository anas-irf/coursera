"""JSON shapes of the learning endpoints (plain functions, no model serializers)."""
from apps.courses import extensions

from .. import selectors

TRUNCATE_CATALOG = 200


def _instructor_name(course):
    return f"{course.instructor.first_name} {course.instructor.last_name}"


def _hours(course):
    """Video length as the whole hours the cards display."""
    return f"{int((course.video_seconds or 0) / 3600)} hours"


def _short(text, limit):
    return text[:limit] + '...' if len(text) > limit else text


def catalog_card(course, *, student_view, has_plus):
    """One card of the explore page.

    ``student_view`` is true for authenticated students: only they get the
    "can I enroll" verdict; everybody else sees ``can_enroll`` as true.
    """
    is_enrolled = getattr(course, 'is_enrolled', False)

    can_enroll = True
    enrollment_message = ''
    if student_view:
        if is_enrolled:
            can_enroll = False
            enrollment_message = 'Already enrolled'
        elif course.course_type == 'coursera_plus' and not has_plus:
            can_enroll = False
            enrollment_message = 'Plus subscription required'

    own_progress = getattr(course, 'own_progress', None)

    return {
        'id': str(course.uuid),
        'title': course.title,
        'instructor': _instructor_name(course),
        'instructor_id': str(course.instructor.uuid),
        'thumbnail': course.thumbnail.url if course.thumbnail else None,
        'rating': float(course.average_rating),
        'students': course.total_enrolled,
        'duration': _hours(course),
        'level': course.level,
        'category': course.category.name if course.category else 'General',
        'course_type': course.course_type,
        'modules': course.module_count,
        'description': _short(course.description, TRUNCATE_CATALOG),
        'is_enrolled': is_enrolled,
        'is_bookmarked': getattr(course, 'is_bookmarked', False),
        'can_enroll': can_enroll,
        'enrollment_message': enrollment_message,
        'progress': float(own_progress) if is_enrolled and own_progress is not None else 0,
    }


def _estimated_completion(remaining_lessons, minutes_per_lesson=30):
    hours = remaining_lessons * minutes_per_lesson / 60
    if hours < 24:
        return f"{int(hours)} hours"
    if hours < 168:
        return f"{int(hours / 24)} days"
    return f"{int(hours / 168)} weeks"


def enrolled_course_row(enrollment):
    """One row of "my courses"."""
    course = enrollment.course
    total_lessons, completed_lessons = selectors.lesson_counts(enrollment)
    upcoming = selectors.next_lecture(enrollment)

    return {
        'id': str(enrollment.uuid),
        'course_id': str(course.uuid),
        'title': course.title,
        'instructor': _instructor_name(course),
        'thumbnail': course.thumbnail.url if course.thumbnail else None,
        'progress': float(enrollment.progress_percentage),
        'last_accessed': enrollment.last_accessed.isoformat() if enrollment.last_accessed else None,
        'next_lesson': upcoming.title if upcoming else 'All lessons completed',
        'total_lessons': total_lessons,
        'completed_lessons': completed_lessons,
        'estimated_completion': _estimated_completion(total_lessons - completed_lessons),
    }


def lecture_row(lecture, progress, student):
    """A lecture in the player: common fields plus whatever the content type adds."""
    row = {
        'id': str(lecture.uuid),
        'title': lecture.title,
        'description': lecture.description,
        'content_type': lecture.content_type,
        'order': lecture.order,
        'is_preview': lecture.is_preview,
        'is_downloadable': lecture.is_downloadable,
        'is_completed': progress.is_completed,
        'progress_seconds': progress.progress_seconds,
        'last_watched_position': progress.last_watched_position,
        'watch_count': progress.watch_count,
    }
    # video, reading, quiz, assignment ... are presented by the slice that owns the type
    handler = extensions.get_content_handler(lecture.content_type)
    if handler is not None:
        row.update(handler.serialize_for_student(lecture, student))
    return row


def player_payload(course, enrollment, student, outline, progress_by_lecture):
    """The whole learning interface of one course."""
    sections = []
    for section, lectures in outline:
        rows = [lecture_row(lecture, progress_by_lecture[lecture.pk], student) for lecture in lectures]
        sections.append({
            'id': str(section.uuid),
            'title': section.title,
            'description': section.description,
            'order': section.order,
            'is_preview': section.is_preview,
            'lectures': rows,
            'completed_lectures': sum(1 for row in rows if row['is_completed']),
            'total_lectures': len(rows),
        })

    total_lectures = sum(section['total_lectures'] for section in sections)
    completed_lectures = sum(section['completed_lectures'] for section in sections)
    progress_percentage = (completed_lectures / total_lectures * 100) if total_lectures > 0 else 0

    return {
        'course': {
            'id': str(course.uuid),
            'title': course.title,
            'description': course.description,
            'instructor': _instructor_name(course),
            'thumbnail': course.thumbnail.url if course.thumbnail else None,
            'level': course.level,
            'category': course.category.name if course.category else 'General',
        },
        'enrollment': {
            'id': str(enrollment.uuid),
            'enrolled_date': enrollment.enrolled_date.isoformat(),
            'progress_percentage': float(enrollment.progress_percentage),
            'last_accessed': enrollment.last_accessed.isoformat() if enrollment.last_accessed else None,
            'status': enrollment.status,
        },
        'sections': sections,
        'progress': {
            'total_lectures': total_lectures,
            'completed_lectures': completed_lectures,
            'progress_percentage': round(progress_percentage, 2),
        },
    }


def roster_entry(enrollment):
    """A student of one course, as the instructor's course page lists them."""
    student = enrollment.student
    return {
        'id': str(student.uuid),
        'name': f"{student.first_name} {student.last_name}",
        'email': student.email,
        'enrolled_date': enrollment.enrolled_date.isoformat(),
        'progress': float(enrollment.progress_percentage),
        'last_accessed': enrollment.last_accessed.isoformat() if enrollment.last_accessed else None,
        'status': enrollment.status,
    }


def student_directory(enrollments):
    """Every student of an instructor once, with their courses folded together."""
    students = {}
    for enrollment in enrollments:
        student = enrollment.student
        name = f"{student.first_name or ''} {student.last_name or ''}".strip()
        if not name:
            name = student.email.split('@')[0].title()

        entry = {
            'id': str(student.uuid),
            'name': name,
            'email': student.email,
            'avatar': f"https://ui-avatars.com/api/?name={name.replace(' ', '+')}&background=4F46E5&color=fff",
            'courses_enrolled': [enrollment.course.title],
            'progress': float(enrollment.progress_percentage),
            'last_active': enrollment.last_accessed.isoformat() if enrollment.last_accessed else None,
            'enrolled_date': enrollment.enrolled_date.isoformat(),
            'status': enrollment.status,
        }

        known = students.get(entry['id'])
        if known is None:
            students[entry['id']] = entry
            continue
        known['courses_enrolled'].extend(entry['courses_enrolled'])
        known['progress'] = (known['progress'] + entry['progress']) / 2
        if entry['last_active'] and (not known['last_active'] or entry['last_active'] > known['last_active']):
            known['last_active'] = entry['last_active']

    rows = []
    for entry in students.values():
        entry['courses_enrolled_count'] = len(entry['courses_enrolled'])
        entry['courses_enrolled'] = f"{len(entry['courses_enrolled'])} courses"
        rows.append(entry)
    return rows
