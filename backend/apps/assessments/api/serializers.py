"""JSON shapes of the assessments endpoints."""


def quiz_start_payload(attempt, quiz):
    """What the student gets when an attempt starts: the quiz without its answers."""
    questions = []
    for question in quiz.questions.all().order_by('order'):
        options = []
        if question.question_type in ('multiple_choice', 'true_false', 'multiple_select'):
            options = [
                {'id': str(option.uuid), 'text': option.option_text, 'order': option.order}
                for option in question.options.all().order_by('order')
            ]
        questions.append({
            'id': str(question.uuid),
            'text': question.question_text,
            'type': question.question_type,
            'points': question.points,
            'order': question.order,
            'options': options,
        })

    return {
        'attempt_id': str(attempt.uuid),
        'quiz': {
            'id': str(quiz.uuid),
            'title': quiz.title,
            'description': quiz.description,
            'time_limit': quiz.time_limit,
            'passing_score': quiz.passing_score,
            'show_answers': quiz.show_answers,
        },
        'questions': questions,
        'start_time': attempt.start_time.isoformat(),
    }


def submission_receipt(submission):
    """The student's confirmation after handing in."""
    return {
        'id': str(submission.uuid),
        'submitted_at': submission.submitted_at.isoformat(),
        'is_late': submission.is_late,
        'original_filename': submission.original_filename,
        'has_file': bool(submission.submission_file),
        'has_text': bool(submission.submission_text.strip()),
    }


def assignment_row(assignment):
    """One assignment of the instructor's overview (needs the selector's counters)."""
    total = assignment.submission_count
    graded = assignment.graded_count
    return {
        'id': str(assignment.uuid),
        'title': assignment.title,
        'description': assignment.description,
        'instructions': assignment.instructions,
        'max_points': assignment.max_points,
        'passing_score': assignment.passing_score,
        'due_date': assignment.due_date.isoformat() if assignment.due_date else None,
        'course_title': assignment.course.title,
        'course_id': str(assignment.course.uuid),
        'lecture_title': assignment.lecture.title if assignment.lecture else None,
        'total_submissions': total,
        'graded_submissions': graded,
        'pending_submissions': total - graded,
        'created_at': assignment.created_at.isoformat(),
    }


def submission_row(submission):
    """One submission in the instructor's grading list."""
    student = submission.student
    return {
        'id': str(submission.uuid),
        'student_id': str(student.uuid),
        'student_name': f"{student.first_name} {student.last_name}",
        'student_email': student.email,
        'submission_text': submission.submission_text,
        'has_file': bool(submission.submission_file),
        'original_filename': submission.original_filename,
        'submitted_at': submission.submitted_at.isoformat(),
        'is_late': submission.is_late,
        'grade': float(submission.grade) if submission.grade else None,
        'feedback': submission.feedback,
        'graded_by': submission.graded_by.get_full_name() if submission.graded_by else None,
        'graded_at': submission.graded_at.isoformat() if submission.graded_at else None,
    }


def graded_submission(submission):
    """The result of grading."""
    return {
        'id': str(submission.uuid),
        'grade': float(submission.grade),
        'feedback': submission.feedback,
        'graded_by': submission.graded_by.get_full_name(),
        'graded_at': submission.graded_at.isoformat(),
    }
