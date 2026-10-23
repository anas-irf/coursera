import React, { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, Compass, Crown, Lock, ShieldCheck, Sparkles } from 'lucide-react';

import { errorMessage } from '../../../shared/api/errors';
import { BRAND } from '../../../shared/brand';
import { cn } from '../../../shared/lib/cn';
import { formatMoney } from '../../../shared/lib/money';
import { formatDate } from '../../../shared/lib/time';
import { Badge } from '../../../shared/ui/Badge';
import { Button, ButtonLink, buttonClasses } from '../../../shared/ui/Button';
import { Card, CardBody, CardHeader } from '../../../shared/ui/Card';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useToast } from '../../../shared/ui/Toast';
import CancelMembershipButton from '../components/CancelMembershipButton';
import { useCheckoutData, useCreateCheckoutSession } from '../hooks/useCheckout';
import { useSubscription } from '../hooks/useSubscription';
import type { BillingCycle, Plan } from '../types';

// what a Coursera Plus membership gives, as far as the platform delivers it
const BENEFITS = [
  `Unlimited access to every ${BRAND.plus} course`,
  'A shareable certificate when you complete and pass a course',
  'Your progress, grades and achievements across all your courses',
  'Cancel anytime: Plus stays active until the end of the period you paid for',
];

const PERIOD: Record<BillingCycle, string> = { monthly: 'month', yearly: 'year' };

interface PlanOptionProps {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  /** "Save 33%" on the yearly plan. */
  savings?: number;
  optionRef: (element: HTMLDivElement | null) => void;
}

/** A plan of the radio group: its price, its period and what it saves. */
const PlanOption = ({ plan, selected, onSelect, onKeyDown, savings, optionRef }: PlanOptionProps) => {
  const yearly = plan.billing_cycle === 'yearly';
  return (
    <div
      ref={optionRef}
      role="radio"
      aria-checked={selected}
      aria-label={`${yearly ? 'Annual' : 'Monthly'} plan, ${formatMoney(plan.price)} per ${PERIOD[plan.billing_cycle]}`}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        'relative flex cursor-pointer flex-col rounded-2xl border bg-surface p-5 shadow-card transition-all sm:p-6',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        selected ? 'border-primary ring-1 ring-primary' : 'border-line hover:border-line-strong'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-fg">{yearly ? 'Annual Plan' : 'Monthly Plan'}</p>
          <p className="mt-0.5 text-xs text-fg-subtle">{yearly ? 'One payment a year' : 'Pay monthly, cancel anytime'}</p>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            selected ? 'border-primary bg-primary text-primary-contrast' : 'border-line-strong'
          )}
        >
          {selected && <Check size={12} strokeWidth={3} />}
        </span>
      </div>

      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-fg tabular-nums sm:text-4xl">{formatMoney(plan.price)}</span>
        <span className="text-sm text-fg-muted">/ {PERIOD[plan.billing_cycle]}</span>
      </p>
      <p className="mt-1 min-h-[1.25rem] text-sm text-fg-muted">
        {yearly ? `${formatMoney(plan.price / 12)} a month, billed yearly` : 'Billed every month'}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {yearly && savings ? (
          <>
            <Badge tone="success">{`Save ${savings}%`}</Badge>
            <Badge tone="plus" icon={Sparkles}>Best value</Badge>
          </>
        ) : null}
        {!yearly && <Badge>Flexible</Badge>}
      </div>
    </div>
  );
};

