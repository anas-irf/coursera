import api from '../../shared/api/client';

export const login = (email, password) =>
  api.post('/auth/login/', { email, password }).then((response) => response.data);

export const signup = (payload) =>
  api.post('/auth/signup/', payload).then((response) => response.data);

export const logout = (refresh) =>
  api.post('/auth/logout/', { refresh }).then((response) => response.data);

export const fetchProfile = () => api.get('/auth/profile/').then((response) => response.data);
