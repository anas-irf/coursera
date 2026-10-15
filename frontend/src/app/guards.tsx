import React from 'react';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../shared/auth/AuthProvider';
import { homePathFor } from '../shared/auth/paths';
import type { UserType } from '../shared/types';
import { PageSpinner } from '../shared/ui/Spinner';

/** Shown while the server is asked who is signed in, and when it cannot be reached. */
export function SessionGate({ children }: { children?: ReactNode }) {
  const { status, retry } = useAuth();

  if (status === 'unknown') {
    return <PageSpinner className="min-h-screen" />;
  }
  if (status === 'unavailable') {
    // not "signed out": the session may well be fine, so the user is not sent to the login page
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">We cannot reach the server</h2>
          <p className="text-gray-500 mb-4">Check your connection and try again.</p>
          <button
            onClick={retry}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
  return children;
}

/** Renders the nested routes for logged in users, the login page for everybody else. */
export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  return (
    <SessionGate>
      {isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />}
    </SessionGate>
  );
}

/** Renders the nested routes only for ``role``; other roles go to their own home. */
export function RequireRole({ role }: { role: UserType }) {
  const { userType } = useAuth();

  if (userType !== role) {
    return <Navigate to={homePathFor(userType)} replace />;
  }
  return <Outlet />;
}

/** "/" and unknown paths: send the visitor where they belong. */
export function HomeRedirect() {
  const { isAuthenticated, userType } = useAuth();
  return (
    <SessionGate>
      <Navigate to={isAuthenticated ? homePathFor(userType) : '/login'} replace />
    </SessionGate>
  );
}

/** Redirect keeping the query string, e.g. the Stripe return parameters. */
export function RedirectKeepingSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
}
