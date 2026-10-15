import React from 'react';

import { errorMessage } from '../../../shared/api/errors';
import { formatDate } from '../../../shared/lib/time';
import { useConfirm } from '../../../shared/ui/ConfirmDialog';
import { useToast } from '../../../shared/ui/Toast';
import { useCancelMembership, useSubscription } from '../hooks/useSubscription';

/**
 * "Cancel membership" for a Plus member whose membership still renews (renders nothing for
 * everybody else).  Cancelling stops the renewal; Plus works until the end of the paid period,
 * and the confirmation says so.
 */
const CancelMembershipButton = ({ className = '', children = 'Cancel membership' }) => {
  const { willRenew, accessUntil } = useSubscription();
  const cancel = useCancelMembership();
  const { confirm } = useConfirm();
  const toast = useToast();

  if (!willRenew) return null;

  const until = accessUntil ? formatDate(accessUntil) : 'the end of the period you paid for';

  const onClick = async () => {
    const confirmed = await confirm({
      type: 'warning',
      title: 'Cancel your membership?',
      message: `Your membership will not renew. You keep Coursera Plus until ${until}.`,
      confirmText: 'Cancel membership',
      cancelText: 'Keep my membership',
    });
    if (!confirmed) return;

    cancel.mutate(undefined, {
      onSuccess: () => toast.success(
        `Your membership will not renew. You keep Plus until ${until}.`, 'Membership cancelled'),
      onError: (error) => toast.error(
        errorMessage(error, 'We could not cancel your membership. Please try again.'), 'Could not cancel'),
    });
  };

  return (
    <button onClick={onClick} disabled={cancel.isPending} className={className}>
      {cancel.isPending ? 'Cancelling...' : children}
    </button>
  );
};

export default CancelMembershipButton;
