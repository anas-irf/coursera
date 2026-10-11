import api from '../../shared/api/client';

export const fetchSubscriptionStatus = () =>
  api.get('/billing/subscription/').then((response) => response.data);

export const fetchCheckoutData = () =>
  api.get('/billing/checkout/').then((response) => response.data);

export const createCheckoutSession = (planId) =>
  api.post('/billing/checkout/session/', { plan_id: planId }).then((response) => response.data);

export const verifySession = (sessionId) =>
  api.post('/billing/checkout/verify/', { session_id: sessionId }).then((response) => response.data);
