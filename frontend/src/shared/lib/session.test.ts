import type { User } from '../auth/types';
import { session, STATUS } from './session';

const user = { id: 7, email: 'a@example.com', user_type: 'student' } as User;

beforeEach(() => {
  window.localStorage.clear();
  session.reset();
});

test('starts unknown: the server has not been asked yet', () => {
  expect(session.getStatus()).toBe(STATUS.unknown);
  expect(session.isAuthenticated()).toBe(false);
  expect(session.getUser()).toBeNull();
});

test('start keeps the user and profile in memory and leaves a hint, never a token', () => {
  session.start({ user, profile: { bio: 'hi' } });

  expect(session.isAuthenticated()).toBe(true);
  expect(session.getStatus()).toBe(STATUS.authenticated);
  expect(session.getUser()).toEqual(user);
  expect(session.getProfile()).toEqual({ bio: 'hi' });
  expect(session.hasHint()).toBe(true);

  // nothing about the session that a script could use is persisted
  const stored = Object.keys(window.localStorage);
  expect(stored).toEqual(['session_hint']);
  expect(window.localStorage.getItem('user')).toBeNull();
});

test('setAnonymous forgets the user and the hint', () => {
  session.start({ user, profile: {} });

  session.setAnonymous();

  expect(session.getStatus()).toBe(STATUS.anonymous);
  expect(session.getUser()).toBeNull();
  expect(session.hasHint()).toBe(false);
});

test('unavailable is not signed out', () => {
  session.start({ user });

  session.setUnavailable();

  expect(session.getStatus()).toBe(STATUS.unavailable);
  expect(session.getUser()).toEqual(user);
  expect(session.hasHint()).toBe(true);
});

test('subscribers are told about every change and can unsubscribe', () => {
  const listener = jest.fn();
  const unsubscribe = session.subscribe(listener);

  session.start({ user });
  session.setUnavailable();
  session.setAnonymous();
  expect(listener).toHaveBeenCalledTimes(3);

  unsubscribe();
  session.start({ user });
  expect(listener).toHaveBeenCalledTimes(3);
});

test('the snapshot only changes when the session does', () => {
  session.start({ user });
  const first = session.getSnapshot();

  expect(session.getSnapshot()).toBe(first);
  session.setUnavailable();
  expect(session.getSnapshot()).not.toBe(first);
});

test('what the release before cookies kept in localStorage can be found and dropped', () => {
  window.localStorage.setItem('access_token', 'a');
  window.localStorage.setItem('refresh_token', 'r');
  window.localStorage.setItem('user', '{"id":1}');
  window.localStorage.setItem('profile', '{}');

  expect(session.legacyRefreshToken()).toBe('r');

  session.dropLegacy();

  expect(session.legacyRefreshToken()).toBeNull();
  expect(window.localStorage.getItem('user')).toBeNull();
  expect(window.localStorage.getItem('access_token')).toBeNull();
});

describe('another tab', () => {
  const storage = (newValue: string | null) =>
    window.dispatchEvent(new StorageEvent('storage', { key: 'session_hint', newValue }));

  test('signing out signs this tab out', () => {
    session.start({ user });

    storage(null);

    expect(session.getStatus()).toBe(STATUS.anonymous);
    expect(session.getUser()).toBeNull();
  });

  test('signing in makes this tab ask the server who is signed in', () => {
    session.setAnonymous();

    storage('1715000000000');

    expect(session.getStatus()).toBe(STATUS.unknown);
  });

  test('a tab that is signed in stays so when another one signs in too', () => {
    session.start({ user });

    storage('1715000000000');

    expect(session.getStatus()).toBe(STATUS.authenticated);
  });
});
