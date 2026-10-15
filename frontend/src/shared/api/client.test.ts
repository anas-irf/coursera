import axios from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

import { API_URL } from '../config';
import type { User } from '../auth/types';
import { session } from '../lib/session';
import { api } from './client';

// whatever the build is configured with (a developer's .env must not matter)
const API = API_URL;

type Handler = (config: InternalAxiosRequestConfig) => [number, unknown];

interface Call {
  key: string;
  headers: InternalAxiosRequestConfig['headers'];
  withCredentials: boolean | undefined;
  data: unknown;
}

// A scripted server: ``routes`` maps "METHOD path" to a function (config) => [status, data].
function installServer(routes: Record<string, Handler>): Call[] {
  const calls: Call[] = [];
  const adapter: AxiosAdapter = (config) => {
    const path = (config.url ?? '').replace(API, '');
    const key = `${(config.method ?? 'get').toUpperCase()} ${path}`;
    const handler = routes[key];
    calls.push({
      key,
      headers: config.headers,
      withCredentials: config.withCredentials,
      data: config.data,
    });
    const [status, data] = handler ? handler(config) : [404, {}];
    const response: AxiosResponse = { data, status, statusText: '', headers: {}, config, request: {} };
    if (status >= 200 && status < 300) return Promise.resolve(response);
    return Promise.reject(new axios.AxiosError(`status ${status}`, 'ERR_BAD_RESPONSE', config, {}, response));
  };
  api.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
  return calls;
}

const user = { id: 1, user_type: 'student' } as User;

beforeEach(() => {
  window.localStorage.clear();
  session.reset();
  session.start({ user });
});

test('sends the session cookie and says it is our front end, with no token of its own', async () => {
  const calls = installServer({ 'GET /courses/all/': () => [200, []] });

  await api.get('/courses/all/');

  expect(calls[0].withCredentials).toBe(true);
  expect(calls[0].headers['X-Requested-With']).toBe('XMLHttpRequest');
  expect(calls[0].headers.Authorization).toBeUndefined();
});

test('refreshes an expired session once and replays the request', async () => {
  let attempts = 0;
  let refreshed = false;
  const calls = installServer({
    'GET /courses/enrolled/': () => {
      attempts += 1;
      return refreshed ? [200, ['ok']] : [401, {}];
    },
    'POST /auth/token/refresh/': () => {
      refreshed = true;
      return [204, null];
    },
  });

  const response = await api.get('/courses/enrolled/');

  expect(response.data).toEqual(['ok']);
  expect(attempts).toBe(2);
  const refresh = calls.find((c) => c.key === 'POST /auth/token/refresh/');
  expect(refresh?.withCredentials).toBe(true);
  expect(refresh?.data).toBeFalsy();   // the refresh token is a cookie, not a body
  expect(session.isAuthenticated()).toBe(true);
});

test('concurrent requests share one refresh', async () => {
  let refreshed = false;
  const answer = (value: string) => (): [number, unknown] => (refreshed ? [200, value] : [401, {}]);
  const calls = installServer({
    'GET /a/': answer('a'),
    'GET /b/': answer('b'),
    'GET /c/': answer('c'),
    'POST /auth/token/refresh/': () => {
      refreshed = true;
      return [204, null];
    },
  });

  const results = await Promise.all([api.get('/a/'), api.get('/b/'), api.get('/c/')]);

  expect(results.map((r) => r.data)).toEqual(['a', 'b', 'c']);
  expect(calls.filter((c) => c.key === 'POST /auth/token/refresh/')).toHaveLength(1);
});

test('a failed refresh ends the session when the profile says so too', async () => {
  installServer({
    'GET /courses/enrolled/': () => [401, { detail: 'expired' }],
    'POST /auth/token/refresh/': () => [401, { detail: 'blacklisted' }],
    'GET /auth/profile/': () => [401, { detail: 'expired' }],
  });

  await expect(api.get('/courses/enrolled/')).rejects.toMatchObject({ response: { status: 401 } });

  expect(session.isAuthenticated()).toBe(false);
  expect(session.getStatus()).toBe('anonymous');
});

test('another tab that refreshed first keeps this one signed in', async () => {
  // this tab's refresh was refused because the other tab rotated the refresh cookie; the
  // profile (the cookies are shared) is fine, so the request is simply replayed
  let calls = 0;
  installServer({
    'GET /courses/enrolled/': () => {
      calls += 1;
      return calls === 1 ? [401, {}] : [200, ['ok']];
    },
    'POST /auth/token/refresh/': () => [401, { detail: 'blacklisted' }],
    'GET /auth/profile/': () => [200, { user }],
  });

  const response = await api.get('/courses/enrolled/');

  expect(response.data).toEqual(['ok']);
  expect(session.isAuthenticated()).toBe(true);
});

test('a wrong password is not an expired session', async () => {
  const calls = installServer({ 'POST /auth/login/': () => [401, { error: 'Invalid credentials' }] });
  session.setAnonymous();

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
