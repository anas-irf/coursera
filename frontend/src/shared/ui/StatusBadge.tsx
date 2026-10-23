import React from 'react';

import { courseStatus } from '../lib/courseStatus';
import { Badge } from './Badge';

interface StatusBadgeProps {
  /** A course status; one this app does not know is shown as it is. */
  status?: string | null;
  className?: string;
}

/** A course's moderation state as a coloured pill. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, tone } = courseStatus(status);
  return (
    <Badge tone={tone} dot className={className}>
      {label}
    </Badge>
  );
}

export default StatusBadge;
