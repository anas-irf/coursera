import React from 'react';
import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import http from '../../shared/api/client';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../shared/ui/Toast';
import CancelMembershipButton from './components/CancelMembershipButton';
import { useSubscription } from './hooks/useSubscription';
import type { SubscriptionStatus } from './types';

jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

// what the status endpoint answers, as far as the screens read it
type StatusAnswer = Partial<SubscriptionStatus>;

const member: StatusAnswer = {
  has_subscription: true,
  can_access_plus_courses: true,
  is_active: true,
  auto_renew: true,
  end_date: '2026-12-01T00:00:00Z',
};

let status: StatusAnswer;

beforeEach(() => {
  jest.clearAllMocks();
  status = member;
  jest.mocked(http.get).mockImplementation(async () => ({ data: status }));
  jest.mocked(http.post).mockImplementation(async () => {
    status = { ...status, auto_renew: false };
    return { data: { message: 'cancelled' } };
  });
});

const renderWith = (ui: ReactElement) =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <ConfirmProvider>{ui}</ConfirmProvider>
      </ToastProvider>
    </QueryProvider>
  );

describe('CancelMembershipButton', () => {
  test('a member who will renew can cancel after confirming, and the button then goes away', async () => {
    renderWith(<CancelMembershipButton />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel membership' }));
    expect(await screen.findByText('Cancel your membership?')).toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();

    // the dialog's own confirm button is the second one with this name
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel membership' })[1]);

    expect(await screen.findByText('Membership cancelled')).toBeInTheDocument();
    expect(http.post).toHaveBeenCalledWith('/billing/subscription/cancel/');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Cancel membership' })).not.toBeInTheDocument());
  });

  test('changing one\'s mind sends nothing', async () => {
    renderWith(<CancelMembershipButton />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel membership' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep my membership' }));

    expect(http.post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel membership' })).toBeInTheDocument();
  });

  test('a refusal is reported with the server message', async () => {
    jest.mocked(http.post).mockRejectedValue({ response: { status: 502, data: { error: 'Stripe is not reachable' } } });
    renderWith(<CancelMembershipButton />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel membership' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel membership' })[1]);

    expect(await screen.findByText('Stripe is not reachable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel membership' })).toBeInTheDocument();
  });

  test.each<[string, StatusAnswer]>([
    ['somebody without a membership', { has_subscription: false, can_access_plus_courses: false }],
    ['a member who already cancelled', { ...member, auto_renew: false }],
  ])('is not offered to %s', async (_, response) => {
    status = response;
    renderWith(<CancelMembershipButton />);

    await waitFor(() => expect(http.get).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Cancel membership' })).not.toBeInTheDocument();
  });
});

describe('useSubscription', () => {
  const Probe = () => {
    const { loading, plan, isPlus, willRenew, accessUntil } = useSubscription();
    if (loading) return <p>loading</p>;
    return <p>{`${plan}|${isPlus}|${willRenew}|${accessUntil}`}</p>;
  };

  test('is one definition of "member" for every screen', async () => {
    renderWith(<Probe />);

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('coursera_plus|true|true|2026-12-01T00:00:00Z')).toBeInTheDocument();
  });

  test('a cancelled member is still Plus until the paid period ends', async () => {
    status = { ...member, auto_renew: false };
    renderWith(<Probe />);

    expect(await screen.findByText('coursera_plus|true|false|2026-12-01T00:00:00Z')).toBeInTheDocument();
  });

  test('somebody without a membership is on the free plan', async () => {
    status = { has_subscription: false, can_access_plus_courses: false };
    renderWith(<Probe />);

    expect(await screen.findByText('free|false|false|null')).toBeInTheDocument();
  });
});
