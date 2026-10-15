import { useEffect, useState } from 'react';

const secondsLeft = (target, now) => Math.max(0, Math.ceil((target - now()) / 1000));

/**
 * Whole seconds left until ``expiresAt`` (an ISO timestamp), counting down once a second; ``null``
 * when there is no deadline.  It stays at 0 once the deadline passed.
 */
export function useCountdown(expiresAt, now = Date.now) {
  const target = expiresAt ? Date.parse(expiresAt) : NaN;
  const hasDeadline = Number.isFinite(target);
  const [remaining, setRemaining] = useState(() => (hasDeadline ? secondsLeft(target, now) : null));

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
