import api from '../../shared/api/client';

// Quizzes, assignments and gradebooks are served below /courses/ for historical reasons.

// --- student -----------------------------------------------------------------
export const startQuiz = (quizId) =>
  api.post(`/courses/quizzes/${quizId}/attempt/`, { action: 'start' }).then((response) => response.data);

export const submitQuiz = (quizId, attemptId, answers) =>
  api
    .post(`/courses/quizzes/${quizId}/attempt/`, {
      action: 'submit',
      attempt_id: attemptId,
      answers,
    })
    .then((response) => response.data);

/** ``formData`` holds submission_text and/or submission_file. */
export const submitAssignment = (assignmentId, formData) =>
  api
    .post(`/courses/assignments/${assignmentId}/submit/`, formData)
    .then((response) => response.data);

/** A submission file as a Blob (students: own work, instructors: their course's). */
export const downloadSubmission = (submissionId) =>
  api
    .get(`/courses/assignments/submissions/${submissionId}/download/`, { responseType: 'blob' })
    .then((response) => response.data);

export const fetchStudentGradebook = () =>
  api.get('/courses/student/gradebook/').then((response) => response.data);

// --- instructor ---------------------------------------------------------------
export const instructorAssignments = () =>
  api.get('/courses/instructor/assignments/').then((response) => response.data);

export const assignmentSubmissions = (assignmentId) =>
  api
    .get(`/courses/instructor/assignments/${assignmentId}/submissions/`)
    .then((response) => response.data);

export const gradeSubmission = (submissionId, grade, feedback) =>
  api
    .post(`/courses/instructor/assignments/submissions/${submissionId}/grade/`, { grade, feedback })
    .then((response) => response.data);

export const courseGradebook = (courseId) =>
  api
    .get(`/courses/instructor/courses/${courseId}/gradebook/`)
    .then((response) => response.data);
