import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as learningApi from '../api';
import { withWatchResult } from '../lib/player';
import { learningKeys } from './useLearning';

/**
 * The learning interface of one course.  It is always fetched fresh when the player opens: the
 * outline shows what the student has done, and that changes while they work.
 */
export function usePlayer(courseId) {
  return useQuery({
    queryKey: learningKeys.player(courseId),
    queryFn: () => learningApi.fetchPlayer(courseId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** What a finished lecture, quiz or hand-in changes: the outline, my courses and the figures. */
export function useRefreshProgress(courseId) {
  const client = useQueryClient();
  return useCallback(
    () => Promise.all([
      client.invalidateQueries({ queryKey: learningKeys.player(courseId) }),
      client.invalidateQueries({ queryKey: ['learning', 'mine'] }),
      client.invalidateQueries({ queryKey: ['insights'] }),
    ]),
    [client, courseId]
  );
}

/** Mark a video or reading lecture complete (``mutate(lectureId)``). */
export function useCompleteLecture(courseId) {
  const refresh = useRefreshProgress(courseId);
  return useMutation({
    mutationFn: (lectureId) => learningApi.completeLecture(courseId, lectureId),
    onSuccess: refresh,
  });
}

/**
 * ``report(position, {finished})``: tells the server where the student is in a video.
 *
 * It is best effort: a heartbeat that fails is not worth interrupting a lecture for, the next one
 * reports the position again.  The answer is folded into the cached outline so a lecture the
 * student comes back to resumes from the newest position without another request.
 */
export function useWatchReporter({ courseId, lectureId }) {
  const client = useQueryClient();
  return useCallback(
    async (position, { finished = false } = {}) => {
      if (!Number.isFinite(position) || position < 0) return;
      try {
        const result = await learningApi.recordWatchProgress(courseId, lectureId, {
          position: Math.floor(position),
          finished,
        });
        client.setQueryData(learningKeys.player(courseId), (data) => withWatchResult(data, lectureId, result));
      } catch (error) {
        // reported again by the next heartbeat
      }
    },
    [client, courseId, lectureId]
  );
}
