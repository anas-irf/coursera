import React from 'react';
import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import http from '../../shared/api/client';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../shared/ui/Toast';
import MembershipCard from './components/MembershipCard';
import PlusSidebarCard from './components/PlusSidebarCard';
import PlusWelcomeDialog from './components/PlusWelcomeDialog';
import CheckoutPage from './pages/CheckoutPage';
import type { CheckoutData, SubscriptionStatus } from './types';

jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const mockedGet = jest.mocked(http.get);
const mockedPost = jest.mocked(http.post);

const FEATURES = { unlimited_courses: true, certificate_included: true, download_enabled: true };

const checkout: CheckoutData = {
  student: { name: 'Demo Student', email: 'demo@example.com', user_type: 'student' },
  subscription: { has_subscription: false, type: null, status: 'none', is_active: false, end_date: null },
  plans: [
    {
      id: 'monthly', name: 'Coursera Plus Monthly', description: 'Monthly billing', price: 49.99,
      billing_cycle: 'monthly', billing_cycle_display: 'Monthly', features: FEATURES,
    },
    {
      id: 'yearly', name: 'Coursera Plus Annual', description: 'Annual billing', price: 399.99,
      billing_cycle: 'yearly', billing_cycle_display: 'Yearly', features: FEATURES,
    },
  ],
  currency: 'USD',
  savings: { yearly_savings_amount: 199.89, yearly_savings_percentage: 33 },
  payment_methods: [],
};

const nobody: SubscriptionStatus = {
  has_subscription: false, status: 'none', subscription_type: null, is_active: false, can_access_plus_courses: false,
  start_date: null, end_date: null, auto_renew: false, next_billing_date: null,
};

const member: SubscriptionStatus = {
  has_subscription: true, status: 'active', subscription_type: 'monthly', is_active: true,
  can_access_plus_courses: true, start_date: '2026-09-01T00:00:00Z', end_date: '2026-12-01T12:00:00Z',
  auto_renew: true, next_billing_date: '2026-12-01T12:00:00Z',
};

let checkoutAnswer: CheckoutData | Error;
let statusAnswer: SubscriptionStatus;

beforeEach(() => {
  jest.clearAllMocks();
  checkoutAnswer = checkout;
  statusAnswer = nobody;
  mockedGet.mockImplementation(async (url) => {
    if (url === '/billing/checkout/') {
      if (checkoutAnswer instanceof Error) throw checkoutAnswer;
      return { data: checkoutAnswer };
    }
    if (url === '/billing/subscription/') return { data: statusAnswer };
    throw new Error(`unexpected GET ${url}`);
  });
});

const renderWith = (ui: ReactElement) =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </QueryProvider>
  );

const plan = (name: RegExp) => screen.getByRole('radio', { name });

