import React from 'react';
import { act, render } from '@testing-library/react';

import type { User } from '../auth/types';
import { session } from '../lib/session';
import { createQueryClient } from './client';
import { QueryProvider } from './QueryProvider';

const user = (id: number): User => ({
  id,
  email: `user${id}@example.com`,
  first_name: 'A',
  last_name: 'B',
  user_type: 'student',
  phone_number: null,
  profile_picture: null,
});

afterEach(() => act(() => session.reset()));

test('the cache belongs to whoever is signed in: another account starts from nothing', () => {
  const client = createQueryClient();
  act(() => session.start({ user: user(1) }));
  render(<QueryProvider client={client}><p>app</p></QueryProvider>);
  client.setQueryData(['notifications', 'unread-count'], 4);

  // the same user, new details (the profile form): the cache stays
  act(() => session.update({ user: { ...user(1), first_name: 'Ada' } }));
  expect(client.getQueryData(['notifications', 'unread-count'])).toBe(4);

  // another account (the demo's role switch, a new login)
  act(() => session.start({ user: user(2) }));
  expect(client.getQueryData(['notifications', 'unread-count'])).toBeUndefined();

  client.setQueryData(['notifications', 'unread-count'], 1);
  act(() => session.setAnonymous());
  expect(client.getQueryData(['notifications', 'unread-count'])).toBeUndefined();
});

test('an update while nobody is signed in changes nothing', () => {
  act(() => session.update({ user: user(3) }));

  expect(session.getUser()).toBeNull();
});
