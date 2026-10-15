import { useEffect, useState } from 'react';

const secondsLeft = (target: number, now: () => number): number =>
  Math.max(0, Math.ceil((target - now()) / 1000));

/**
 * Whole seconds left until ``expiresAt`` (an ISO timestamp), counting down once a second; ``null``
 * when there is no deadline.  It stays at 0 once the deadline passed.
 */
export function useCountdown(expiresAt: string | null | undefined, now: () => number = Date.now): number | null {
  const target = expiresAt ? Date.parse(expiresAt) : NaN;
  const hasDeadline = Number.isFinite(target);
  const [remaining, setRemaining] = useState<number | null>(() =>
    hasDeadline ? secondsLeft(target, now) : null
  );

  useEffect(() => {
    if (!hasDeadline) {
      setRemaining(null);
      return undefined;
    }
    const tick = () => setRemaining(secondsLeft(target, now));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [hasDeadline, target, now]);

  return remaining;
}

export default useCountdown;
