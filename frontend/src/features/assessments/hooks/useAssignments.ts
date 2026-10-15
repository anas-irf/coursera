import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UUID } from '../../../shared/types';
import * as assessmentsApi from '../api';

/** Query keys of the assessments feature (``['assessments', resource, params]``). */
export const assessmentKeys = {
  all: ['assessments'] as const,
  assignments: ['assessments', 'assignments'] as const,
  submissions: (assignmentId: UUID | null) => ['assessments', 'submissions', assignmentId] as const,
  gradebook: ['assessments', 'gradebook'] as const,
};

/** The assignments of the instructor's courses with their counters. */
export function useInstructorAssignments() {
  return useQuery({
    queryKey: assessmentKeys.assignments,
    queryFn: assessmentsApi.instructorAssignments,
  });
}

/** The hand-ins of one assignment; nothing is fetched until one is chosen. */
export function useAssignmentSubmissions(assignmentId: UUID | null) {
  return useQuery({
    queryKey: assessmentKeys.submissions(assignmentId),
    queryFn: assignmentId ? () => assessmentsApi.assignmentSubmissions(assignmentId) : skipToken,
  });
}

interface GradeVariables {
  submissionId: UUID;
  grade: number;
  feedback: string;
}

/**
 * Grade a hand-in (``mutate({submissionId, grade, feedback})``).  The counters of the assignment
 * list, the learner's gradebook and the figures built from grades are refreshed afterwards.
 */
export function useGradeSubmission(assignmentId: UUID) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, grade, feedback }: GradeVariables) =>
      assessmentsApi.gradeSubmission(submissionId, grade, feedback),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: assessmentKeys.submissions(assignmentId) }),
      client.invalidateQueries({ queryKey: assessmentKeys.assignments }),
      client.invalidateQueries({ queryKey: assessmentKeys.gradebook }),
      client.invalidateQueries({ queryKey: ['insights'] }),
    ]),
  });
}

/** The learner's gradebook: every course with its weighted grade. */
export function useGradebook() {
  return useQuery({ queryKey: assessmentKeys.gradebook, queryFn: assessmentsApi.fetchStudentGradebook });
}
