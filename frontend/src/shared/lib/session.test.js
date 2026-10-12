import { session } from './session';

const tokens = { access: 'access-1', refresh: 'refresh-1' };
const user = { id: 7, email: 'a@example.com', user_type: 'student' };

beforeEach(() => {
  window.localStorage.clear();
  session.clear();
});

test('starts empty', () => {
  expect(session.isAuthenticated()).toBe(false);
  expect(session.getUser()).toBeNull();
  expect(session.getAccessToken()).toBeNull();
});

test('start stores tokens, user and profile', () => {
  session.start({ tokens, user, profile: { bio: 'hi' } });

  expect(session.isAuthenticated()).toBe(true);
  expect(session.getAccessToken()).toBe('access-1');
  expect(session.getRefreshToken()).toBe('refresh-1');
  expect(session.getUser()).toEqual(user);
  expect(session.getProfile()).toEqual({ bio: 'hi' });
});

test('setTokens keeps the refresh token when the server did not rotate it', () => {
  session.start({ tokens, user });

  session.setTokens({ access: 'access-2' });
  expect(session.getAccessToken()).toBe('access-2');
  expect(session.getRefreshToken()).toBe('refresh-1');

  session.setTokens({ access: 'access-3', refresh: 'refresh-2' });
  expect(session.getRefreshToken()).toBe('refresh-2');
});

test('clear forgets everything', () => {
  session.start({ tokens, user, profile: {} });

  session.clear();

  expect(session.isAuthenticated()).toBe(false);
  expect(session.getUser()).toBeNull();
  expect(window.localStorage.getItem('refresh_token')).toBeNull();
});

test('subscribers are told about every change and can unsubscribe', () => {
  const listener = jest.fn();
  const unsubscribe = session.subscribe(listener);

  session.start({ tokens, user });
  session.setTokens({ access: 'access-2' });
  session.clear();
  expect(listener).toHaveBeenCalledTimes(3);

  unsubscribe();
  session.start({ tokens, user });
  expect(listener).toHaveBeenCalledTimes(3);
});

test('the snapshot only changes when the session does', () => {
  session.start({ tokens, user });
  const first = session.getSnapshot();

  expect(session.getSnapshot()).toBe(first);
  session.setTokens({ access: 'access-2' });
  expect(session.getSnapshot()).not.toBe(first);
});

test('a corrupt stored user is treated as logged out user data', () => {
  window.localStorage.setItem('access_token', 'a');
  window.localStorage.setItem('refresh_token', 'r');
  window.localStorage.setItem('user', '{not json');
  session.setTokens({ access: 'a', refresh: 'r' });

  expect(session.getUser()).toBeNull();
});
