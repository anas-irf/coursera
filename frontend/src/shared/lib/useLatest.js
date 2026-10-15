import { useEffect, useRef } from 'react';

/**
 * A ref that always holds the newest ``value``: lets a long-lived listener (a timer, a player
 * callback) call the current function without being re-subscribed on every render.
 */
export function useLatest(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

export default useLatest;
