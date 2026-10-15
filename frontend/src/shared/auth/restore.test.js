import axios from 'axios';

import { API_URL } from '../config';
import { api } from '../api/client';
import { session } from '../lib/session';
import { restoreSession } from './restore';

const user = { id: 3, email: 'a@example.com', user_type: 'instructor' };

function installServer(routes) {
  const calls = [];
  const adapter = (config) => {
    const key = `${config.method.toUpperCase()} ${config.url.replace(API_URL, '')}`;
    calls.push({ key, data: config.data });
    const handler = routes[key];
    const [status, data] = handler ? handler(config) : [404, {}];
    const response = { data, status, statusText: '', headers: {}, config, request: {} };
    if (status === 0) return Promise.reject(new axios.AxiosError('Network Error', 'ERR_NETWORK', config));
    if (status >= 200 && status < 300) return Promise.resolve(response);
    return Promise.reject(new axios.AxiosError(`status ${status}`, 'ERR_BAD_RESPONSE', config, {}, response));
  };
  api.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
  return calls;
}

beforeEach(() => {
  window.localStorage.clear();
  session.reset();
});

test('a visitor who never signed in is not asked about', async () => {
  const calls = installServer({});

  await restoreSession();

  expect(session.getStatus()).toBe('anonymous');
  expect(calls).toEqual([]);
});

test('a browser with a session hint asks the server who the cookies belong to', async () => {
  window.localStorage.setItem('session_hint', '1');
  installServer({ 'GET /auth/profile/': () => [200, { user, profile: { bio: 'x' } }] });

  await restoreSession();

  expect(session.isAuthenticated()).toBe(true);
  expect(session.getUser()).toEqual(user);
  expect(session.getProfile()).toEqual({ bio: 'x' });
});

test('an expired session is signed out', async () => {
  window.localStorage.setItem('session_hint', '1');
  installServer({
    'GET /auth/profile/': () => [401, {}],
    'POST /auth/token/refresh/': () => [401, {}],
  });

  await restoreSession();

  expect(session.getStatus()).toBe('anonymous');
  expect(session.hasHint()).toBe(false);
});

test('an unreachable server is "unavailable", not "signed out"', async () => {
  window.localStorage.setItem('session_hint', '1');
  installServer({ 'GET /auth/profile/': () => [0, null] });

  await restoreSession();

  expect(session.getStatus()).toBe('unavailable');
  expect(session.hasHint()).toBe(true);
});

test('a session from the release before cookies is moved over once and leaves no token behind', async () => {
  window.localStorage.setItem('access_token', 'old-access');
  window.localStorage.setItem('refresh_token', 'old-refresh');
  window.localStorage.setItem('user', JSON.stringify(user));
  const calls = installServer({
    'POST /auth/token/refresh/': () => [200, { access: 'a', refresh: 'b' }],
    'GET /auth/profile/': () => [200, { user, profile: null }],
  });

  await restoreSession();

  expect(JSON.parse(calls[0].data)).toEqual({ refresh: 'old-refresh' });
  expect(calls[1].key).toBe('GET /auth/profile/');
  expect(session.isAuthenticated()).toBe(true);
  expect(window.localStorage.getItem('refresh_token')).toBeNull();
  expect(window.localStorage.getItem('access_token')).toBeNull();
  expect(window.localStorage.getItem('user')).toBeNull();
});

test('an old session that can no longer be refreshed is dropped and the user signs in again', async () => {
  window.localStorage.setItem('refresh_token', 'dead');
  installServer({
    'POST /auth/token/refresh/': () => [401, {}],
    'GET /auth/profile/': () => [401, {}],
  });

  await restoreSession();

  expect(session.getStatus()).toBe('anonymous');
  expect(window.localStorage.getItem('refresh_token')).toBeNull();
});

test('asking twice at once asks the server once', async () => {
  window.localStorage.setItem('session_hint', '1');
  const calls = installServer({ 'GET /auth/profile/': () => [200, { user, profile: null }] });

  await Promise.all([restoreSession(), restoreSession()]);

  expect(calls.filter((c) => c.key === 'GET /auth/profile/')).toHaveLength(1);
});
