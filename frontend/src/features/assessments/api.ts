import api from '../../shared/api/client';
import type { UUID } from '../../shared/types';
import type {
  AssignmentRow,
  GradeResponse,
  Gradebook,
  InstructorSubmission,
  QuizAnswers,
  QuizAttempt,
  QuizSubmitResponse,
  SubmitAssignmentResponse,
} from './types';

// --- student -----------------------------------------------------------------
// A lecture without its quiz or assignment has a ``null`` id (the quiz cannot be started then:
// ``can_attempt`` is false; the hand-in form of an assignment is still offered).  The id is put
// into the path as it comes.
export const startQuiz = (quizId: UUID | null): Promise<QuizAttempt> =>
  api
    .post<QuizAttempt>(`/assessments/quizzes/${quizId}/attempt/`, { action: 'start' })
    .then((response) => response.data);

export const submitQuiz = (quizId: UUID, attemptId: UUID, answers: QuizAnswers): Promise<QuizSubmitResponse> =>
  api
    .post<QuizSubmitResponse>(`/assessments/quizzes/${quizId}/attempt/`, {
      action: 'submit',
      attempt_id: attemptId,
      answers,
    })
    .then((response) => response.data);

/** ``formData`` holds submission_text and/or submission_file. */
export const submitAssignment = (assignmentId: UUID | null, formData: FormData): Promise<SubmitAssignmentResponse> =>
  api
    .post<SubmitAssignmentResponse>(`/assessments/assignments/${assignmentId}/submit/`, formData)
    .then((response) => response.data);

/**
 * A submission file as a Blob (students: own work, instructors: their course's).  The id is
 * missing only on a learner's open hand-in, which has no file to offer.
 */
export const downloadSubmission = (submissionId: UUID | undefined): Promise<Blob> =>
  api
    .get<Blob>(`/assessments/submissions/${submissionId}/download/`, { responseType: 'blob' })
    .then((response) => response.data);

export const fetchStudentGradebook = (): Promise<Gradebook> =>
  api.get<Gradebook>('/assessments/student/gradebook/').then((response) => response.data);

// --- instructor ---------------------------------------------------------------
export const instructorAssignments = (): Promise<AssignmentRow[]> =>
  api.get<AssignmentRow[]>('/assessments/instructor/assignments/').then((response) => response.data);

export const assignmentSubmissions = (assignmentId: UUID): Promise<InstructorSubmission[]> =>
  api
    .get<InstructorSubmission[]>(`/assessments/instructor/assignments/${assignmentId}/submissions/`)
    .then((response) => response.data);

export const gradeSubmission = (submissionId: UUID, grade: number, feedback: string): Promise<GradeResponse> =>
  api
    .post<GradeResponse>(`/assessments/instructor/submissions/${submissionId}/grade/`, { grade, feedback })
    .then((response) => response.data);
