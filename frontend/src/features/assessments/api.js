import api from '../../shared/api/client';

// --- student -----------------------------------------------------------------
export const startQuiz = (quizId) =>
  api.post(`/assessments/quizzes/${quizId}/attempt/`, { action: 'start' }).then((response) => response.data);

export const submitQuiz = (quizId, attemptId, answers) =>
  api
    .post(`/assessments/quizzes/${quizId}/attempt/`, {
      action: 'submit',
      attempt_id: attemptId,
      answers,
    })
    .then((response) => response.data);

/** ``formData`` holds submission_text and/or submission_file. */
export const submitAssignment = (assignmentId, formData) =>
  api
    .post(`/assessments/assignments/${assignmentId}/submit/`, formData)
    .then((response) => response.data);

/** A submission file as a Blob (students: own work, instructors: their course's). */
export const downloadSubmission = (submissionId) =>
  api
    .get(`/assessments/submissions/${submissionId}/download/`, { responseType: 'blob' })
    .then((response) => response.data);

export const fetchStudentGradebook = () =>
  api.get('/assessments/student/gradebook/').then((response) => response.data);

// --- instructor ---------------------------------------------------------------
export const instructorAssignments = () =>
  api.get('/assessments/instructor/assignments/').then((response) => response.data);

export const assignmentSubmissions = (assignmentId) =>
  api
    .get(`/assessments/instructor/assignments/${assignmentId}/submissions/`)
    .then((response) => response.data);

export const gradeSubmission = (submissionId, grade, feedback) =>
  api
    .post(`/assessments/instructor/submissions/${submissionId}/grade/`, { grade, feedback })
    .then((response) => response.data);

export const courseGradebook = (courseId) =>
  api
    .get(`/assessments/instructor/courses/${courseId}/gradebook/`)
    .then((response) => response.data);
