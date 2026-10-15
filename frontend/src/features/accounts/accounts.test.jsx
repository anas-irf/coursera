import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import LoginPage from './pages/LoginPage';

const mockLogin = jest.fn();
const mockSignup = jest.fn();

jest.mock('../../shared/auth/AuthProvider', () => ({
  useAuth: () => ({ login: mockLogin, signup: mockSignup }),
}));

const renderPage = (state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/student" element={<p>student home</p>} />
        <Route path="/instructor" element={<p>instructor home</p>} />
        <Route path="/student/grades" element={<p>grades</p>} />
      </Routes>
    </MemoryRouter>
  );

const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = (name = 'Log in') => fireEvent.click(screen.getByRole('button', { name, exact: true }));

beforeEach(() => jest.clearAllMocks());

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
    mockLogin.mockResolvedValue({ user: { user_type: 'instructor' } });
    renderPage();

    fill('Email', 'james@example.com');
    fill('Password', 'whatever');
    submit();

    expect(await screen.findByText('instructor home')).toBeInTheDocument();
    expect(mockLogin).toHaveBeenCalledWith('james@example.com', 'whatever');
  });

  test('sends the user back to the page that asked for the login', async () => {
    mockLogin.mockResolvedValue({ user: { user_type: 'student' } });
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

describe('signing up', () => {
  const open = () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Sign up', exact: true }));
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
    mockSignup.mockResolvedValue({});
    open();
    fireEvent.click(screen.getByRole('button', { name: /Instructor/ }));
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
