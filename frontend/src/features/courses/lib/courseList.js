const SORTS = {
  date: (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
  revenue: (a, b) => (b.total_revenue || 0) - (a.total_revenue || 0),
  students: (a, b) => (b.total_enrolled || 0) - (a.total_enrolled || 0),
};

/**
 * The courses of the instructor's list that match the search and the status filter, in the
 * chosen order (``date`` newest first, ``revenue`` or ``students`` highest first).
 */
export function visibleCourses(courses, { search = '', status = 'all', sort = 'date' } = {}) {
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
