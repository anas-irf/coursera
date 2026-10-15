// The one HTTP client of the app.
//
// * the session is a pair of HttpOnly cookies the browser sends on its own
//   (``withCredentials``); there is no token to attach.  Every request also says
//   ``X-Requested-With``, which the server requires of cookie-authenticated requests that
//   change data,
// * on a 401 it refreshes the session once (concurrent requests, also from other tabs, share
//   the same refresh) and replays the request,
// * when the session cannot be refreshed it asks for the profile once, because another tab
//   may have refreshed in the meantime (the cookies are shared), and only then ends the
//   session; the auth provider reacts and sends the user to the login page.
import axios from 'axios';
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

import { API_URL } from '../config';
import { session } from '../lib/session';

declare module 'axios' {
  // the type parameter has to repeat the one of axios for the declarations to merge, used or not
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  interface AxiosRequestConfig<D = any> {
    /** Set on a request that was replayed after a refresh, so that it is replayed only once. */
    _retry?: boolean;
  }
}

const HEADERS = { 'X-Requested-With': 'XMLHttpRequest' };

export const api = axios.create({ baseURL: API_URL, withCredentials: true, headers: HEADERS });

let refreshing: Promise<AxiosResponse> | null = null;

const callRefresh = (): Promise<AxiosResponse> =>
  axios.post(`${API_URL}/auth/token/refresh/`, null, { withCredentials: true, headers: HEADERS });

// one refresh at a time across tabs: a second tab would send the cookie the first one just rotated
// (the lib types of ``request`` do not unwrap a promise the callback returns; the browser does)
const inOneTabAtATime = <T>(task: () => Promise<T>): Promise<T> =>
  typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request
    ? (navigator.locks.request('coursera-session-refresh', task) as unknown as Promise<T>)
    : task();

/** Ask the server for a new session; the cookies are set by its answer. */
export function refreshSession(): Promise<AxiosResponse> {
  if (!refreshing) {
    refreshing = inOneTabAtATime(callRefresh).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

// a 401 from these means "wrong credentials" or "no session", not "expired session"
const isCredentialCall = (config: AxiosRequestConfig): boolean =>
  /\/auth\/(login|signup|logout|token\/refresh)\//.test(config.url || '');

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const { config, response } = error;
    const expired = response && response.status === 401 && config && !config._retry;

    if (!expired || isCredentialCall(config)) {
      return Promise.reject(error);
    }

    config._retry = true;
    try {
      await refreshSession();
    } catch (refreshError) {
      try {
        // refreshed by another tab? then the profile answers
        await api.get('/auth/profile/', { _retry: true });
      } catch (probeError) {
        session.setAnonymous();
        return Promise.reject(error);
      }
    }
    return api(config);
  }
);

export default api;
