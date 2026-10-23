import React from 'react';
import { Crown } from 'lucide-react';

import { BRAND } from '../../../shared/brand';
import { formatDate } from '../../../shared/lib/time';
import { Badge } from '../../../shared/ui/Badge';
import { ButtonLink, buttonClasses } from '../../../shared/ui/Button';
import { Card, CardBody, CardHeader } from '../../../shared/ui/Card';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useSubscription } from '../hooks/useSubscription';
import CancelMembershipButton from './CancelMembershipButton';

const CYCLE: Record<string, string> = { monthly: 'Monthly', yearly: 'Annual' };

/** The student's membership in the account settings: plan, renewal and the ways to change it. */
const MembershipCard = () => {
  const subscription = useSubscription();
  const { status, isPlus, willRenew, accessUntil } = subscription;

  return (
    <Card>
      <CardHeader title="Membership" description={`Your ${BRAND.plus} plan and billing.`} icon={Crown} />
      <CardBody>
        {subscription.loading && <PageSpinner className="h-24" />}
        {subscription.error && (
          <ErrorState className="py-6" title="Your membership could not be loaded" error={subscription.error}
            onRetry={() => subscription.refresh()} />
        )}
        {!subscription.loading && !subscription.error && (
          isPlus && status ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-fg">
                    {BRAND.plus} {status.subscription_type ? CYCLE[status.subscription_type] : ''}
                  </p>
                  <Badge tone={willRenew ? 'success' : 'warning'} dot>
                    {willRenew ? 'Active' : 'Cancelled'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-fg-muted">
                  {accessUntil
                    ? willRenew
                      ? `Renews on ${formatDate(accessUntil)}.`
                      : `It will not renew. You keep Plus until ${formatDate(accessUntil)}.`
                    : 'Every Plus course is open to you.'}
                </p>
              </div>
              <CancelMembershipButton className={buttonClasses({ variant: 'danger-soft', size: 'sm' })} />
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-fg">Free plan</p>
                <p className="mt-1 text-sm text-fg-muted">
                  {status && (status.status === 'expired' || status.status === 'suspended')
                    ? 'Your Plus membership has ended. Upgrade again to reopen the Plus courses.'
                    : 'Free courses are open to you. Plus opens the whole catalogue and its certificates.'}
                </p>
              </div>
              <ButtonLink to="/student/checkout" size="sm" icon={Crown}>
                Upgrade to Plus
              </ButtonLink>
            </div>
          )
        )}
      </CardBody>
    </Card>
  );
};

export default MembershipCard;
