import api from '../api/client';
import type { DemoAccounts, DemoRole, Identity, SignupPayload, SignupResponse } from './types';

export const login = (email: string, password: string): Promise<Identity> =>
  api.post<Identity>('/auth/login/', { email, password }).then((response) => response.data);

export const signup = (payload: SignupPayload): Promise<SignupResponse> =>
  api.post<SignupResponse>('/auth/signup/', payload).then((response) => response.data);

// the refresh token is a cookie the server clears; ``refresh`` is only sent by a session that
// was started before cookies existed
export const logout = (refresh?: string | null): Promise<unknown> =>
  api.post<unknown>('/auth/logout/', refresh ? { refresh } : null).then((response) => response.data);

export const fetchProfile = (): Promise<Identity> =>
  api.get<Identity>('/auth/profile/').then((response) => response.data);

/** Move a session that lives in localStorage (the release before cookies) over to cookies. */
export const exchangeLegacyToken = (refresh: string): Promise<unknown> =>
  api.post<unknown>('/auth/token/refresh/', { refresh }).then((response) => response.data);

/** Whether the demo sign-in is on, and the accounts it offers. */
export const demoAccounts = (): Promise<DemoAccounts> =>
  api.get<DemoAccounts>('/auth/demo/').then((response) => response.data);

/** Sign in as the demo account of a role (no password: the server only allows it in demo mode). */
export const demoLogin = (role: DemoRole): Promise<Identity> =>
  api.post<Identity>('/auth/demo/login/', { role }).then((response) => response.data);
