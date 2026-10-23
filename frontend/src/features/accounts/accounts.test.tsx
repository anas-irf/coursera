import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import http from '../../shared/api/client';
import type { DemoAccounts, DemoRole, Identity, SignupPayload, SignupResponse } from '../../shared/auth/types';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import LoginPage from './pages/LoginPage';

const mockLogin = jest.fn<Promise<Identity>, [string, string]>();
const mockLoginAsDemo = jest.fn<Promise<Identity>, [DemoRole]>();
const mockSignup = jest.fn<Promise<SignupResponse>, [SignupPayload]>();

jest.mock('../../shared/auth/AuthProvider', () => ({
  useAuth: () => ({ login: mockLogin, loginAsDemo: mockLoginAsDemo, signup: mockSignup }),
}));

// the demo accounts are asked for through the one HTTP client
jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const mockedGet = jest.mocked(http.get);

const DEMO: DemoAccounts = {
  enabled: true,
  accounts: [
    { role: 'student', email: 'demo.student@example.com', name: 'Demo Student', headline: 'Courses in progress' },
    { role: 'instructor', email: 'demo.instructor@example.com', name: 'Demo Instructor', headline: 'Two courses' },
    { role: 'admin', email: 'demo.admin@example.com', name: 'Demo Admin', headline: 'The approval queue' },
  ],
};

let demo: DemoAccounts;

// what the route guard leaves in the location when it sends a visitor to the login
const renderPage = (state?: { from: { pathname: string } }) =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/student" element={<p>student home</p>} />
          <Route path="/instructor" element={<p>instructor home</p>} />
          <Route path="/admin" element={<p>admin home</p>} />
          <Route path="/student/grades" element={<p>grades</p>} />
        </Routes>
      </MemoryRouter>
    </QueryProvider>
  );

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = (name = 'Log in') => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  jest.clearAllMocks();
  demo = { enabled: false, accounts: [] };
  mockedGet.mockImplementation(async (url) => {
    if (url === '/auth/demo/') return { data: demo };
    throw new Error(`unexpected GET ${url}`);
  });
});

describe('logging in', () => {
  test('asks for an address and a password before anything is sent', () => {
    renderPage();

    fill('Email', 'not-an-address');
    submit();

    expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('sends the user to their own area', async () => {
    mockLogin.mockResolvedValue({ user: { user_type: 'instructor' } } as Identity);
    renderPage();

    fill('Email', 'james@example.com');
    fill('Password', 'whatever');
    submit();

    expect(await screen.findByText('instructor home')).toBeInTheDocument();
    expect(mockLogin).toHaveBeenCalledWith('james@example.com', 'whatever');
  });

  test('sends the user back to the page that asked for the login', async () => {
    mockLogin.mockResolvedValue({ user: { user_type: 'student' } } as Identity);
    renderPage({ from: { pathname: '/student/grades' } });

    fill('Email', 'ada@example.com');
    fill('Password', 'whatever');
    submit();

    expect(await screen.findByText('grades')).toBeInTheDocument();
  });

  test('says why a login failed and stays', async () => {
    mockLogin.mockRejectedValue({ response: { status: 401, data: { error: 'Invalid email or password' } } });
    renderPage();

    fill('Email', 'ada@example.com');
    fill('Password', 'wrong');
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  test('a network failure is said as such', async () => {
    mockLogin.mockRejectedValue(new Error('Network Error'));
    renderPage();

    fill('Email', 'ada@example.com');
    fill('Password', 'whatever');
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Network error. Please check your connection.');
  });

  test('has no buttons that lead nowhere', () => {
    renderPage();

    ['Forgot password?', 'Continue with Google', 'Continue with Facebook', 'Log in with your organization']
      .forEach((name) => expect(screen.queryByRole('button', { name })).not.toBeInTheDocument());
  });

  test('the password can be shown and hidden', () => {
    renderPage();
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));

    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });
});

describe('the demo', () => {
  test('offers one click into each role when the server runs in demo mode', async () => {
    demo = DEMO;
    mockLoginAsDemo.mockResolvedValue({ user: { user_type: 'instructor' } } as Identity);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Explore as Instructor' }));

    expect(await screen.findByText('instructor home')).toBeInTheDocument();
    expect(mockLoginAsDemo).toHaveBeenCalledWith('instructor');
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('says so when a demo account cannot be opened', async () => {
    demo = DEMO;
    mockLoginAsDemo.mockRejectedValue({ response: { status: 404, data: { error: 'Demo sign-in is not available.' } } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Explore as Admin' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Demo sign-in is not available.');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  test('shows nothing of it when the server is not in demo mode', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith('/auth/demo/');
    expect(screen.queryByRole('button', { name: /Explore as/ })).not.toBeInTheDocument();
  });
});

describe('signing up', () => {
  const open = () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
  };

  test('shows the rules and enforces every one of them', () => {
    open();
    fill('First name', 'Ada');
    fill('Last name', 'Lovelace');
    fill('Email', 'ada@example.com');
    fill('Password', 'lowercase1');
    fill('Confirm Password', 'lowercase1');
    fireEvent.click(screen.getByLabelText(/I accept the Terms of Use/));

    expect(screen.getByText('At least 1 capital letter')).toBeInTheDocument();
    submit('Sign up as student');

    expect(screen.getByText('Password must contain a capital letter')).toBeInTheDocument();
    expect(mockSignup).not.toHaveBeenCalled();
  });

  test('creates the account and returns to the login form with the address filled in', async () => {
    mockSignup.mockResolvedValue({} as SignupResponse);
    open();
    fireEvent.click(screen.getByRole('radio', { name: /Instructor/ }));
    fill('First name', 'Ada');
    fill('Last name', 'Lovelace');
    fill('Email', 'ada@example.com');
    fill('Password', 'Analytical1');
    fill('Confirm Password', 'Analytical1');
    fireEvent.click(screen.getByLabelText(/I accept the Terms of Use/));
    submit('Sign up as instructor');

    expect(await screen.findByText('Account created. Please log in.')).toBeInTheDocument();
    expect(mockSignup).toHaveBeenCalledWith(expect.objectContaining({
      email: 'ada@example.com', first_name: 'Ada', last_name: 'Lovelace', user_type: 'instructor',
      confirm_password: 'Analytical1',
    }));
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  test('puts a server complaint next to the field it is about', async () => {
    mockSignup.mockRejectedValue({
      response: { status: 400, data: { email: ['user with this email already exists.'] } },
    });
    open();
    fill('First name', 'Ada');
    fill('Last name', 'Lovelace');
    fill('Email', 'ada@example.com');
    fill('Password', 'Analytical1');
    fill('Confirm Password', 'Analytical1');
    fireEvent.click(screen.getByLabelText(/I accept the Terms of Use/));
    submit('Sign up as student');

    expect(await screen.findByText('user with this email already exists.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });
});
