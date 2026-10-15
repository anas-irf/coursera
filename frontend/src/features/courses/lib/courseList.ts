import type { InstructorCourseRow } from '../types';

/** The orders the list offers. */
export const SORT_KEYS = ['date', 'revenue', 'students'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/** The states the list can be narrowed to (``all`` is no filter). */
export const STATUS_FILTERS = ['all', 'published', 'draft', 'pending_review', 'rejected'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/** Whether ``value`` is one of the orders the list offers (a select hands over plain text). */
export const isSortKey = (value: string): value is SortKey => SORT_KEYS.some((key) => key === value);

/** Whether ``value`` is one of the filters the list offers. */
export const isStatusFilter = (value: string): value is StatusFilter =>
  STATUS_FILTERS.some((filter) => filter === value);

type Comparator = (a: InstructorCourseRow, b: InstructorCourseRow) => number;

const SORTS: Record<SortKey, Comparator> = {
  date: (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
  revenue: (a, b) => (b.total_revenue || 0) - (a.total_revenue || 0),
  students: (a, b) => (b.total_enrolled || 0) - (a.total_enrolled || 0),
};

export interface CourseListOptions {
  search?: string;
  status?: StatusFilter;
  sort?: SortKey;
}

/**
 * The courses of the instructor's list that match the search and the status filter, in the
 * chosen order (``date`` newest first, ``revenue`` or ``students`` highest first).
 */
export function visibleCourses(
  courses: InstructorCourseRow[],
  { search = '', status = 'all', sort = 'date' }: CourseListOptions = {}
): InstructorCourseRow[] {
  const term = search.trim().toLowerCase();

  return courses
    .filter((course) => {
      if (status !== 'all' && course.status !== status) return false;
      if (!term) return true;
      return (
        (course.title || '').toLowerCase().includes(term) ||
        (course.description || '').toLowerCase().includes(term)
      );
    })
    .sort(SORTS[sort] || SORTS.date);
}
