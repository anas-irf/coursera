import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BookOpen, Home } from 'lucide-react';

import http from '../../shared/api/client';
import type { DemoRole, Identity, User } from '../../shared/auth/types';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../shared/ui/Toast';
import AppShell from './AppShell';

const mockLogout = jest.fn<Promise<void>, []>();
const mockLoginAsDemo = jest.fn<Promise<Identity>, [DemoRole]>();
let mockUser: Partial<User>;

jest.mock('../../shared/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: mockUser,
    userType: mockUser.user_type,
    logout: mockLogout,
    loginAsDemo: mockLoginAsDemo,
  }),
}));

jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const mockedGet = jest.mocked(http.get);

const DEMO = {
  enabled: true,
  accounts: [
    { role: 'student', email: 'demo.student@example.com', name: 'Demo Student', headline: '' },
    { role: 'admin', email: 'demo.admin@example.com', name: 'Demo Admin', headline: '' },
  ],
};

const SECTIONS = [
  {
    title: 'Learn',
    items: [
      { to: '/student', label: 'Home', icon: Home, end: true },
      { to: '/student/my-learning', label: 'My Learning', icon: BookOpen, badge: 3 },
    ],
  },
];

const renderShell = (path = '/student/my-learning') =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route
                path="/student/*"
                element={
                  <AppShell
                    roleLabel="Student"
                    sections={SECTIONS}
                    accountPath="/student/account"
                    notificationsPath="/student/notifications"
                    sidebarFooter={<p>footer card</p>}
                  >
                    <p>the page</p>
                  </AppShell>
                }
              />
              <Route path="/admin" element={<p>admin home</p>} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </QueryProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 1, email: 'ada@example.com', first_name: 'Ada', last_name: 'Lovelace', user_type: 'student' };
  mockedGet.mockImplementation(async (url) => {
    if (url === '/auth/demo/') return { data: DEMO };
    if (url === '/notifications/count/') return { data: { unread_count: 2 } };
    throw new Error(`unexpected GET ${url}`);
  });
});

test('the navigation marks the page that is open and the breadcrumb names it', async () => {
  renderShell();

  const nav = screen.getByRole('navigation', { name: 'Main' });
  expect(within(nav).getByRole('link', { name: /My Learning/ })).toHaveAttribute('aria-current', 'page');
  expect(within(nav).getByRole('link', { name: /My Learning/ })).toHaveTextContent('3');
  expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent(/Student\s*My Learning/);
  expect(screen.getByRole('main')).toHaveTextContent('the page');
  expect(screen.getByText('footer card')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications' })).toHaveTextContent('2'));
});

test('on a phone the navigation opens in a drawer that closes again', () => {
  renderShell();

  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  const drawer = screen.getByRole('dialog', { name: 'Navigation' });
  expect(within(drawer).getByRole('link', { name: 'Home' })).toBeInTheDocument();

  fireEvent.click(within(drawer).getByRole('button', { name: 'Close navigation' }));
  expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
});

test('the account menu leads to the settings and logs out after a confirmation', async () => {
  mockLogout.mockResolvedValue();
  renderShell();

  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
  const menu = screen.getByRole('menu', { name: 'Account menu' });
  expect(within(menu).getByText('ada@example.com')).toBeInTheDocument();
  expect(within(menu).getByRole('menuitem', { name: 'Account settings' })).toHaveAttribute('href', '/student/account');

  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Log out' }));
  const dialog = await screen.findByRole('dialog', { name: 'Log out' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Logout' }));

  await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
});

test('the theme can be chosen from the account menu', () => {
  renderShell();

  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
  // outside a theme provider the choice is fixed; the items are still there to be chosen
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));

  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('somebody who is not a demo account sees no role switcher', async () => {
  renderShell();

  await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/auth/demo/'));
  expect(screen.queryByRole('button', { name: 'Switch demo role' })).not.toBeInTheDocument();
});

test('a demo account switches to another role in one click', async () => {
  mockUser = { ...mockUser, email: 'demo.student@example.com' };
  mockLoginAsDemo.mockResolvedValue({ user: { user_type: 'admin' } } as Identity);
  renderShell();

  fireEvent.click(await screen.findByRole('button', { name: 'Switch demo role' }));
  expect(screen.getByRole('menuitemradio', { name: /Student/ })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('menuitemradio', { name: /Admin/ }));

  expect(await screen.findByText('admin home')).toBeInTheDocument();
  expect(mockLoginAsDemo).toHaveBeenCalledWith('admin');
});

test('a failed switch is said and the page stays', async () => {
  mockUser = { ...mockUser, email: 'demo.student@example.com' };
  mockLoginAsDemo.mockRejectedValue({ response: { status: 404, data: { error: 'Demo sign-in is not available.' } } });
  renderShell();

  fireEvent.click(await screen.findByRole('button', { name: 'Switch demo role' }));
  fireEvent.click(screen.getByRole('menuitemradio', { name: /Admin/ }));

  expect(await screen.findByText('Demo sign-in is not available.')).toBeInTheDocument();
  expect(screen.getByRole('main')).toHaveTextContent('the page');
});
