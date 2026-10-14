import axios from 'axios';

import { API_URL } from '../config';
import { session } from '../lib/session';
import { api } from './client';

// whatever the build is configured with (a developer's .env must not matter)
const API = API_URL;

// A scripted server: ``routes`` maps "METHOD path" to a function (config) => [status, data].
function installServer(routes) {
  const calls = [];
  const adapter = (config) => {
    const path = config.url.replace(API, '');
    const key = `${config.method.toUpperCase()} ${path}`;
    const handler = routes[key];
    calls.push({ key, authorization: config.headers.Authorization, data: config.data });
    const [status, data] = handler ? handler(config) : [404, {}];
    const response = { data, status, statusText: '', headers: {}, config, request: {} };
    if (status >= 200 && status < 300) return Promise.resolve(response);
    return Promise.reject(new axios.AxiosError(`status ${status}`, 'ERR_BAD_RESPONSE', config, {}, response));
  };
  api.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
  return calls;
}

beforeEach(() => {
  window.localStorage.clear();
  session.clear();
  session.start({
    tokens: { access: 'old-access', refresh: 'old-refresh' },
    user: { id: 1, user_type: 'student' },
  });
});

test('sends the access token', async () => {
  const calls = installServer({ 'GET /courses/all/': () => [200, []] });

  await api.get('/courses/all/');

  expect(calls[0].authorization).toBe('Bearer old-access');
});

test('refreshes an expired token once, replays the request and keeps the rotated refresh token', async () => {
  let attempts = 0;
  const calls = installServer({
    'GET /courses/enrolled/': (config) => {
      attempts += 1;
      return config.headers.Authorization === 'Bearer new-access' ? [200, ['ok']] : [401, {}];
    },
    'POST /auth/token/refresh/': () => [200, { access: 'new-access', refresh: 'new-refresh' }],
  });

  const response = await api.get('/courses/enrolled/');

  expect(response.data).toEqual(['ok']);
  expect(attempts).toBe(2);
  expect(JSON.parse(calls.find((c) => c.key === 'POST /auth/token/refresh/').data))
    .toEqual({ refresh: 'old-refresh' });
  expect(session.getAccessToken()).toBe('new-access');
  expect(session.getRefreshToken()).toBe('new-refresh');
});

test('concurrent requests share one refresh', async () => {
  const calls = installServer({
    'GET /a/': (config) => (config.headers.Authorization === 'Bearer fresh' ? [200, 'a'] : [401, {}]),
    'GET /b/': (config) => (config.headers.Authorization === 'Bearer fresh' ? [200, 'b'] : [401, {}]),
    'GET /c/': (config) => (config.headers.Authorization === 'Bearer fresh' ? [200, 'c'] : [401, {}]),
    'POST /auth/token/refresh/': () => [200, { access: 'fresh', refresh: 'fresh-refresh' }],
  });

  const results = await Promise.all([api.get('/a/'), api.get('/b/'), api.get('/c/')]);

  expect(results.map((r) => r.data)).toEqual(['a', 'b', 'c']);
  expect(calls.filter((c) => c.key === 'POST /auth/token/refresh/')).toHaveLength(1);
});

test('a failed refresh ends the session and reports the original error', async () => {
  installServer({
    'GET /courses/enrolled/': () => [401, { detail: 'expired' }],
    'POST /auth/token/refresh/': () => [401, { detail: 'blacklisted' }],
  });

  await expect(api.get('/courses/enrolled/')).rejects.toMatchObject({ response: { status: 401 } });

  expect(session.isAuthenticated()).toBe(false);
  expect(session.getRefreshToken()).toBeNull();
});

test('a wrong password is not an expired session', async () => {
  const calls = installServer({ 'POST /auth/login/': () => [401, { error: 'Invalid credentials' }] });
  session.clear();

  await expect(api.post('/auth/login/', { email: 'a', password: 'b' }))
    .rejects.toMatchObject({ response: { status: 401 } });

  expect(calls.map((c) => c.key)).toEqual(['POST /auth/login/']);
});

test('errors other than 401 are passed through untouched', async () => {
  installServer({ 'POST /courses/1/enroll/': () => [402, { requires_subscription: true }] });

  await expect(api.post('/courses/1/enroll/')).rejects.toMatchObject({
    response: { status: 402, data: { requires_subscription: true } },
  });
  expect(session.isAuthenticated()).toBe(true);
});
