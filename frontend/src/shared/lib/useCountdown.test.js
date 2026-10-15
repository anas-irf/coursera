import { act, renderHook } from '@testing-library/react';

import { useCountdown } from './useCountdown';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('counts the seconds down to the deadline and stays at zero', () => {
  let clock = Date.parse('2026-10-12T12:00:00Z');
  const now = () => clock;
  const { result } = renderHook(() => useCountdown('2026-10-12T12:00:03Z', now));
  expect(result.current).toBe(3);

  clock += 1000;
  act(() => jest.advanceTimersByTime(1000));
  expect(result.current).toBe(2);

  clock += 5000;
  act(() => jest.advanceTimersByTime(1000));
  expect(result.current).toBe(0);
});

test('no deadline, no countdown', () => {
  const { result } = renderHook(() => useCountdown(null));
  expect(result.current).toBeNull();
});

test('a new deadline restarts the countdown', () => {
  const now = () => Date.parse('2026-10-12T12:00:00Z');
  const { result, rerender } = renderHook(({ at }) => useCountdown(at, now), {
    initialProps: { at: '2026-10-12T12:00:10Z' },
  });
  expect(result.current).toBe(10);

  rerender({ at: '2026-10-12T12:01:00Z' });
  expect(result.current).toBe(60);
});
