// The one HTTP client of the app.
//
// * adds the access token to every request,
// * on a 401 refreshes the token pair once (concurrent requests share the same
//   refresh call) and replays the request,
// * stores the *rotated* refresh token (the server blacklists the old one),
// * when the session cannot be refreshed it clears the session; the auth
//   provider reacts to that and sends the user to the login page.
import axios from 'axios';

import { API_URL } from '../config';
import { session } from '../lib/session';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = session.getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing = null;

/** Exchange the refresh token for a new pair; resolves with the new access token. */
export function refreshAccessToken() {
  if (!refreshing) {
    const refresh = session.getRefreshToken();
    if (!refresh) {
      return Promise.reject(new Error('No refresh token'));
    }
    refreshing = axios
      .post(`${API_URL}/auth/token/refresh/`, { refresh })
      .then(({ data }) => {
        session.setTokens({ access: data.access, refresh: data.refresh });
        return data.access;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

// a 401 from these means "wrong credentials", not "expired session"
const isCredentialCall = (config) => /\/auth\/(login|signup|token\/refresh)\//.test(config.url || '');

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const expired = response && response.status === 401 && config && !config._retry;

    if (!expired || isCredentialCall(config)) {
      return Promise.reject(error);
    }

    if (!session.getRefreshToken()) {
      session.clear();
      return Promise.reject(error);
    }

    config._retry = true;
    try {
      const access = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${access}`;
      return api(config);
    } catch (refreshError) {
      session.clear();
      return Promise.reject(error);
    }
  }
);

export default api;
