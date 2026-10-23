import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';

import * as accountsApi from './api';
import { restoreSession } from './restore';
import { session } from '../lib/session';
import type { UserType } from '../types';
import type { DemoRole, Identity, Profile, SessionStatus, SignupPayload, SignupResponse, User } from './types';

export interface AuthContextValue {
  status: SessionStatus;
  user: User | null;
  profile: Profile | null;
  userType: UserType | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<Identity>;
  /** Sign in as the seeded account of a role (demo mode only). */
  loginAsDemo: (role: DemoRole) => Promise<Identity>;
  signup: (payload: SignupPayload) => Promise<SignupResponse>;
  logout: () => Promise<void>;
  /** The server answered new details of the signed-in user (the profile form). */
  updateIdentity: (identity: Identity) => void;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Who is signed in.  The state lives in the session store, so a refresh that fails, a logout in
 * another tab or an expired session all show up here without any component polling.
 *
 * The tokens are HttpOnly cookies: on start (and whenever the status goes back to "unknown",
 * e.g. after another tab signed in) the provider asks the server who the cookies belong to.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);

  useEffect(() => {
    if (snapshot.status === 'unknown') restoreSession();
  }, [snapshot.status]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await accountsApi.login(email, password);
    session.start({ user: data.user, profile: data.profile });
    return data;
  }, []);

  const loginAsDemo = useCallback(async (role: DemoRole) => {
    const data = await accountsApi.demoLogin(role);
    session.start({ user: data.user, profile: data.profile });
    return data;
  }, []);

  // Signing up does not log the user in: they are sent to the login form.
  const signup = useCallback((payload: SignupPayload) => accountsApi.signup(payload), []);

  const logout = useCallback(async () => {
    try {
      await accountsApi.logout(session.legacyRefreshToken());
    } catch (error) {
      // the session ends here whether or not the server could blacklist the token
    }
    session.dropLegacy();
    session.setAnonymous();
  }, []);

  const updateIdentity = useCallback((identity: Identity) => session.update(identity), []);

  const retry = useCallback(() => session.setUnknown(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: snapshot.status,
      user: snapshot.user,
      profile: snapshot.profile,
      userType: snapshot.user ? snapshot.user.user_type : null,
      isAuthenticated: snapshot.authenticated,
      login,
      loginAsDemo,
      signup,
      logout,
      updateIdentity,
      retry,
    }),
    [snapshot, login, loginAsDemo, signup, logout, updateIdentity, retry]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
