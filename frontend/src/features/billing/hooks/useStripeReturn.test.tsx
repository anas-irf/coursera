import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { verifySession } from '../api';
import { useStripeReturn } from './useStripeReturn';

jest.mock('../api');

const onActivated = jest.fn();

function Probe() {
  const { welcome } = useStripeReturn({ onActivated });
  const location = useLocation();
  return (
    <div>
      <span data-testid="welcome">{String(welcome)}</span>
      <span data-testid="search">{location.search}</span>
    </div>
  );
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
});

test('a paid session is verified once, the url is cleaned and the welcome is shown', async () => {
  jest.mocked(verifySession).mockResolvedValue({
    message: 'Subscription created successfully',
    has_subscription: true,
  });

  renderAt('/student?success=true&plan=yearly&session_id=cs_test_1');

  await waitFor(() => expect(screen.getByTestId('welcome')).toHaveTextContent('true'));
  expect(verifySession).toHaveBeenCalledTimes(1);
  expect(verifySession).toHaveBeenCalledWith('cs_test_1');
  expect(screen.getByTestId('search')).toHaveTextContent('');
  expect(onActivated).toHaveBeenCalledTimes(1);
});

test('an unpaid session shows nothing', async () => {
  jest.mocked(verifySession).mockResolvedValue({
    message: 'Session not paid yet',
    has_subscription: false,
    payment_status: 'unpaid',
  });

  renderAt('/student?success=true&plan=monthly&session_id=cs_test_2');

  await waitFor(() => expect(verifySession).toHaveBeenCalled());
  expect(screen.getByTestId('welcome')).toHaveTextContent('false');
  expect(onActivated).not.toHaveBeenCalled();
});

test('a failing verification still welcomes the member (the webhook may have run)', async () => {
  jest.mocked(verifySession).mockRejectedValue(new Error('boom'));

  renderAt('/student?success=true&plan=yearly&session_id=cs_test_3');

  await waitFor(() => expect(screen.getByTestId('welcome')).toHaveTextContent('true'));
});

test('other urls are left alone', () => {
  renderAt('/student?tab=1');

  expect(verifySession).not.toHaveBeenCalled();
  expect(screen.getByTestId('search')).toHaveTextContent('?tab=1');
});