describe('the checkout page', () => {
  test('offers both plans with the yearly one chosen and what it saves', async () => {
    renderWith(<CheckoutPage />);

    const yearly = await screen.findByRole('radio', { name: /Annual plan/ });
    expect(yearly).toHaveAttribute('aria-checked', 'true');
    expect(plan(/Monthly plan/)).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Save 33%')).toBeInTheDocument();
    expect(screen.getByText('$33.33 a month, billed yearly')).toBeInTheDocument();
    expect(screen.getByText('Coursera Plus Annual')).toBeInTheDocument();
  });

  test('a plan is chosen with a click or with the arrow keys', async () => {
    renderWith(<CheckoutPage />);
    await screen.findByRole('radio', { name: /Annual plan/ });

    fireEvent.click(plan(/Monthly plan/));
    expect(plan(/Monthly plan/)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Coursera Plus Monthly')).toBeInTheDocument();

    fireEvent.keyDown(plan(/Monthly plan/), { key: 'ArrowRight' });
    expect(plan(/Annual plan/)).toHaveAttribute('aria-checked', 'true');
    expect(plan(/Annual plan/)).toHaveFocus();

    fireEvent.keyDown(plan(/Annual plan/), { key: 'ArrowLeft' });
    fireEvent.keyDown(plan(/Monthly plan/), { key: ' ' });
    expect(plan(/Monthly plan/)).toHaveAttribute('aria-checked', 'true');
  });

  test('the chosen plan is what the Stripe session is asked for, and a refusal is said', async () => {
    mockedPost.mockRejectedValue({ response: { status: 503, data: { error: 'Payments are not configured.' } } });
    renderWith(<CheckoutPage />);
    await screen.findByRole('radio', { name: /Annual plan/ });

    fireEvent.click(screen.getByRole('button', { name: /Continue to secure checkout/ }));

    expect(await screen.findByText('Payments are not configured.')).toBeInTheDocument();
    expect(http.post).toHaveBeenCalledWith('/billing/checkout/session/', { plan_id: 'yearly' });
  });

  test('a session without a payment page is not followed', async () => {
    mockedPost.mockResolvedValue({ data: { checkout_url: '', session_id: 'cs_1' } });
    renderWith(<CheckoutPage />);
    await screen.findByRole('radio', { name: /Annual plan/ });

    fireEvent.click(plan(/Monthly plan/));
    fireEvent.click(screen.getByRole('button', { name: /Continue to secure checkout/ }));

    expect(await screen.findByText('Failed to create checkout session. Please try again.')).toBeInTheDocument();
    expect(http.post).toHaveBeenCalledWith('/billing/checkout/session/', { plan_id: 'monthly' });
  });

  test('a member is not sold the membership again', async () => {
    checkoutAnswer = {
      ...checkout,
      subscription: { has_subscription: true, type: 'monthly', status: 'active', is_active: true, end_date: member.end_date },
    };
    statusAnswer = member;
    renderWith(<CheckoutPage />);

    expect(await screen.findByText("You're already a Plus member!")).toBeInTheDocument();
    expect(await screen.findByText(/^Renews on /)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Cancel membership' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  test('checkout data that could not be loaded is an error with a retry', async () => {
    checkoutAnswer = Object.assign(new Error('Request failed with status code 500'), {
      response: { status: 500, data: { error: 'The server had a problem.' } },
    });
    renderWith(<CheckoutPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to load checkout data');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('the membership in the navigation and the account', () => {
  test('somebody without Plus is invited to upgrade', async () => {
    renderWith(
      <>
        <PlusSidebarCard />
        <MembershipCard />
      </>
    );

    expect(await screen.findByText('Unlock every Plus course')).toBeInTheDocument();
    expect(await screen.findByText('Free plan')).toBeInTheDocument();
    screen.getAllByRole('link', { name: 'Upgrade to Plus' }).forEach((link) =>
      expect(link).toHaveAttribute('href', '/student/checkout'));
  });

  test('a member sees the plan and when it renews', async () => {
    statusAnswer = member;
    renderWith(
      <>
        <PlusSidebarCard />
        <MembershipCard />
      </>
    );

    expect(await screen.findByText('Coursera Plus Monthly')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getAllByText(/^Renews on /).length).toBe(2);
    expect(screen.getByRole('button', { name: 'Cancel membership' })).toBeInTheDocument();
  });

  test('a cancelled member keeps Plus until the end of the paid period', async () => {
    statusAnswer = { ...member, status: 'cancelled', auto_renew: false };
    renderWith(<MembershipCard />);

    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText(/It will not renew\. You keep Plus until /)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel membership' })).not.toBeInTheDocument();
  });

  test('a lapsed membership says it has ended', async () => {
    statusAnswer = { ...member, status: 'expired', is_active: false, can_access_plus_courses: false, auto_renew: false };
    renderWith(<MembershipCard />);

    expect(await screen.findByText(/Your Plus membership has ended/)).toBeInTheDocument();
  });
});

test('the welcome after a payment closes with its button', async () => {
  const onClose = jest.fn();
  render(<PlusWelcomeDialog onClose={onClose} />);

  const dialog = screen.getByRole('dialog', { name: 'Welcome to Coursera Plus' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Start learning' }));

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});
