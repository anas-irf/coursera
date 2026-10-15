import { visibleCourses } from './courseList';
import type { InstructorCourseRow } from '../types';

const row = (overrides: Partial<InstructorCourseRow>): InstructorCourseRow => ({
  id: 'c-0',
  title: '',
  status: 'draft',
  course_type: 'free',
  total_enrolled: 0,
  average_rating: 0,
  created_at: '2026-01-01',
  thumbnail: null,
  total_revenue: 0,
  ...overrides,
});

const courses = [
  row({ id: 'c-1', title: 'React for Beginners', status: 'published', total_enrolled: 40, total_revenue: 100, created_at: '2026-01-01' }),
  row({ id: 'c-2', title: 'Django APIs', status: 'draft', total_enrolled: 5, total_revenue: 900, created_at: '2026-03-01' }),
  row({ id: 'c-3', title: 'Reactive Design', status: 'draft', total_enrolled: 90, total_revenue: 0, created_at: '2026-02-01' }),
];

const ids = (list: InstructorCourseRow[]) => list.map((course) => course.id);

test('newest first by default', () => {
  expect(ids(visibleCourses(courses))).toEqual(['c-2', 'c-3', 'c-1']);
});

test('sorted by revenue or by students', () => {
  expect(ids(visibleCourses(courses, { sort: 'revenue' }))).toEqual(['c-2', 'c-1', 'c-3']);
  expect(ids(visibleCourses(courses, { sort: 'students' }))).toEqual(['c-3', 'c-1', 'c-2']);
});

test('narrowed by status and by a case-insensitive search', () => {
  expect(ids(visibleCourses(courses, { status: 'draft' }))).toEqual(['c-2', 'c-3']);
  expect(ids(visibleCourses(courses, { search: ' REACT ' }))).toEqual(['c-3', 'c-1']);
  expect(ids(visibleCourses(courses, { status: 'published', search: 'react' }))).toEqual(['c-1']);
  expect(visibleCourses(courses, { search: 'nothing like this' })).toEqual([]);
});

test('the list given is not reordered in place', () => {
  const before = ids(courses);
  visibleCourses(courses, { sort: 'revenue' });
  expect(ids(courses)).toEqual(before);
});
