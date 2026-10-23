import React from 'react';

import { cn } from '../lib/cn';

type ProgressTone = 'primary' | 'success' | 'warning' | 'danger' | 'plus';

const FILLS: Record<ProgressTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  plus: 'bg-plus',
};

const HEIGHTS = { xs: 'h-1', sm: 'h-1.5', md: 'h-2', lg: 'h-3' } as const;

interface ProgressBarProps {
  /** How far, out of ``max`` (values outside 0..max are clamped). */
  value: number;
  max?: number;
  /** What is measured, for screen readers. */
  label?: string;
  tone?: ProgressTone;
  size?: keyof typeof HEIGHTS;
  className?: string;
}

/** A horizontal bar (``role="progressbar"``). */
export function ProgressBar({ value, max = 100, label = 'Progress', tone = 'primary', size = 'md', className }: ProgressBarProps) {
  const clamped = Math.min(max, Math.max(0, Number(value) || 0));
  const percent = max > 0 ? (clamped / max) * 100 : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(clamped)}
      className={cn('w-full overflow-hidden rounded-full bg-surface-muted', HEIGHTS[size], className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', FILLS[tone])} style={{ width: `${percent}%` }} />
    </div>
  );
}

export default ProgressBar;
