import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ToastProvider } from '../../shared/ui/Toast';
import * as api from './api';
import MessagesPage from './pages/MessagesPage';
import type { ChatMessage, Conversation, MessagingUser } from './types';

jest.mock('./api');
// the live channels are not what is tested here
jest.mock('./hooks/useReconnectingSocket', () => ({
  useReconnectingSocket: () => ({ status: 'closed', send: () => false }),
}));

const mockedApi = jest.mocked(api);

const serverError = { response: { status: 500, data: { error: 'The server had a problem.' } } };

const yuki: MessagingUser = {
  id: 2,
  first_name: 'Yuki',
  last_name: 'Tanaka',
  name: 'Yuki Tanaka',
  email: 'yuki@example.com',
  user_type: 'student',
  avatar: 'https://ui-avatars.com/api/?name=Yuki+Tanaka',
};

const ravi: MessagingUser = {
  id: 3,
  first_name: 'Ravi',
  last_name: 'Shah',
  name: 'Ravi Shah',
  email: 'ravi@example.com',
  user_type: 'instructor',
  avatar: 'https://ui-avatars.com/api/?name=Ravi+Shah',
};

const conversation: Conversation = {
  id: 'conv-1',
  other_user: yuki,
  last_message: 'Study group on Saturday?',
  last_message_time: '2026-10-01T10:00:00Z',
  last_message_sender: 2,
  unread_count: 0,
  message_count: 1,
};

// a message of the history of the conversation
const message = (id: number, content: string, own = false): ChatMessage => ({
  id,
  content,
  is_own_message: own,
  is_read: true,
  created_at: '2026-10-01T10:00:00Z',
  sender: own ? { id: 1, name: 'Me', user_type: 'instructor' } : { id: 2, name: 'Yuki Tanaka', user_type: 'student' },
});

const renderPage = () =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <MessagesPage />
      </ToastProvider>
    </QueryProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.conversations.mockResolvedValue([conversation]);
  mockedApi.messages.mockResolvedValue([message(1, 'Study group on Saturday?')]);
  mockedApi.markRead.mockResolvedValue({ marked_read: 1, conversation_id: 'conv-1' });
  mockedApi.users.mockResolvedValue([ravi]);
});

test('lists the conversations and opens one with its messages', async () => {
  renderPage();

  fireEvent.click(await screen.findByRole('button', { name: /Yuki Tanaka/ }));

  expect(await screen.findAllByText('Study group on Saturday?')).not.toHaveLength(0);
  expect(api.messages).toHaveBeenCalledWith('conv-1');
  expect(screen.getByLabelText('Message')).toBeInTheDocument();
  // the buttons that did nothing are gone
  expect(screen.queryByRole('button', { name: 'Attach file' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Emoji' })).not.toBeInTheDocument();
});

test('a message that could not be sent is said so and kept in the box', async () => {
  mockedApi.send.mockRejectedValue(serverError);
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: /Yuki Tanaka/ }));
  await screen.findAllByText('Study group on Saturday?');

  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'See you there' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));

  expect(await screen.findByText('Your message could not be sent. Please try again.')).toBeInTheDocument();
  expect(screen.getByLabelText('Message')).toHaveValue('See you there');
});

test('a conversation list that could not be loaded is an error with a retry', async () => {
  mockedApi.conversations.mockRejectedValueOnce(serverError);
  renderPage();

  expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.');
  expect(screen.queryByText('No conversations yet')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

  expect(await screen.findByRole('button', { name: /Yuki Tanaka/ })).toBeInTheDocument();
});

test('a conversation that could not be opened says so', async () => {
  mockedApi.messages.mockRejectedValueOnce(serverError);
  renderPage();

  fireEvent.click(await screen.findByRole('button', { name: /Yuki Tanaka/ }));

  expect(await screen.findByText('This conversation could not be loaded')).toBeInTheDocument();
});

test('the people to talk to are only fetched when the dialog opens, and can be searched', async () => {
  renderPage();
  await screen.findByRole('button', { name: /Yuki Tanaka/ });
  expect(api.users).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
  const dialog = await screen.findByRole('dialog', { name: 'Start New Conversation' });

  expect(await within(dialog).findByText('Ravi Shah')).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Search users'), { target: { value: 'nobody' } });
  expect(within(dialog).getByText('No users found')).toBeInTheDocument();
});

test('the list of people failing is shown in the dialog, not as "No users found"', async () => {
  mockedApi.users.mockRejectedValue(serverError);
  renderPage();
  await screen.findByRole('button', { name: /Yuki Tanaka/ });

  fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
  const dialog = await screen.findByRole('dialog');

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('The list of people could not be loaded');
  expect(within(dialog).queryByText('No users found')).not.toBeInTheDocument();
});
