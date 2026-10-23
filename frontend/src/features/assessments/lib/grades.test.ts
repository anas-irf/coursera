import { filterCourses, gradeBand, gradebookStats, isGradeFilter } from './grades';

test('a select hands over text: only the filters of the course list are taken', () => {
  expect(['all', 'passing', 'failing'].every(isGradeFilter)).toBe(true);
  expect(isGradeFilter('excellent')).toBe(false);
  expect(isGradeFilter('')).toBe(false);
});

const courses = [
  { course_id: 'a', final_grade: 91, is_passing: true },
  { course_id: 'b', final_grade: 55, is_passing: false },
  { course_id: 'c', final_grade: 74, is_passing: true },
];

test('a grade has the tone of its band', () => {
  expect(gradeBand(95).tone).toBe('success');
  expect(gradeBand(90).tone).toBe('success');
  expect(gradeBand(89.9).tone).toBe('primary');
  expect(gradeBand(80).tone).toBe('primary');
  expect(gradeBand(70).tone).toBe('warning');
  expect(gradeBand(60).tone).toBe('warning');
  expect(gradeBand(59.9).tone).toBe('danger');
  expect(gradeBand(0).tone).toBe('danger');
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
