// The browser session.
//
// The tokens are HttpOnly cookies: scripts (this one, and any that got onto the page) cannot
// read them, and this module never sees them.  What it keeps, in memory, is who is signed in
// and where the session stands:
//
//   unknown       the app has not asked the server yet (a spinner, not the login page)
//   authenticated a user is signed in
//   anonymous     nobody is signed in
//   unavailable   the server could not be reached: the session is not known to be over
//
// The only thing persisted is a *hint* that this browser has a session, which keeps a visitor
// who never signed in from asking the server on every visit and tells other tabs about a
// login or a logout (``storage`` events).
//
// Everything that needs to know who is signed in goes through this module, and everything that
// can change it (login, logout, a failed refresh, another tab) notifies subscribers.
import type { Profile, SessionSnapshot, SessionStatus, User } from '../auth/types';

export const STATUS: { readonly [K in SessionStatus]: K } = {
  unknown: 'unknown',
  authenticated: 'authenticated',
  anonymous: 'anonymous',
  unavailable: 'unavailable',
};

const HINT_KEY = 'session_hint';
// what the release before cookies kept in localStorage
const LEGACY_KEYS = ['access_token', 'refresh_token', 'user', 'profile'];

type Listener = () => void;

interface SessionState {
  status: SessionStatus;
  user: User | null;
  profile: Profile | null;
}

const listeners = new Set<Listener>();

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
};

const write = (key: string, value: string | null | undefined): void => {
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch (error) {
    // storage may be unavailable (private mode, quota): the session still works for this tab
  }
};

let state: SessionState = { status: STATUS.unknown, user: null, profile: null };

const build = (): SessionSnapshot => ({
  status: state.status,
  authenticated: state.status === STATUS.authenticated,
  user: state.user,
  profile: state.profile,
});

// A snapshot is rebuilt only when something changed, so it can be handed to
// useSyncExternalStore without causing renders.
let snapshot = build();

const set = (next: Partial<SessionState>): void => {
  state = { ...state, ...next };
  snapshot = build();
  listeners.forEach((listener) => listener());
};

export const session = {
  getSnapshot: (): SessionSnapshot => snapshot,

  subscribe(listener: Listener): () => boolean {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getStatus: (): SessionStatus => snapshot.status,
  getUser: (): User | null => snapshot.user,
  getProfile: (): Profile | null => snapshot.profile,
  isAuthenticated: (): boolean => snapshot.authenticated,

  /** This browser signed in before (and has not signed out): worth asking the server about. */
  hasHint: (): boolean => Boolean(read(HINT_KEY)),

  /** A user signed in (login, or the server confirmed the cookie session on boot). */
  start({ user, profile }: { user: User; profile?: Profile | null }): void {
    write(HINT_KEY, String(Date.now()));
    set({ status: STATUS.authenticated, user, profile: profile || null });
  },

  /** Nobody is signed in (logout, an expired session, another tab signed out). */
  setAnonymous(): void {
    write(HINT_KEY, null);
    set({ status: STATUS.anonymous, user: null, profile: null });
  },

  /** The server could not be asked: keep what the page shows, offer a retry. */
  setUnavailable(): void {
    set({ status: STATUS.unavailable });
  },

  /** Ask the server again (the retry of the "cannot reach the server" screen, another tab's login). */
  setUnknown(): void {
    set({ status: STATUS.unknown });
  },

  /** The refresh token the release before cookies left in localStorage, if any. */
  legacyRefreshToken: (): string | null => read('refresh_token'),

  /** Forget what the release before cookies kept (tokens, user, profile). */
  dropLegacy(): void {
    LEGACY_KEYS.forEach((key) => write(key, null));
  },

  /** Back to the very beginning (tests). */
  reset(): void {
    write(HINT_KEY, null);
    LEGACY_KEYS.forEach((key) => write(key, null));
    set({ status: STATUS.unknown, user: null, profile: null });
  },
};

// another tab signed in or out
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key !== HINT_KEY && event.key !== null) return;
    if (event.newValue) {
      if (snapshot.status !== STATUS.authenticated) set({ status: STATUS.unknown });
    } else if (snapshot.status === STATUS.authenticated) {
      set({ status: STATUS.anonymous, user: null, profile: null });
    }
  });
}
