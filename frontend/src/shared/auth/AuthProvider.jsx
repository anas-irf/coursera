import React, { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

import * as accountsApi from './api';
import { session } from '../lib/session';

const AuthContext = createContext(null);

/**
 * Who is logged in.  The state lives in the session store (localStorage), so a
 * token refresh that fails, a logout in another tab or an expired session all
 * show up here without any component polling storage.
 */
export function AuthProvider({ children }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);

  const login = useCallback(async (email, password) => {
    const data = await accountsApi.login(email, password);
    session.start({ tokens: data.tokens, user: data.user, profile: data.profile });
    return data;
  }, []);

  // Signing up does not log the user in: they are sent to the login form.
  const signup = useCallback((payload) => accountsApi.signup(payload), []);

  const logout = useCallback(async () => {
    const refresh = session.getRefreshToken();
    try {
      if (refresh) await accountsApi.logout(refresh);
    } catch (error) {
      // the session is cleared whether or not the server could blacklist the token
    }
    session.clear();
  }, []);

  const value = useMemo(
    () => ({
      user: snapshot.user,
      profile: snapshot.profile,
      userType: snapshot.user ? snapshot.user.user_type : null,
      isAuthenticated: snapshot.authenticated,
      login,
      signup,
      logout,
    }),
    [snapshot, login, signup, logout]
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
