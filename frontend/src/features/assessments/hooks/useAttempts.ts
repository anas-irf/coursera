import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { errorMessage } from '../../../shared/api/errors';
import { saveBlob } from '../../../shared/lib/download';
import type { UUID } from '../../../shared/types';
import { useToast } from '../../../shared/ui/Toast';
import * as assessmentsApi from '../api';
import type { QuizAnswers } from '../types';
import { assessmentKeys } from './useAssignments';

/**
 * Open an attempt of a quiz (``mutateAsync(quizId)`` resolves with the questions and the deadline).
 * The id is ``null`` for a quiz lecture that has no quiz yet, which the screen does not offer to start.
 */
export function useStartQuiz() {
  return useMutation({ mutationFn: (quizId: UUID | null) => assessmentsApi.startQuiz(quizId) });
}

interface SubmitQuizVariables {
  quizId: UUID;
  attemptId: UUID;
  answers: QuizAnswers;
}

/**
 * Hand a quiz attempt in (``mutateAsync({quizId, attemptId, answers})``).  Grades and the figures
 * built from them change, so the learner's gradebook and the home page are refreshed.
 */
export function useSubmitQuiz() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, attemptId, answers }: SubmitQuizVariables) =>
      assessmentsApi.submitQuiz(quizId, attemptId, answers),
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: assessmentKeys.gradebook }),
      client.invalidateQueries({ queryKey: ['insights'] }),
    ]),
  });
}

interface SubmitAssignmentVariables {
  /** ``null`` for an assignment lecture that has no assignment yet. */
  assignmentId: UUID | null;
  formData: FormData;
}

/** Hand an assignment in (``mutateAsync({assignmentId, formData})``). */
export function useSubmitAssignment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, formData }: SubmitAssignmentVariables) =>
      assessmentsApi.submitAssignment(assignmentId, formData),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: assessmentKeys.gradebook }),
      client.invalidateQueries({ queryKey: ['insights'] }),
    ]),
  });
}

/**
 * What a download needs of a hand-in: the learner's own (it has an ``id`` once handed in) or a
 * row of the instructor's list.
 */
export interface SubmissionFile {
  id?: UUID;
  original_filename?: string | null;
}

/**
 * ``download(submission)``: saves the file of a hand-in (own work for a learner, a learner's for
 * the instructor) and says so when it cannot.
 */
export function useSubmissionDownload() {
  const toast = useToast();
  return useCallback(
    async (submission: SubmissionFile): Promise<void> => {
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
