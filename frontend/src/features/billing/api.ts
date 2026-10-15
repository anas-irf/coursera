import api from '../../shared/api/client';
import type {
  BillingCycle,
  CancelResult,
  CheckoutData,
  CheckoutSession,
  SubscriptionStatus,
  VerifyResult,
} from './types';

export const fetchSubscriptionStatus = (): Promise<SubscriptionStatus> =>
  api.get<SubscriptionStatus>('/billing/subscription/').then((response) => response.data);

export const fetchCheckoutData = (): Promise<CheckoutData> =>
  api.get<CheckoutData>('/billing/checkout/').then((response) => response.data);

export const createCheckoutSession = (planId: BillingCycle): Promise<CheckoutSession> =>
  api.post<CheckoutSession>('/billing/checkout/session/', { plan_id: planId }).then((response) => response.data);

export const verifySession = (sessionId: string): Promise<VerifyResult> =>
  api.post<VerifyResult>('/billing/checkout/verify/', { session_id: sessionId }).then((response) => response.data);

/** Stops the renewal (at Stripe too); the member keeps Plus until the end of the paid period. */
export const cancelSubscription = (): Promise<CancelResult> =>
  api.post<CancelResult>('/billing/subscription/cancel/').then((response) => response.data);
