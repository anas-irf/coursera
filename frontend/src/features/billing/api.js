import api from '../../shared/api/client';

// the subscription status is served from the auth prefix for historical reasons
export const fetchSubscriptionStatus = () =>
  api.get('/auth/student/subscription-status/').then((response) => response.data);

export const fetchCheckoutData = () =>
  api.get('/payments/checkout/data/').then((response) => response.data);

export const createCheckoutSession = (planId) =>
  api.post('/payments/checkout/stripe-session/', { plan_id: planId }).then((response) => response.data);

export const verifySession = (sessionId) =>
  api.post('/payments/verify-session/', { session_id: sessionId }).then((response) => response.data);
