import { useCallback, useEffect, useState } from 'react';

import { fetchSubscriptionStatus } from '../api';

/**
 * Plus status of the logged in student.  ``plan`` is "coursera_plus" or "free"
 * (also when the status cannot be loaded) and ``null`` while loading.
 */
export function useSubscription() {
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchSubscriptionStatus();
      setStatus(data);
      setPlan(data.can_access_plus_courses ? 'coursera_plus' : 'free');
    } catch (error) {
      setStatus(null);
      setPlan('free');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { plan, status, loading: plan === null, isPlus: plan === 'coursera_plus', refresh };
}
