import { visibleCourses } from './courseList';

const courses = [
  { id: 1, title: 'React for Beginners', status: 'published', total_enrolled: 40, total_revenue: 100, created_at: '2026-01-01' },
  { id: 2, title: 'Django APIs', status: 'draft', total_enrolled: 5, total_revenue: 900, created_at: '2026-03-01' },
  { id: 3, title: 'Reactive Design', status: 'draft', total_enrolled: 90, total_revenue: 0, created_at: '2026-02-01' },
];

const ids = (list) => list.map((course) => course.id);

test('newest first by default', () => {
  expect(ids(visibleCourses(courses))).toEqual([2, 3, 1]);
});

test('sorted by revenue or by students', () => {
  expect(ids(visibleCourses(courses, { sort: 'revenue' }))).toEqual([2, 1, 3]);
  expect(ids(visibleCourses(courses, { sort: 'students' }))).toEqual([3, 1, 2]);
});

test('narrowed by status and by a case-insensitive search', () => {
  expect(ids(visibleCourses(courses, { status: 'draft' }))).toEqual([2, 3]);
  expect(ids(visibleCourses(courses, { search: ' REACT ' }))).toEqual([3, 1]);
  expect(ids(visibleCourses(courses, { status: 'published', search: 'react' }))).toEqual([1]);
  expect(visibleCourses(courses, { search: 'nothing like this' })).toEqual([]);
});

test('the list given is not reordered in place', () => {
  const before = ids(courses);
  visibleCourses(courses, { sort: 'revenue' });
  expect(ids(courses)).toEqual(before);
});
