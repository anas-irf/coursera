import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthProvider';

const HOME = {
  student: '/student',
  instructor: '/instructor',
  admin: '/admin',
};

/** Landing page of a user type (the login page when nobody is logged in). */
export const homePathFor = (userType) => HOME[userType] || '/login';

/** Renders the nested routes for logged in users, the login page for everybody else. */
export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

/** Renders the nested routes only for ``role``; other roles go to their own home. */
export function RequireRole({ role }) {
  const { userType } = useAuth();

  if (userType !== role) {
    return <Navigate to={homePathFor(userType)} replace />;
  }
  return <Outlet />;
}

/** "/" and unknown paths: send the visitor where they belong. */
export function HomeRedirect() {
  const { isAuthenticated, userType } = useAuth();
  return <Navigate to={isAuthenticated ? homePathFor(userType) : '/login'} replace />;
}

/** Redirect keeping the query string, e.g. the Stripe return parameters. */
export function RedirectKeepingSearch({ to }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
}
