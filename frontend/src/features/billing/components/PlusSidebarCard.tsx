import React from 'react';
import { Crown, Sparkles } from 'lucide-react';

import { BRAND } from '../../../shared/brand';
import { formatDate } from '../../../shared/lib/time';
import { ButtonLink } from '../../../shared/ui/Button';
import { useSubscription } from '../hooks/useSubscription';

/**
 * The membership under the student's navigation: an invitation to upgrade, or what the member
 * has (and until when).  Nothing while the status is loading or could not be loaded.
 */
const PlusSidebarCard = () => {
  const { loading, error, isPlus, willRenew, accessUntil } = useSubscription();
  if (loading || error) return null;

  if (isPlus) {
    return (
      <div className="rounded-xl border border-plus-fg/20 bg-plus-soft p-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-plus-fg">
          <Crown size={16} aria-hidden="true" />
          {BRAND.plus}
        </div>
        <p className="mt-1 text-xs text-fg-muted">
          {accessUntil
            ? willRenew
              ? `Renews on ${formatDate(accessUntil)}`
              : `Access until ${formatDate(accessUntil)}`
            : 'Every Plus course is open to you'}
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-brand-900 p-4 text-white">
      <div className="bg-dots absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="relative">
        <Sparkles size={18} aria-hidden="true" className="text-brand-200" />
        <p className="mt-2 text-sm font-semibold">Unlock every Plus course</p>
        <p className="mt-0.5 text-xs text-brand-100">Certificates and the whole catalogue with one membership.</p>
        <ButtonLink to="/student/checkout" size="sm" variant="secondary" block className="mt-3 border-transparent">
          Upgrade to Plus
        </ButtonLink>
      </div>
    </div>
  );
};

export default PlusSidebarCard;
