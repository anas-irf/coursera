import React from 'react';

import { courseStatus } from '../lib/courseStatus';

interface StatusBadgeProps {
  /** A course status; one this app does not know is shown as it is. */
  status?: string | null;
  className?: string;
}

/** A course's moderation state as a coloured pill. */
export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const { label, badge } = courseStatus(status);
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge} ${className}`}>{label}</span>
  );
}

export default StatusBadge;
