import { timeAgo } from './time';

const now = new Date('2026-10-12T12:00:00Z');
const ago = (ms) => new Date(now.getTime() - ms).toISOString();

test('recent times are relative', () => {
  expect(timeAgo(ago(10 * 1000), now)).toBe('Just now');
  expect(timeAgo(ago(5 * 60 * 1000), now)).toBe('5m ago');
  expect(timeAgo(ago(3 * 3600 * 1000), now)).toBe('3h ago');
  expect(timeAgo(ago(2 * 86400 * 1000), now)).toBe('2d ago');
});

test('older times are dates', () => {
  const old = ago(30 * 86400 * 1000);
  expect(timeAgo(old, now)).toBe(new Date(old).toLocaleDateString());
});
