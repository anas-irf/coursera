import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import * as learningApi from '../api';

/**
 * Query keys of the learning feature (``['learning', resource, params]``).  Enrolling invalidates
 * the whole ``['learning']`` prefix, so the catalogue ("ENROLLED"), my courses and the home page
 * all follow.
 */
export const learningKeys = {
  all: ['learning'],
  mine: (status) => ['learning', 'mine', status],
  catalog: (filters) => ['learning', 'catalog', filters],
  recommended: ['learning', 'recommended'],
  player: (courseId) => ['learning', 'player', courseId],
  instructorStudents: ['learning', 'instructor-students'],
};

export const CATALOG_PAGE_SIZE = 12;
export const RECOMMENDED_COUNT = 6;

/** The student's courses; ``status`` is "active", "completed" or "all". */
export function useMyCourses({ status = 'active' } = {}) {
  return useQuery({
    queryKey: learningKeys.mine(status),
    queryFn: () => learningApi.myCourses({ status }),
  });
}

/**
 * The catalogue in pages: ``fetchNextPage`` loads the next one, ``total`` is how many courses
 * match in all and ``courses`` the ones loaded so far.  While another filter loads, the previous
 * result stays on screen (``isPlaceholderData``).
 */
export function useCatalog(filters) {
  const query = useInfiniteQuery({
    queryKey: learningKeys.catalog(filters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      learningApi.listCoursesPage({ filters, page: pageParam, pageSize: CATALOG_PAGE_SIZE }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((count, page) => count + page.items.length, 0);
      if (last.items.length === 0 || loaded >= last.total) return undefined;
      return pages.length + 1;
    },
    placeholderData: keepPreviousData,
  });

  const pages = query.data ? query.data.pages : [];
  return {
    ...query,
    courses: pages.flatMap((page) => page.items),
    total: pages.length ? pages[0].total : 0,
  };
}

/** The few catalogue courses the home page suggests. */
export function useRecommendedCourses(count = RECOMMENDED_COUNT) {
  return useQuery({
    queryKey: [...learningKeys.recommended, count],
    queryFn: () => learningApi.listCoursesPage({ pageSize: count }).then((page) => page.items),
  });
}

/** Enrol in a course (``mutate(courseId)``); every list of courses is refreshed afterwards. */
export function useEnroll() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (courseId) => learningApi.enroll(courseId),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: learningKeys.all }),
      client.invalidateQueries({ queryKey: ['insights'] }),
    ]),
  });
}

/**
 * Bookmark or un-bookmark a course (``mutate(courseId)``).  The heart is drawn from local state
 * by the card, so the cached lists are only marked stale and refresh the next time they show.
 */
export function useToggleBookmark() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (courseId) => learningApi.toggleBookmark(courseId),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['learning', 'catalog'], refetchType: 'none' }),
      client.invalidateQueries({ queryKey: learningKeys.recommended, refetchType: 'none' }),
    ]),
  });
}

/** The learners of the instructor's courses. */
export function useInstructorStudents() {
  return useQuery({
    queryKey: learningKeys.instructorStudents,
    queryFn: learningApi.instructorStudents,
  });
}
