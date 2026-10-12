// The browser session: JWT pair, user and profile, kept in localStorage.
//
// Everything that needs to know who is logged in goes through this module, and
// everything that can change it (login, logout, token refresh, another tab)
// notifies subscribers, so the UI never reads stale storage.
const KEYS = {
  access: 'access_token',
  refresh: 'refresh_token',
  user: 'user',
  profile: 'profile',
};

const listeners = new Set();

const read = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
};

const write = (key, value) => {
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch (error) {
    // storage may be unavailable (private mode, quota); the session is then in-memory only
  }
};

const readJson = (key) => {
  const raw = read(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const build = () => {
  const access = read(KEYS.access);
  const refresh = read(KEYS.refresh);
  return {
    authenticated: Boolean(access && refresh),
    user: readJson(KEYS.user),
    profile: readJson(KEYS.profile),
  };
};

// A snapshot is rebuilt only when something changed, so it can be handed to
// useSyncExternalStore without causing renders.
let snapshot = build();

const publish = () => {
  snapshot = build();
  listeners.forEach((listener) => listener());
};

export const session = {
  getSnapshot: () => snapshot,

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getAccessToken: () => read(KEYS.access),
  getRefreshToken: () => read(KEYS.refresh),
  getUser: () => snapshot.user,
  getProfile: () => snapshot.profile,
  isAuthenticated: () => snapshot.authenticated,

  /** Store the result of a login / signup. */
  start({ tokens, user, profile }) {
    write(KEYS.access, tokens.access);
    write(KEYS.refresh, tokens.refresh);
    write(KEYS.user, JSON.stringify(user));
    write(KEYS.profile, profile ? JSON.stringify(profile) : null);
    publish();
  },

  /** Store the result of a token refresh; the server rotates the refresh token. */
  setTokens({ access, refresh }) {
    write(KEYS.access, access);
    if (refresh) write(KEYS.refresh, refresh);
    publish();
  },

  clear() {
    Object.values(KEYS).forEach((key) => write(key, null));
    publish();
  },
};

// another tab logged in or out
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (event) => {
    if (event.key === null || Object.values(KEYS).includes(event.key)) publish();
  });
}
