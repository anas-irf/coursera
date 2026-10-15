/** Pure helpers of the instructor's grading screen. */

/** "Graded", "Late Submission" or "Pending Review". */
export function submissionStatus(submission) {
  if (submission.grade !== null) return { label: 'Graded', tone: 'graded' };
  if (submission.is_late) return { label: 'Late Submission', tone: 'late' };
  return { label: 'Pending Review', tone: 'pending' };
}

/** The hand-ins that match the status filter ("all", "pending", "graded", "late") and the search. */
export function visibleSubmissions(submissions, { status = 'all', search = '' } = {}) {
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
export function percentOf(grade, maxPoints) {
  if (grade === '' || grade === null || grade === undefined || !Number(maxPoints)) return '-%';
  return `${Math.round((Number(grade) / Number(maxPoints)) * 100)}%`;
}
