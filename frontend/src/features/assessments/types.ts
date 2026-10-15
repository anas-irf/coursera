// What the assessments endpoints answer, and the two lecture blocks the player hands to this slice.
//
// Field names are the API's (snake_case): components read the wire fields directly.  Ids are uuid
// strings; money and weights are JSON numbers; times are ISO 8601 strings.
import type { ISODateTime, QuestionType, UUID } from '../../shared/types';

// --- the quiz a learner takes ---------------------------------------------------

/**
 * The quiz block of a quiz lecture in the player (``GET learning/courses/<id>/learn/``), which is
 * what ``QuizRunner`` reads of its ``lecture`` prop.  The learning slice builds the lecture it
 * hands over as ``LectureBase & QuizLecture & { content_type: 'quiz' }``: any lecture with more
 * fields than these is accepted.
 */
export interface QuizLecture {
  /** ``null`` while the lecture has no quiz yet (``can_attempt`` is then false). */
  quiz_id: UUID | null;
  max_attempts: number;
  /** A percentage. */
  passing_score: number;
  attempts_taken: number;
  /** The best score so far as a percentage, 0 before the first attempt. */
  best_score: number;
  passed: boolean;
  can_attempt: boolean;
}

export interface AttemptQuiz {
  id: UUID;
  title: string;
  description: string;
  /** Minutes; ``null`` for a quiz without a time limit. */
  time_limit: number | null;
  passing_score: number;
  show_answers: boolean;
}

export interface AttemptOption {
  id: UUID;
  text: string;
  order: number;
}

export interface AttemptQuestion {
  id: UUID;
  text: string;
  type: QuestionType;
  points: number;
  order: number;
  /** Empty for the question types that are answered with text. */
  options: AttemptOption[];
}

/** An open attempt: the quiz without its answers, and the deadline the server computed. */
export interface QuizAttempt {
  attempt_id: UUID;
  quiz: AttemptQuiz;
  questions: AttemptQuestion[];
  start_time: ISODateTime;
  /** ``null`` for a quiz without a time limit. */
  expires_at: ISODateTime | null;
}

/** One answer: the chosen option, the chosen options, or the typed text. */
export type QuizAnswer =
  | { selected_option: UUID }
  | { selected_options: UUID[] }
  | { text_answer: string };

/** The answers of an attempt as they are sent: keyed by question id. */
export type QuizAnswers = Record<UUID, QuizAnswer>;

export interface QuizResults {
  /** This attempt, as a percentage. */
  score: number;
  best_score: number;
  earned_points: number;
  total_points: number;
  /** Whether the quiz is passed (by this attempt or an earlier one). */
  passed: boolean;
  current_attempt_passed: boolean;
  passing_score: number;
  attempt_number: number;
  attempts_remaining: number;
}

/** The answer to handing an attempt in. */
export interface QuizSubmitResponse {
  success: boolean;
  results: QuizResults;
}

// --- the assignment a learner hands in ------------------------------------------

/**
 * The learner's own hand-in as the player shows it: an open one has the first six fields only,
 * a handed-in one (``submitted``) has all of them.
 */
export interface StudentSubmission {
  submitted: boolean;
  submission_date: ISODateTime | null;
  is_late: boolean;
  grade: number | null;
  feedback: string;
  /** True once the instructor graded it; a grade of 0 is a grade. */
  graded: boolean;
  id?: UUID;
  submission_text?: string;
  has_file?: boolean;
  file_url?: string | null;
  original_filename?: string | null;
}

/**
 * The assignment block of an assignment lecture in the player, which is what ``AssignmentPanel``
 * reads of its ``lecture`` prop (``title`` and ``description`` are the assignment's own: the
 * server puts them into the block).  The learning slice builds the lecture it hands over as
 * ``LectureBase & AssignmentLecture & { content_type: 'assignment' }``: any lecture with more
 * fields than these is accepted.
 */
export interface AssignmentLecture {
  /** ``null`` while the lecture has no assignment yet. */
  assignment_id: UUID | null;
  title: string;
  description: string;
  instructions: string;
  due_date: ISODateTime | null;
  max_points: number;
  /** A percentage. */
  passing_score: number;
  allow_late_submission: boolean;
  /** A media path of the materials the instructor attached. */
  attachment: string | null;
  attachment_name: string | null;
  submission: StudentSubmission;
}

/** The confirmation of a hand-in (not the whole ``StudentSubmission``). */
export interface SubmissionReceipt {
  id: UUID;
  submitted_at: ISODateTime;
  is_late: boolean;
  original_filename: string;
  has_file: boolean;
  has_text: boolean;
}

export interface SubmitAssignmentResponse {
  success: boolean;
  message: string;
  submission: SubmissionReceipt;
}

// --- the instructor's grading screen --------------------------------------------

/** One assignment of the instructor's courses with the counters of its hand-ins. */
export interface AssignmentRow {
  id: UUID;
  title: string;
  description: string;
  instructions: string;
  max_points: number;
  passing_score: number;
  due_date: ISODateTime | null;
  course_title: string;
  course_id: UUID;
  lecture_title: string | null;
  total_submissions: number;
  graded_submissions: number;
  pending_submissions: number;
  created_at: ISODateTime;
}

/** One hand-in as the instructor sees it. */
export interface InstructorSubmission {
  id: UUID;
  student_id: UUID;
  student_name: string;
  student_email: string;
  submission_text: string;
  has_file: boolean;
  /** Empty when there is no file. */
  original_filename: string;
  submitted_at: ISODateTime;
  is_late: boolean;
  /** ``null`` until graded; 0 is a grade. */
  grade: number | null;
  feedback: string;
  /** The grader's name. */
  graded_by: string | null;
  graded_at: ISODateTime | null;
}

export interface GradedSubmission {
  id: UUID;
  grade: number;
  feedback: string;
  graded_by: string;
  graded_at: ISODateTime;
}

/** The answer to grading a hand-in. */
export interface GradeResponse {
  message: string;
  submission: GradedSubmission;
}

// --- the learner's gradebook ----------------------------------------------------

export interface GradeComponent {
  type: 'assignments' | 'quizzes';
  /** A percentage. */
  score: number;
  weight: number;
  completed: number;
  total: number;
}

export interface GradebookCourse {
  course_id: UUID;
  course_title: string;
  instructor: string;
  enrollment_date: ISODateTime;
  progress_percentage: number;
  /** A percentage. */
  final_grade: number;
  letter_grade: string;
  is_passing: boolean;
  total_weight: number;
  components: GradeComponent[];
}

export interface Gradebook {
  student: { id: UUID; name: string; email: string };
  courses: GradebookCourse[];
}
