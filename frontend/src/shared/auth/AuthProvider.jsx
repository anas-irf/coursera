import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore,
} from 'react';

import * as accountsApi from './api';
import { restoreSession } from './restore';
import { session } from '../lib/session';

const AuthContext = createContext(null);

/**
 * Who is signed in.  The state lives in the session store, so a refresh that fails, a logout in
 * another tab or an expired session all show up here without any component polling.
 *
 * The tokens are HttpOnly cookies: on start (and whenever the status goes back to "unknown",
 * e.g. after another tab signed in) the provider asks the server who the cookies belong to.
 */
export function AuthProvider({ children }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);

  useEffect(() => {
    if (snapshot.status === 'unknown') restoreSession();
  }, [snapshot.status]);

  const login = useCallback(async (email, password) => {
    const data = await accountsApi.login(email, password);
    session.start({ user: data.user, profile: data.profile });
    return data;
  }, []);

  // Signing up does not log the user in: they are sent to the login form.
  const signup = useCallback((payload) => accountsApi.signup(payload), []);

  const logout = useCallback(async () => {
    try {
      await accountsApi.logout(session.legacyRefreshToken());
    } catch (error) {
      // the session ends here whether or not the server could blacklist the token
    }
    session.dropLegacy();
    session.setAnonymous();
  }, []);

  const retry = useCallback(() => session.setUnknown(), []);

  const value = useMemo(
    () => ({
      status: snapshot.status,
      user: snapshot.user,
      profile: snapshot.profile,
      userType: snapshot.user ? snapshot.user.user_type : null,
      isAuthenticated: snapshot.authenticated,
      login,
      signup,
      logout,
      retry,
    }),
    [snapshot, login, signup, logout, retry]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
