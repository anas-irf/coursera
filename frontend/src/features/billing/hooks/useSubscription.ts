import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cancelSubscription, fetchSubscriptionStatus } from '../api';
import type { SubscriptionView } from '../types';

export const subscriptionKey = ['billing', 'subscription'] as const;

/**
 * Plus status of the logged in student: the one definition of "is this student a member".
 *
 * ``isPlus`` is what the server says ``can_access_plus_courses`` is, which includes a cancelled
 * membership until the end of the period that was paid for.  ``plan`` is "coursera_plus" or
 * "free" and ``null`` while loading; ``willRenew`` is false once the member cancelled.
 */
export function useSubscription(): SubscriptionView {
  const query = useQuery({ queryKey: subscriptionKey, queryFn: fetchSubscriptionStatus });
  const status = query.data || null;
  const isPlus = Boolean(status && status.can_access_plus_courses);

  return {
    status,
    plan: query.isPending ? null : (isPlus ? 'coursera_plus' : 'free'),
    loading: query.isPending,
    error: query.error,
    isPlus,
    willRenew: Boolean(status && status.is_active && status.auto_renew),
    accessUntil: status && status.end_date ? status.end_date : null,
    refresh: () => query.refetch(),
  };
}

/** Stop the membership renewing; Plus keeps working until the end of the paid period. */
export function useCancelMembership() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['billing'] }),
      client.invalidateQueries({ queryKey: ['learning'] }),
    ]),
  });
}
