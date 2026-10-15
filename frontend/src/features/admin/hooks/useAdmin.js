import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as adminApi from '../api';

/**
 * Query keys of the admin area (``['admin', resource]``).  The approval queue, the badge in the
 * sidebar and the overview all read ``pending`` / ``courses``, and approving or rejecting a
 * course invalidates the whole ``['admin']`` prefix, so none of them can disagree.
 */
export const adminKeys = {
  all: ['admin'],
  pending: ['admin', 'pending'],
  courses: ['admin', 'courses'],
  users: ['admin', 'users'],
};

const QUEUE_REFRESH_MS = 60 * 1000;

/** The courses waiting for a decision. */
export function usePendingCourses() {
  return useQuery({ queryKey: adminKeys.pending, queryFn: adminApi.pendingCourses });
}

/**
 * How many courses wait for a decision (the sidebar badge).  It reads the same cache entry as
 * the approval queue, so the queue is downloaded once, and it is looked at again every minute
 * because instructors submit courses at any time.
 */
export function usePendingCount() {
  const query = useQuery({
    queryKey: adminKeys.pending,
    queryFn: adminApi.pendingCourses,
    select: (rows) => rows.length,
    refetchInterval: QUEUE_REFRESH_MS,
  });
  return query.isSuccess ? query.data : 0;
}

export function useAdminCourses() {
  return useQuery({ queryKey: adminKeys.courses, queryFn: adminApi.allCourses });
}

export function useAdminUsers() {
  return useQuery({ queryKey: adminKeys.users, queryFn: adminApi.users });
}

function useDecision(call) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: (_, variables) => {
      // the course leaves the queue at once; everything that counts it is refreshed
      client.setQueryData(adminKeys.pending, (rows) =>
        rows ? rows.filter((course) => course.id !== variables.courseId) : rows
      );
      return Promise.all([
        client.invalidateQueries({ queryKey: adminKeys.all }),
        client.invalidateQueries({ queryKey: ['courses', 'mine'] }),
      ]);
    },
  });
}

/** ``mutate({courseId})``: publish a course that waits for review. */
export function useApproveCourse() {
  return useDecision(({ courseId }) => adminApi.approveCourse(courseId));
}

/** ``mutate({courseId, reason})``: send a course back to its instructor with a reason. */
export function useRejectCourse() {
  return useDecision(({ courseId, reason }) => adminApi.rejectCourse(courseId, reason));
}
