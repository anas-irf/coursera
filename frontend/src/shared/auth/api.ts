import api from '../api/client';
import type { Identity, SignupPayload, SignupResponse } from './types';

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
