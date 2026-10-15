import type { AxiosError } from 'axios';

import type { ApiErrorBody, ISODateTime, UserType } from '../../shared/types';

/** How a membership is billed: the two plans of the checkout page.  It is also the ``plan_id`` sent. */
export type BillingCycle = 'monthly' | 'yearly';

/** Where a membership stands; ``none`` is what the server says when there is no membership at all. */
export type SubscriptionState = 'none' | 'active' | 'cancelled' | 'expired' | 'pending' | 'suspended';

/** ``GET /billing/subscription/``: the student's membership. */
export interface SubscriptionStatus {
  has_subscription: boolean;
  status: SubscriptionState;
  subscription_type: BillingCycle | null;
  /** Plus works: running, or cancelled with its paid period not over yet. */
  is_active: boolean;
  can_access_plus_courses: boolean;
  start_date: ISODateTime | null;
  /** The end of the paid period. */
  end_date: ISODateTime | null;
  auto_renew: boolean;
  next_billing_date: ISODateTime | null;
}

/** The membership as the checkout page is told about it. */
export interface CheckoutSubscription {
  has_subscription: boolean;
  type: BillingCycle | null;
  status: SubscriptionState;
  is_active: boolean;
  end_date: ISODateTime | null;
}

/** A plan the checkout page offers. */
export interface Plan {
  /** "monthly" / "yearly" for the built-in plans, the uuid of the row for a configured one. */
  id: string;
  name: string;
  description: string;
  price: number;
  billing_cycle: BillingCycle;
  billing_cycle_display: string;
  features: {
    unlimited_courses: boolean;
    certificate_included: boolean;
    download_enabled: boolean;
  };
}

/** ``GET /billing/checkout/``: everything the checkout page shows. */
export interface CheckoutData {
  student: { name: string; email: string; user_type: UserType };
  subscription: CheckoutSubscription;
  plans: Plan[];
  currency: 'USD';
  /** What the yearly plan saves against twelve monthly payments. */
  savings: { yearly_savings_amount: number; yearly_savings_percentage: number };
  payment_methods: { id: string; name: string; icon: string }[];
}

/** ``POST /billing/checkout/session/``: the Stripe page to send the customer to. */
export interface CheckoutSession {
  checkout_url: string;
  session_id: string;
}

/** ``POST /billing/checkout/verify/``: paid (the membership exists) or not paid yet. */
export type VerifyResult =
  | {
      message: string;
      has_subscription: true;
      /** Only when the membership existed before the call. */
      subscription?: { type: BillingCycle; status: SubscriptionState; is_active: boolean };
    }
  | { message: string; has_subscription: false; payment_status: string };

/** ``POST /billing/subscription/cancel/``. */
export interface CancelResult {
  message: string;
  status: SubscriptionState;
  access_until: ISODateTime | null;
}

/** The plan a student is on: ``coursera_plus`` while Plus works (also after cancelling), else ``free``. */
export type MembershipPlan = 'coursera_plus' | 'free';

/** What ``useSubscription()`` answers: the one definition of "is this student a member". */
export interface SubscriptionView {
  /** The server's answer; ``null`` until it has come (and when it could not be had). */
  status: SubscriptionStatus | null;
  /** ``null`` while loading. */
  plan: MembershipPlan | null;
  loading: boolean;
  error: AxiosError<ApiErrorBody> | null;
  /** What the server says ``can_access_plus_courses`` is, so a cancelled member counts until the period ends. */
  isPlus: boolean;
  /** False once the member cancelled. */
  willRenew: boolean;
  /** The end of the paid period, ``null`` when there is none. */
  accessUntil: ISODateTime | null;
  refresh: () => Promise<unknown>;
}
