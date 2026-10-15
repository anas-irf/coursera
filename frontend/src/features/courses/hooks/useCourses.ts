import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UUID } from '../../../shared/types';
import * as coursesApi from '../api';
import type { CourseBody } from '../types';

/** Query keys of the courses feature (``['courses', resource, params]``). */
export const courseKeys = {
  all: ['courses'] as const,
  mine: ['courses', 'mine'] as const,
  detail: (courseId: UUID) => ['courses', 'detail', courseId] as const,
  categories: ['courses', 'categories'] as const,
  languages: ['courses', 'languages'] as const,
  sections: (courseId: UUID) => ['courses', 'sections', courseId] as const,
};

const LISTS_CHANGE_RARELY = 10 * 60 * 1000;

/** The instructor's own courses. */
export function useInstructorCourses() {
  return useQuery({ queryKey: courseKeys.mine, queryFn: coursesApi.listCourses });
}

/** One course with everything the edit form needs. */
export function useCourseDetail(courseId: UUID) {
  return useQuery({
    queryKey: courseKeys.detail(courseId),
    queryFn: () => coursesApi.getCourse(courseId),
    enabled: Boolean(courseId),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: courseKeys.categories,
    queryFn: coursesApi.listCategories,
    staleTime: LISTS_CHANGE_RARELY,
  });
}

export function useLanguages() {
  return useQuery({
    queryKey: courseKeys.languages,
    queryFn: coursesApi.listLanguages,
    staleTime: LISTS_CHANGE_RARELY,
  });
}

/** What a changed course changes: the instructor's list, its detail and the admin's queue. */
function useRefreshCourses() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: courseKeys.mine }),
    client.invalidateQueries({ queryKey: ['courses', 'detail'] }),
    client.invalidateQueries({ queryKey: ['admin'] }),
  ]);
}

/** ``mutate(body)`` where body comes from ``courseBody`` (multipart: the thumbnail is required). */
export function useCreateCourse() {
  const refresh = useRefreshCourses();
  return useMutation({ mutationFn: coursesApi.createCourse, onSuccess: refresh });
}

/** ``mutate(body)`` for one course. */
export function useUpdateCourse(courseId: UUID) {
  const refresh = useRefreshCourses();
  return useMutation({
    mutationFn: (body: CourseBody) => coursesApi.updateCourse(courseId, body),
    onSuccess: refresh,
  });
}

/** Submit a draft or rejected course for review (``mutate(courseId)``). */
export function useSubmitForReview() {
  const refresh = useRefreshCourses();
  return useMutation({ mutationFn: coursesApi.applyForPublish, onSuccess: refresh });
}

/** Take a published course down so it can be edited again (``mutate(courseId)``). */
export function useUnpublishCourse() {
  const refresh = useRefreshCourses();
  return useMutation({ mutationFn: coursesApi.unpublish, onSuccess: refresh });
}

/** What ``useDeleteCourse`` is given: the course and the typed confirmation. */
export interface DeleteCourseVariables {
  courseId: UUID;
  /** "<e-mail>/<title>" */
  confirmation: string;
}

/** ``mutate({courseId, confirmation})`` where confirmation is "<e-mail>/<title>". */
export function useDeleteCourse() {
  const refresh = useRefreshCourses();
  return useMutation({
    mutationFn: ({ courseId, confirmation }: DeleteCourseVariables) =>
      coursesApi.deleteCourse(courseId, confirmation),
    onSuccess: refresh,
  });
}
