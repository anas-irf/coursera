import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { session } from '../shared/lib/session';
import { AuthProvider } from './AuthProvider';
import { HomeRedirect, RequireAuth, RequireRole } from './guards';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route element={<RequireAuth />}>
            <Route element={<RequireRole role="student" />}>
              <Route path="/student" element={<p>student home</p>} />
            </Route>
            <Route element={<RequireRole role="instructor" />}>
              <Route path="/instructor" element={<p>instructor home</p>} />
            </Route>
          </Route>
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

const loginAs = (userType) =>
  session.start({
    tokens: { access: 'a', refresh: 'r' },
    user: { id: 1, user_type: userType },
  });

beforeEach(() => {
  window.localStorage.clear();
  session.clear();
});

test('visitors are sent to the login page', () => {
  renderAt('/student');

  expect(screen.getByText('login page')).toBeInTheDocument();
});

test('a user may open the pages of their own role', () => {
  loginAs('student');

  renderAt('/student');

  expect(screen.getByText('student home')).toBeInTheDocument();
});

test('a user is sent home from the pages of another role', () => {
  loginAs('student');

  renderAt('/instructor');

  expect(screen.getByText('student home')).toBeInTheDocument();
  expect(screen.queryByText('instructor home')).not.toBeInTheDocument();
});

test('unknown paths lead to the home of the user', () => {
  loginAs('instructor');

  renderAt('/nowhere');

  expect(screen.getByText('instructor home')).toBeInTheDocument();
});
