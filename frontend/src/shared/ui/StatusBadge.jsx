import React from 'react';

import { courseStatus } from '../lib/courseStatus';

/** A course's moderation state as a coloured pill. */
export function StatusBadge({ status, className = '' }) {
  const { label, badge } = courseStatus(status);
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge} ${className}`}>{label}</span>
  );
}

export default StatusBadge;
