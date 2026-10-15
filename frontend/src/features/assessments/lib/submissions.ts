import type { InstructorSubmission } from '../types';

/** Pure helpers of the instructor's grading screen. */

/** The tone a status is drawn in. */
export type SubmissionTone = 'graded' | 'late' | 'pending';

export interface SubmissionStatus {
  label: 'Graded' | 'Late Submission' | 'Pending Review';
  tone: SubmissionTone;
}

/** What a status needs of a hand-in. */
type StatusSource = Pick<InstructorSubmission, 'grade' | 'is_late'>;

/** "Graded", "Late Submission" or "Pending Review". */
export function submissionStatus(submission: StatusSource): SubmissionStatus {
  if (submission.grade !== null) return { label: 'Graded', tone: 'graded' };
  if (submission.is_late) return { label: 'Late Submission', tone: 'late' };
  return { label: 'Pending Review', tone: 'pending' };
}

/** The filter of the hand-in list. */
export type SubmissionFilter = 'all' | 'pending' | 'graded' | 'late';

/** Narrows the value of the status ``<select>`` (a string) to the filter it stands for. */
export function isSubmissionFilter(value: string): value is SubmissionFilter {
  return value === 'all' || value === 'pending' || value === 'graded' || value === 'late';
}

export interface SubmissionFilters {
  status?: SubmissionFilter;
  search?: string;
}

/** The hand-ins that match the status filter ("all", "pending", "graded", "late") and the search. */
export function visibleSubmissions<T extends StatusSource & Pick<InstructorSubmission, 'student_name'>>(
  submissions: T[],
  { status = 'all', search = '' }: SubmissionFilters = {}
): T[] {
  const term = search.trim().toLowerCase();

  return submissions.filter((submission) => {
    const matchesStatus =
      status === 'all' ||
      (status === 'graded' && submission.grade !== null) ||
      (status === 'pending' && submission.grade === null) ||
      (status === 'late' && submission.is_late);

    return matchesStatus && (!term || submission.student_name.toLowerCase().includes(term));
  });
}

/** The grade as a percentage of the points, "-%" while there is none. */
export function percentOf(grade: string | number | null | undefined, maxPoints: number): string {
  if (grade === '' || grade === null || grade === undefined || !Number(maxPoints)) return '-%';
  return `${Math.round((Number(grade) / Number(maxPoints)) * 100)}%`;
}
