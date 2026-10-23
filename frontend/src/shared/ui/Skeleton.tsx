import React from 'react';

import { cn } from '../lib/cn';

/** A grey placeholder in the shape of what is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-surface-muted', className)} />;
}

export default Skeleton;
