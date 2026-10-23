import React from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/cn';
import { TONE_SOFT } from './Badge';
import type { Tone } from './Badge';

interface StatCardProps {
  label: string;
  /** The figure, or the dash of a figure that could not be loaded. */
  value: ReactNode;
  /** What the figure is about ("12 published, 2 drafts"). */
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}

/** One headline figure: its name, the number and a line of context. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'primary', className }: StatCardProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('min-w-0 rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5', className)}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <p className="min-w-0 text-xs font-medium text-fg-muted sm:text-sm">{label}</p>
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9',
              TONE_SOFT[tone]
            )}
          >
            <Icon size={17} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight text-fg tabular-nums sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}

interface MetricProps {
  label: string;
  value: ReactNode;
  /** The colour of the figure (a grade weight that is complete, or not). */
  tone?: Tone | 'default';
  className?: string;
}

const METRIC_TEXT: Record<Tone | 'default', string> = {
  default: 'text-fg',
  neutral: 'text-fg-muted',
  primary: 'text-primary-fg',
  success: 'text-success-fg',
  warning: 'text-warning-fg',
  danger: 'text-danger-fg',
  info: 'text-info-fg',
  plus: 'text-plus-fg',
};

/** A small figure inside a card: the number over its name. */
export function Metric({ label, value, tone = 'default', className }: MetricProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className={cn('text-lg font-semibold tabular-nums', METRIC_TEXT[tone])}>{value}</p>
      <p className="text-xs leading-tight text-fg-subtle">{label}</p>
    </div>
  );
}

export default StatCard;
