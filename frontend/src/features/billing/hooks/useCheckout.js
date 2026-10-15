import { useMutation, useQuery } from '@tanstack/react-query';

import { createCheckoutSession, fetchCheckoutData } from '../api';

export const checkoutKey = ['billing', 'checkout'];

/** The plans, their prices and what the yearly plan saves. */
export function useCheckoutData() {
  return useQuery({ queryKey: checkoutKey, queryFn: fetchCheckoutData });
}

/** ``mutateAsync(planId)`` resolves with the Stripe page to send the customer to (``checkout_url``). */
export function useCreateCheckoutSession() {
  return useMutation({ mutationFn: (planId) => createCheckoutSession(planId) });
}
