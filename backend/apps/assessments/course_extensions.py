"""Quiz and assignment lectures plug into the courses slice through these two handlers.

They only adapt: the rules are in ``services`` (authoring, grading), the reads in ``selectors``
and the JSON shapes in ``api.serializers``.
"""
from apps.courses.extensions import LectureContentHandler, register_content_handler

from . import selectors
from .api import serializers
from .services import authoring, quizzes


class QuizHandler(LectureContentHandler):
    """The quiz lecture: how it is authored, shown and graded."""
    content_type = 'quiz'

    def create(self, lecture, data, files):
        authoring.create_quiz(lecture, data)

    def update(self, lecture, data, files):
        authoring.update_quiz(lecture, data)

    def instructor_defaults(self):
        return {'quiz_settings': None, 'questions': []}

    def serialize_for_instructor(self, lecture):
        return serializers.instructor_quiz(selectors.quiz_of(lecture))

    def serialize_for_student(self, lecture, student):
        quiz = selectors.quiz_of(lecture)
        standing = quizzes.summary(student, quiz) if quiz is not None else None
        return serializers.student_quiz(quiz, standing)

    def grade_weight(self, course):
        return selectors.quiz_weight(course)


class AssignmentHandler(LectureContentHandler):
    """The assignment lecture: how it is authored, shown and graded."""
    content_type = 'assignment'

    def create(self, lecture, data, files):
        authoring.create_assignment(lecture, data, files)

    def update(self, lecture, data, files):
        authoring.update_assignment(lecture, data, files)

    def instructor_defaults(self):
        return {'assignment_settings': None}

    def serialize_for_instructor(self, lecture):
        return serializers.instructor_assignment(selectors.assignment_of(lecture))

    def serialize_for_student(self, lecture, student):
        assignment = selectors.assignment_of(lecture)
        submission = selectors.submission_of(student, assignment) if assignment is not None else None
        return serializers.student_assignment(assignment, submission)

    def grade_weight(self, course):
        return selectors.assignment_weight(course)


def register():
    register_content_handler(QuizHandler())
    register_content_handler(AssignmentHandler())
