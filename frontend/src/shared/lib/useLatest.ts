import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * A ref that always holds the newest ``value``: lets a long-lived listener (a timer, a player
 * callback) call the current function without being re-subscribed on every render.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

export default useLatest;