const CheckoutPage = () => {
  const toast = useToast();
  const membership = useSubscription();
  const checkout = useCheckoutData();
  const createSession = useCreateCheckoutSession();
  const [selectedPlan, setSelectedPlan] = useState<BillingCycle>('yearly'); // Default to yearly for savings
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const processing = createSession.isPending;

  const handleProceedToCheckout = async () => {
    try {
      const session = await createSession.mutateAsync(selectedPlan);
      if (!session.checkout_url) {
        throw new Error('No checkout URL received from server');
      }
      // Stripe hosts the payment page
      window.location.href = session.checkout_url;
    } catch (err) {
      toast.error(
        errorMessage(err, 'Failed to create checkout session. Please try again.'),
        'Checkout Failed'
      );
    }
  };

  const header = (
    <PageHeader
      eyebrow={BRAND.plus}
      title={`Upgrade to ${BRAND.plus}`}
      description="Unlock every Plus course with one membership. Choose the plan that works best for you."
    />
  );

  if (checkout.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <PageSpinner className="h-72" />
      </div>
    );
  }

  if (checkout.isError) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <ErrorState
            title="Unable to load checkout data"
            error={checkout.error}
            onRetry={() => checkout.refetch()}
          />
        </Card>
      </div>
    );
  }

  const checkoutData = checkout.data;

  // a member does not buy it again
  if (checkoutData.subscription?.has_subscription && checkoutData.subscription?.is_active) {
    return (
      <div className="space-y-6">
        <PageHeader title={BRAND.plus} description="Your membership and what it opens." />
        <Card className="mx-auto max-w-2xl overflow-hidden">
          <div className="relative bg-gradient-to-br from-plus via-brand-700 to-brand-900 px-6 py-10 text-center text-white">
            <div className="bg-dots absolute inset-0 opacity-40" aria-hidden="true" />
            <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              <Crown size={28} aria-hidden="true" />
            </span>
            <h2 className="relative mt-4 text-2xl font-semibold tracking-tight">You&apos;re already a Plus member!</h2>
            <p className="relative mt-1 text-sm text-brand-100">You have access to all Plus courses and features.</p>
          </div>
          <CardBody className="space-y-4 text-center">
            <p className="text-sm text-fg-muted">
              <span className="font-medium text-fg">Current plan:</span>{' '}
              {checkoutData.subscription.type === 'yearly' ? 'Annual' : 'Monthly'}
            </p>
            {membership.accessUntil && (
              <p className="text-sm text-fg-muted">
                {membership.willRenew
                  ? `Renews on ${formatDate(membership.accessUntil)}.`
                  : `Your membership will not renew. You keep Plus until ${formatDate(membership.accessUntil)}.`}
              </p>
            )}
            <div className="flex flex-col-reverse justify-center gap-2 pt-2 sm:flex-row">
              <CancelMembershipButton className={buttonClasses({ variant: 'danger-soft' })} />
              <ButtonLink to="/student/explore" icon={Compass}>Explore Plus courses</ButtonLink>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const plans = (['monthly', 'yearly'] as const)
    .map((cycle) => checkoutData.plans.find((plan) => plan.billing_cycle === cycle))
    .filter((plan): plan is Plan => Boolean(plan));
  const currentPlan = plans.find((plan) => plan.billing_cycle === selectedPlan) || plans[0];
  const savings = checkoutData.savings?.yearly_savings_percentage;

  // the arrow keys move the choice, as in any radio group
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedPlan(plans[index].billing_cycle);
      return;
    }
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + plans.length) % plans.length;
    setSelectedPlan(plans[next].billing_cycle);
    optionRefs.current[next]?.focus();
  };

  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <div role="radiogroup" aria-label="Plan" className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan, index) => (
              <PlanOption
                key={plan.billing_cycle}
                plan={plan}
                selected={currentPlan === plan}
                onSelect={() => setSelectedPlan(plan.billing_cycle)}
                onKeyDown={(event) => onKeyDown(event, index)}
                savings={savings}
                optionRef={(element) => {
                  optionRefs.current[index] = element;
                }}
              />
            ))}
          </div>

          <Card>
            <CardHeader title="What's included in both plans" icon={Sparkles} />
            <CardBody>
              <ul className="grid gap-3 sm:grid-cols-2">
                {BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex gap-3 text-sm text-fg-muted">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-fg">
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="lg:sticky lg:top-24">
            <CardHeader title="Order summary" icon={Crown} />
            <CardBody className="space-y-4">
              {currentPlan ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-fg">{currentPlan.name}</p>
                      <p className="mt-0.5 text-xs text-fg-subtle">{currentPlan.description}</p>
                    </div>
                    <p className="shrink-0 font-semibold text-fg tabular-nums">{formatMoney(currentPlan.price)}</p>
                  </div>
                  <div className="flex items-center justify-between border-t border-line pt-4 text-sm">
                    <span className="text-fg-muted">Due today</span>
                    <span className="text-lg font-semibold text-fg tabular-nums">{formatMoney(currentPlan.price)}</span>
                  </div>
                  <Button size="lg" block icon={Lock} loading={processing} onClick={handleProceedToCheckout}>
                    {processing ? 'Preparing checkout...' : `Continue to secure checkout`}
                  </Button>
                  <p className="flex items-start gap-2 text-xs text-fg-subtle">
                    <ShieldCheck size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                    Payment is handled by Stripe on its own page. Renews every {PERIOD[currentPlan.billing_cycle]} until you cancel.
                  </p>
                </>
              ) : (
                <p className="text-sm text-fg-muted">No plan is on sale right now.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
