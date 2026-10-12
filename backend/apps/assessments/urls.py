# assessments/urls.py - mounted at /api/assessments/
from django.urls import path

from .api import instructor, student

app_name = 'assessments'

urlpatterns = [
    # student
    path('quizzes/<uuid:quiz_uuid>/attempt/', student.attempt_quiz, name='attempt-quiz'),
    path('assignments/<uuid:assignment_uuid>/submit/', student.submit_assignment, name='submit-assignment'),
    path('submissions/<uuid:submission_uuid>/download/', student.download_submission_file,
         name='download-submission-file'),
    path('student/gradebook/', student.student_gradebook, name='student-gradebook'),

    # instructor
    path('quizzes/<uuid:lecture_uuid>/reorder-questions/', instructor.reorder_quiz_questions,
         name='quiz-reorder-questions'),
    path('instructor/assignments/', instructor.instructor_assignments, name='instructor-assignments'),
    path('instructor/assignments/<uuid:assignment_uuid>/submissions/',
         instructor.instructor_assignment_submissions, name='instructor-assignment-submissions'),
    path('instructor/submissions/<uuid:submission_uuid>/grade/',
         instructor.grade_assignment_submission, name='grade-assignment-submission'),
    path('instructor/courses/<uuid:course_uuid>/gradebook/', instructor.instructor_course_gradebook,
         name='instructor-course-gradebook'),
]
