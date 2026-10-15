import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { session } from '../shared/lib/session';
import { AuthProvider } from '../shared/auth/AuthProvider';
import type { User } from '../shared/auth/types';
import type { UserType } from '../shared/types';
import { HomeRedirect, RequireAuth, RequireRole } from './guards';

// the guards are about what the session says, not about the network: the server never answers
jest.mock('../shared/auth/api', () => ({
  fetchProfile: jest.fn(() => new Promise(() => {})),
  exchangeLegacyToken: jest.fn(() => new Promise(() => {})),
  login: jest.fn(),
  signup: jest.fn(),
  logout: jest.fn(),
}));

function renderAt(path: string) {
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

const userOf = (userType: UserType) => ({ id: 1, user_type: userType }) as User;
const loginAs = (userType: UserType) => session.start({ user: userOf(userType) });

beforeEach(() => {
  window.localStorage.clear();
  session.reset();
  session.setAnonymous();
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

test('while the server is being asked nobody is sent anywhere', () => {
  // a browser that has a session hint: the provider asks the server and waits for the answer
  window.localStorage.setItem('session_hint', '1');
  session.setUnknown();

  renderAt('/student');

  expect(screen.queryByText('login page')).not.toBeInTheDocument();
  expect(screen.queryByText('student home')).not.toBeInTheDocument();
});

test('an unreachable server is not a signed out user', () => {
  session.start({ user: userOf('student') });
  session.setUnavailable();

  renderAt('/student');

  expect(screen.getByText('We cannot reach the server')).toBeInTheDocument();
  expect(screen.queryByText('login page')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
