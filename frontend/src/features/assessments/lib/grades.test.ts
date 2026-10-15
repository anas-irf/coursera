import { filterCourses, gradeBand, gradebookStats } from './grades';

const courses = [
  { course_id: 'a', final_grade: 91, is_passing: true },
  { course_id: 'b', final_grade: 55, is_passing: false },
  { course_id: 'c', final_grade: 74, is_passing: true },
];

test('a grade has the colours of its band', () => {
  expect(gradeBand(95).text).toBe('text-green-600');
  expect(gradeBand(90).text).toBe('text-green-600');
  expect(gradeBand(89.9).text).toBe('text-blue-600');
  expect(gradeBand(70).text).toBe('text-yellow-600');
  expect(gradeBand(60).text).toBe('text-orange-600');
  expect(gradeBand(59.9).text).toBe('text-red-600');
  expect(gradeBand(0).bg).toBe('bg-red-50 border-red-200');
});

test('the figures of a gradebook', () => {
  const stats = gradebookStats(courses);

  expect(stats.totalCourses).toBe(3);
  expect(stats.passingCourses).toBe(2);
  expect(stats.average).toBeCloseTo(73.33, 2);
  expect(stats.successRate).toBeCloseTo(66.67, 2);
});

test('an empty gradebook has zeros, not NaN', () => {
  expect(gradebookStats([])).toEqual({ totalCourses: 0, passingCourses: 0, average: 0, successRate: 0 });
});

test('the filter keeps passing or failing courses', () => {
  expect(filterCourses(courses, 'passing').map((course) => course.course_id)).toEqual(['a', 'c']);
  expect(filterCourses(courses, 'failing').map((course) => course.course_id)).toEqual(['b']);
  expect(filterCourses(courses, 'all')).toHaveLength(3);
});
