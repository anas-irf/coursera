import { percentOf, submissionStatus, visibleSubmissions } from './submissions';

const submissions = [
  { id: 1, student_name: 'Ada Lovelace', grade: 80, is_late: false },
  { id: 2, student_name: 'Grace Hopper', grade: null, is_late: true },
  { id: 3, student_name: 'Alan Turing', grade: null, is_late: false },
  { id: 4, student_name: 'Zero Points', grade: 0, is_late: false },
];

const ids = (list) => list.map((submission) => submission.id);

test('a hand-in is graded, late or waiting', () => {
  expect(submissionStatus(submissions[0])).toEqual({ label: 'Graded', tone: 'graded' });
  expect(submissionStatus(submissions[1])).toEqual({ label: 'Late Submission', tone: 'late' });
  expect(submissionStatus(submissions[2])).toEqual({ label: 'Pending Review', tone: 'pending' });
});

test('a grade of zero is a grade, not "waiting"', () => {
  expect(submissionStatus(submissions[3]).label).toBe('Graded');
  expect(ids(visibleSubmissions(submissions, { status: 'graded' }))).toEqual([1, 4]);
  expect(ids(visibleSubmissions(submissions, { status: 'pending' }))).toEqual([2, 3]);
});

test('filtered by status and by student name', () => {
  expect(ids(visibleSubmissions(submissions, { status: 'late' }))).toEqual([2]);
  expect(ids(visibleSubmissions(submissions, { search: ' LA ' }))).toEqual([1, 3]);
  expect(ids(visibleSubmissions(submissions))).toEqual([1, 2, 3, 4]);
});

test('the percentage of the points', () => {
  expect(percentOf('45', 50)).toBe('90%');
  expect(percentOf(0, 50)).toBe('0%');
  expect(percentOf('', 50)).toBe('-%');
  expect(percentOf(10, 0)).toBe('-%');
});
