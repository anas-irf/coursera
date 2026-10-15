import api from '../api/client';

export const login = (email, password) =>
  api.post('/auth/login/', { email, password }).then((response) => response.data);

export const signup = (payload) =>
  api.post('/auth/signup/', payload).then((response) => response.data);

// the refresh token is a cookie the server clears; ``refresh`` is only sent by a session that
// was started before cookies existed
export const logout = (refresh) =>
  api.post('/auth/logout/', refresh ? { refresh } : null).then((response) => response.data);

export const fetchProfile = () => api.get('/auth/profile/').then((response) => response.data);

/** Move a session that lives in localStorage (the release before cookies) over to cookies. */
export const exchangeLegacyToken = (refresh) =>
  api.post('/auth/token/refresh/', { refresh }).then((response) => response.data);
