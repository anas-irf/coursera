import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosResponse } from 'axios';
import { MemoryRouter } from 'react-router-dom';

import { QueryProvider } from '../../shared/query/QueryProvider';
import { createQueryClient } from '../../shared/query/client';
import * as api from './api';
import NotificationDropdown from './components/NotificationDropdown';
import NotificationsPage from './pages/NotificationsPage';
import type { AppNotification, MarkReadResponse } from './types';

jest.mock('./api');

const make = (id: number, read = false): AppNotification => ({
  id,
  type: 'system',
  title: `Title ${id}`,
  message: `Message ${id}`,
  is_read: read,
  created_at: new Date().toISOString(),
  read_at: null,
  action_url: null,
});

let rows: AppNotification[];

beforeEach(() => {
  rows = [make(1), make(2), make(3, true)];
  jest.mocked(api.unreadCount).mockImplementation(async () => rows.filter((n) => !n.is_read).length);
  jest.mocked(api.list).mockImplementation(async () => rows.map((n) => ({ ...n })));
  jest.mocked(api.markRead).mockImplementation(async (id) => {
    rows = rows.map((n) => (n.id === id ? { ...n, is_read: true } : n));
    return { data: { message: 'Notification marked as read' } } as AxiosResponse<MarkReadResponse>;
  });
  jest.mocked(api.markAllRead).mockImplementation(async (ids) => {
    rows = rows.map((n) => (!ids || ids.includes(n.id) ? { ...n, is_read: true } : n));
    return { marked_read: 1 };
  });
});

function renderBoth() {
  return render(
    <QueryProvider client={createQueryClient()}>
      <MemoryRouter>
        <NotificationDropdown viewAllPath="/notifications" />
        <NotificationsPage />
      </MemoryRouter>
    </QueryProvider>
  );
}

test('the bell shows how many are unread and the page lists them', async () => {
  renderBoth();

  expect(await screen.findByText('2 unread notifications')).toBeInTheDocument();
  expect(await screen.findByText('Title 1')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText('Notifications')).toHaveTextContent('2'));
});

test('reading one on the page updates the bell: one cache, one answer', async () => {
  renderBoth();
  await screen.findByText('Title 1');

  fireEvent.click(screen.getAllByTitle('Mark as read')[0]);

  await waitFor(() => expect(screen.getByLabelText('Notifications')).toHaveTextContent('1'));
  expect(screen.getByText('1 unread notification')).toBeInTheDocument();
  expect(api.markRead).toHaveBeenCalledWith(1);
});

test('mark all as read is one request, not one per notification', async () => {
  renderBoth();
  await screen.findByText('Title 1');

  fireEvent.click(screen.getByRole('button', { name: /Mark all as read/ }));

  await screen.findByText('All caught up!');
  expect(api.markAllRead).toHaveBeenCalledTimes(1);
  expect(api.markRead).not.toHaveBeenCalled();
});

test('a failed load is an error with a retry, not "all caught up"', async () => {
  jest.mocked(api.list).mockRejectedValueOnce({ response: { status: 500, data: { error: 'The server had a problem.' } } });
  jest.mocked(api.list).mockRejectedValueOnce({ response: { status: 500, data: { error: 'The server had a problem.' } } });
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retryDelay: 1 } });
  render(
    <QueryProvider client={client}>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </QueryProvider>
  );

  expect(await screen.findByText('Could not load your notifications')).toBeInTheDocument();
  expect(screen.queryByText('All caught up!')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Title 1')).toBeInTheDocument();
});
