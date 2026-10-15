import { act, renderHook } from '@testing-library/react';

import { useDebouncedValue } from './useDebouncedValue';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('the value follows only after it stopped changing', () => {
  const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
    initialProps: { value: 'p' },
  });
  expect(result.current).toBe('p');

  rerender({ value: 'py' });
  rerender({ value: 'pyt' });
  act(() => jest.advanceTimersByTime(200));
  expect(result.current).toBe('p');

  act(() => jest.advanceTimersByTime(150));
  expect(result.current).toBe('pyt');
});
