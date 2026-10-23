import React from 'react';

import { cn } from '../lib/cn';

interface SpinnerProps {
  /** Pixels. */
  size?: number;
  className?: string;
  /** What is loading, for screen readers; ``null`` when the spinner sits inside a labelled control. */
  label?: string | null;
}

/** A small turning ring in the current text colour. */
export function Spinner({ size = 20, className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn('inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
      style={{ width: size, height: size }}
    />
  );
}

interface PageSpinnerProps {
  className?: string;
  label?: string;
}

/** Centered loading indicator for a page or a panel. */
export function PageSpinner({ className = 'h-96', label = 'Loading' }: PageSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Spinner size={32} className="text-primary" label={label} />
    </div>
  );
}

export default PageSpinner;
