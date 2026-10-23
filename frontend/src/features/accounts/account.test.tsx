import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import http from '../../shared/api/client';
import type { Identity, Profile, User } from '../../shared/auth/types';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ToastProvider } from '../../shared/ui/Toast';
import AccountPage from './pages/AccountPage';

const mockUpdateIdentity = jest.fn<void, [Identity]>();
let mockUser: User;
let mockProfile: Profile | null;

jest.mock('../../shared/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    profile: mockProfile,
    userType: mockUser.user_type,
    updateIdentity: mockUpdateIdentity,
  }),
}));

jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const mockedGet = jest.mocked(http.get);
const mockedPost = jest.mocked(http.post);
const mockedPatch = jest.mocked(http.patch);

let demoEnabled: boolean;

const student: User = {
  id: 4,
  email: 'ada@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  user_type: 'student',
  phone_number: null,
  profile_picture: null,
  bio: '',
  country: 'United Kingdom',
  city: 'London',
  date_joined: '2026-05-01T10:00:00Z',
};

const renderPage = (extra?: React.ReactNode) =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <AccountPage>{extra}</AccountPage>
      </ToastProvider>
    </QueryProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = student;
  mockProfile = { learning_goals: 'Data projects', interests: ['Python'] };
  demoEnabled = true;
  mockedGet.mockImplementation(async (url) => {
    if (url === '/auth/demo/') {
      return {
        data: {
          enabled: demoEnabled,
          accounts: demoEnabled
            ? [{ role: 'student', email: 'demo.student@example.com', name: 'Demo Student', headline: '' }]
            : [],
        },
      };
    }
    throw new Error(`unexpected GET ${url}`);
  });
});

test('shows who the user is and what the role adds', () => {
  renderPage(<p>membership card</p>);

  expect(screen.getByRole('heading', { level: 1, name: 'Account settings' })).toBeInTheDocument();
  expect(screen.getAllByText('ada@example.com').length).toBeGreaterThan(0);
  expect(screen.getByText('London, United Kingdom')).toBeInTheDocument();
  expect(screen.getByLabelText('Learning goals')).toHaveValue('Data projects');
  expect(screen.queryByLabelText('Expertise')).not.toBeInTheDocument();
  expect(screen.getByText('membership card')).toBeInTheDocument();
  // nothing changed yet: nothing to save
  expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled();
});

test('saves the profile and hands the answer to the session', async () => {
  const saved: Identity = { user: { ...student, first_name: 'Augusta' }, profile: mockProfile };
  mockedPatch.mockResolvedValue({ data: saved });
  renderPage();

  fireEvent.change(screen.getByLabelText('First name'), { target: { value: ' Augusta ' } });
  fireEvent.change(screen.getByLabelText('Interests'), { target: { value: 'Python, Statistics' } });
  expect(screen.getByLabelText('Your interests')).toHaveTextContent(/Python\s*Statistics/);
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

  await waitFor(() => expect(mockUpdateIdentity).toHaveBeenCalledWith(saved));
  expect(mockedPatch).toHaveBeenCalledWith('/auth/profile/', expect.objectContaining({
    first_name: 'Augusta',
    interests: ['Python', 'Statistics'],
    learning_goals: 'Data projects',
  }));
  expect(await screen.findByText('Your profile was saved.')).toBeInTheDocument();
});

test('a field the form or the server refuses is marked, nothing else is said', async () => {
  mockedPatch.mockRejectedValue({ response: { status: 400, data: { city: ['Ensure this field has no more than 100 characters.'] } } });
  renderPage();

  fireEvent.change(screen.getByLabelText('First name'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  expect(screen.getByText('First name is required')).toBeInTheDocument();
  expect(mockedPatch).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'L'.repeat(120) } });
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

  expect(await screen.findByText('Ensure this field has no more than 100 characters.')).toBeInTheDocument();
  expect(screen.getByLabelText('City')).toHaveAttribute('aria-invalid', 'true');
});

test('an instructor edits the teaching details', async () => {
  mockUser = { ...student, user_type: 'instructor', expertise: 'Engines', years_of_experience: 3 };
  mockProfile = { payout_email: '' };
  mockedPatch.mockResolvedValue({ data: { user: mockUser, profile: mockProfile } });
  renderPage();

  expect(screen.getByLabelText('Expertise')).toHaveValue('Engines');
  fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'https://ada.example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

  await waitFor(() => expect(mockedPatch).toHaveBeenCalledWith('/auth/profile/', expect.objectContaining({
    website_url: 'https://ada.example.com',
    years_of_experience: 3,
  })));
});

test('the password changes after the rules are met', async () => {
  demoEnabled = false;
  mockedPost.mockResolvedValue({ data: { message: 'Your password was changed.' } });
  renderPage();
  const form = screen.getByRole('region', { name: 'Password' });

  fireEvent.change(within(form).getByLabelText('New password'), { target: { value: 'short' } });
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
  expect(screen.getByText('Enter your current password')).toBeInTheDocument();
  expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();

  fireEvent.change(within(form).getByLabelText('Current password'), { target: { value: 'Old-pass-1' } });
  fireEvent.change(within(form).getByLabelText('New password'), { target: { value: 'New-pass-12' } });
  fireEvent.change(within(form).getByLabelText('Confirm new password'), { target: { value: 'New-pass-12' } });
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

  await waitFor(() => expect(mockedPost).toHaveBeenCalledWith('/auth/password/', {
    current_password: 'Old-pass-1',
    new_password: 'New-pass-12',
  }));
  expect(await screen.findByText('Use the new password the next time you sign in.')).toBeInTheDocument();
  expect(within(form).getByLabelText('Current password')).toHaveValue('');
});

test('a wrong current password is said next to it', async () => {
  demoEnabled = false;
  mockedPost.mockRejectedValue({ response: { status: 400, data: { current_password: ['Your current password is not right.'] } } });
  renderPage();
  const form = screen.getByRole('region', { name: 'Password' });

  fireEvent.change(within(form).getByLabelText('Current password'), { target: { value: 'Wrong-pass-1' } });
  fireEvent.change(within(form).getByLabelText('New password'), { target: { value: 'New-pass-12' } });
  fireEvent.change(within(form).getByLabelText('Confirm new password'), { target: { value: 'New-pass-12' } });
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

  expect(await screen.findByText('Your current password is not right.')).toBeInTheDocument();
});

test('a shared demo account keeps its password', async () => {
  mockUser = { ...student, email: 'demo.student@example.com' };
  renderPage();

  expect(await screen.findByText('This is a shared demo account')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();
});
