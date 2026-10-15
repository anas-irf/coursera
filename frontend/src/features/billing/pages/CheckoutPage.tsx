import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { Crown, Check, Zap, ChevronRight, Shield } from 'lucide-react';

import { errorMessage } from '../../../shared/api/errors';
import { formatDate } from '../../../shared/lib/time';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useToast } from '../../../shared/ui/Toast';
import CancelMembershipButton from '../components/CancelMembershipButton';
import { useCheckoutData, useCreateCheckoutSession } from '../hooks/useCheckout';
import { useSubscription } from '../hooks/useSubscription';
import type { BillingCycle } from '../types';

// what a Coursera Plus membership gives, as far as the platform delivers it
const BENEFITS = [
  'Unlimited access to every Coursera Plus course',
  'A shareable certificate when you complete and pass a course',
  'Your progress, grades and achievements across all your courses',
  'Cancel anytime: Plus stays active until the end of the period you paid for',
];

type Tone = 'blue' | 'green';

interface PlanCardProps {
  plan: BillingCycle;
  selected: boolean;
  tone: Tone;
  onSelect: (plan: BillingCycle) => void;
  children: ReactNode;
}

/** A selectable plan: a card that behaves as a radio button. */
const PlanCard = ({ plan, selected, tone, onSelect, children }: PlanCardProps) => {
  const tones: Record<Tone, { on: string; off: string }> = {
    blue: {
      on: 'border-blue-500 bg-blue-50 shadow-lg ring-4 ring-blue-200',
      off: 'border-gray-200 hover:border-blue-300 hover:shadow-md',
    },
    green: {
      on: 'border-green-500 bg-green-50 shadow-lg ring-4 ring-green-200',
      off: 'border-gray-200 hover:border-green-300 hover:shadow-md',
    },
  };

  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={() => onSelect(plan)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(plan);
        }
      }}
      className={`relative rounded-2xl border-2 p-8 cursor-pointer transition-all duration-300 transform hover:scale-105 ${
        selected ? tones[tone].on : tones[tone].off
      }`}
    >
      {children}
    </div>
  );
};

const CheckoutPage = () => {
  const toast = useToast();
  const membership = useSubscription();
  const checkout = useCheckoutData();
  const createSession = useCreateCheckoutSession();
  const [selectedPlan, setSelectedPlan] = useState<BillingCycle>('yearly'); // Default to yearly for savings

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

  if (checkout.isPending) {
    return <PageSpinner className="min-h-96" color="border-blue-600" />;
  }

  if (checkout.isError) {
    return (
      <ErrorState
        title="Unable to load checkout data"
        error={checkout.error}
        onRetry={() => checkout.refetch()}
      />
    );
  }

  const checkoutData = checkout.data;

  // Check if user already has subscription
  if (checkoutData.subscription?.has_subscription && checkoutData.subscription?.is_active) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Crown className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">You're already a Plus member!</h2>
        <p className="text-gray-600 mb-6">
          You have access to all Plus courses and features.
        </p>
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6">
          <p className="text-sm text-gray-700">
            <strong>Current Plan:</strong> {checkoutData.subscription.type === 'yearly' ? 'Annual' : 'Monthly'}
          </p>
          {membership.accessUntil && (
            <p className="text-sm text-gray-700 mt-2">
              {membership.willRenew
                ? `Renews on ${formatDate(membership.accessUntil)}`
                : `Your membership will not renew. You keep Plus until ${formatDate(membership.accessUntil)}.`}
            </p>
          )}
        </div>
        <CancelMembershipButton className="mt-6 text-sm text-red-600 hover:text-red-800 underline" />
      </div>
    );
  }

  const monthlyPlan = checkoutData.plans.find(p => p.billing_cycle === 'monthly');
  const yearlyPlan = checkoutData.plans.find(p => p.billing_cycle === 'yearly');
  const currentPlan = selectedPlan === 'yearly' ? yearlyPlan : monthlyPlan;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <Crown className="mx-auto h-16 w-16 text-blue-600 mb-6" />
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Upgrade to Coursera Plus
        </h1>
        <p className="text-xl text-gray-600 mb-2">
          Unlock every Plus course with one membership
        </p>
        <p className="text-gray-500">
          Choose the plan that works best for you
        </p>
      </div>

      {/* Plan Selection */}
      <div role="radiogroup" aria-label="Plan" className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Monthly Plan */}
        {monthlyPlan && (
          <PlanCard plan="monthly" selected={selectedPlan === 'monthly'} tone="blue" onSelect={setSelectedPlan}>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Monthly Plan</h3>
              <div className="mb-4">
                <span className="text-5xl font-bold text-gray-900">${monthlyPlan.price}</span>
                <span className="text-xl text-gray-500 ml-2">/ month</span>
              </div>
              <p className="text-gray-600 mb-6">Perfect for trying out Coursera Plus</p>
              <div className="space-y-3">
                <div className="flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">Pay monthly, cancel anytime</span>
                </div>
                <div className="flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">All Plus features included</span>
                </div>
              </div>
            </div>
            {selectedPlan === 'monthly' && (
              <div className="absolute top-4 right-4">
                <div className="bg-blue-600 text-white text-sm font-medium px-3 py-1 rounded-full">
                  Selected
                </div>
              </div>
            )}
          </PlanCard>
        )}

        {/* Yearly Plan */}
        {yearlyPlan && (
          <PlanCard plan="yearly" selected={selectedPlan === 'yearly'} tone="green" onSelect={setSelectedPlan}>
            <div className="absolute top-4 right-4">
              <div className="bg-green-100 text-green-800 text-sm font-bold px-3 py-2 rounded-full">
                Save {checkoutData.savings?.yearly_savings_percentage}%
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Annual Plan</h3>
              <div className="mb-2">
                <span className="text-5xl font-bold text-gray-900">${yearlyPlan.price}</span>
                <span className="text-xl text-gray-500 ml-2">/ year</span>
              </div>
              <div className="mb-4">
                <span className="text-lg text-green-600 font-semibold">
                  Save ${checkoutData.savings?.yearly_savings_amount} vs monthly
                </span>
              </div>
              <p className="text-gray-600 mb-6">Best value - most popular choice!</p>
              <div className="space-y-3">
                <div className="flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">One payment for the whole year</span>
                </div>
                <div className="flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">All Plus features included</span>
                </div>
              </div>
            </div>
            {selectedPlan === 'yearly' && (
              <div className="absolute top-4 left-4">
                <div className="bg-green-600 text-white text-sm font-medium px-3 py-1 rounded-full">
                  Selected
                </div>
              </div>
            )}
          </PlanCard>
        )}
      </div>

      {/* What's Included */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 mb-12">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center flex items-center justify-center">
          <Zap className="h-6 w-6 text-blue-600 mr-3" />
          What's Included in Both Plans
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          {BENEFITS.map((benefit) => (
            <div key={benefit} className="flex items-center">
              <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-gray-700">{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Proceed to Checkout Button */}
      <div className="text-center">
        <button
          onClick={handleProceedToCheckout}
          disabled={processing}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-12 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg"
        >
          {processing ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
              Preparing Checkout...
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <Shield className="h-6 w-6 mr-3" />
              Proceed to Secure Checkout - ${currentPlan?.price}
              <ChevronRight className="h-6 w-6 ml-3" />
            </div>
          )}
        </button>

        <div className="mt-6 flex items-center justify-center text-sm text-gray-600">
          <Shield className="h-4 w-4 mr-2" />
          <span>Secure payment powered by Stripe • Cancel anytime</span>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
