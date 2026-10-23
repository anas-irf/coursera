import { NOT_LOADED, compactMoney, hours, percent, rating, shareOf, shortDay } from './format';

test('hours keep one decimal, so twenty minutes are not zero', () => {
  expect(hours(12.46)).toBe(12.5);
  expect(hours(0.33)).toBe(0.3);
  expect(hours(5)).toBe(5);
  expect(hours(null)).toBe(0);
});

test('a rate of nothing is a dash, not 0%', () => {
  expect(percent(40)).toBe('40%');
  expect(percent(16.666)).toBe('16.7%');
  expect(percent(0)).toBe('0%');
  expect(percent(null)).toBe(NOT_LOADED);
  expect(percent(undefined)).toBe(NOT_LOADED);
});

test('a course nobody rated has no rating', () => {
  expect(rating(4.56)).toBe('4.6');
  expect(rating(0)).toBe(NOT_LOADED);
  expect(rating(null)).toBe(NOT_LOADED);
});

test('a day of the API is written without moving it to another time zone', () => {
  expect(shortDay('2026-10-01')).toBe('Oct 1');
  expect(shortDay('2026-01-31T23:00:00Z')).toBe('Jan 31');
  expect(shortDay('soon')).toBe('soon');
});

test('shares and axis money', () => {
  expect(shareOf(1, 3)).toBe(33);
  expect(shareOf(2, 0)).toBe(0);
  expect(compactMoney(950.4)).toBe('$950');
  expect(compactMoney(1250)).toBe('$1.3k');
  expect(compactMoney(12000)).toBe('$12k');
});
