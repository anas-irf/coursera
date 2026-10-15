import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { errorMessage } from '../../../shared/api/errors';
import { saveBlob } from '../../../shared/lib/download';
import { useToast } from '../../../shared/ui/Toast';
import * as assessmentsApi from '../api';
import { assessmentKeys } from './useAssignments';

/** Open an attempt of a quiz (``mutateAsync(quizId)`` resolves with the questions and the deadline). */
export function useStartQuiz() {
  return useMutation({ mutationFn: (quizId) => assessmentsApi.startQuiz(quizId) });
}

/**
 * Hand a quiz attempt in (``mutateAsync({quizId, attemptId, answers})``).  Grades and the figures
 * built from them change, so the learner's gradebook and the home page are refreshed.
 */
export function useSubmitQuiz() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, attemptId, answers }) => assessmentsApi.submitQuiz(quizId, attemptId, answers),
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: assessmentKeys.gradebook }),
      client.invalidateQueries({ queryKey: ['insights'] }),
    ]),
  });
}

/** Hand an assignment in (``mutateAsync({assignmentId, formData})``). */
export function useSubmitAssignment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, formData }) => assessmentsApi.submitAssignment(assignmentId, formData),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: assessmentKeys.gradebook }),
      client.invalidateQueries({ queryKey: ['insights'] }),
    ]),
  });
}

/**
 * ``download(submission)``: saves the file of a hand-in (own work for a learner, a learner's for
 * the instructor) and says so when it cannot.
 */
export function useSubmissionDownload() {
  const toast = useToast();
  return useCallback(
    async (submission) => {
      try {
        const blob = await assessmentsApi.downloadSubmission(submission.id);
        saveBlob(blob, submission.original_filename || 'assignment.pdf');
      } catch (err) {
        toast.error(errorMessage(err, 'Failed to download file. Please try again.'), 'Download Failed');
      }
    },
    [toast]
  );
}
