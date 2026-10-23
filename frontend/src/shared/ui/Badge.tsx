import React from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/cn';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'plus';

/** Soft background and readable text of a tone: badges, callouts, icon tiles. */
export const TONE_SOFT: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-fg-muted',
  primary: 'bg-primary-soft text-primary-fg',
  success: 'bg-success-soft text-success-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
  info: 'bg-info-soft text-info-fg',
  plus: 'bg-plus-soft text-plus-fg',
};

/** The text colour of a tone on a plain surface. */
export const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-fg-muted',
  primary: 'text-primary-fg',
  success: 'text-success-fg',
  warning: 'text-warning-fg',
  danger: 'text-danger-fg',
  info: 'text-info-fg',
  plus: 'text-plus-fg',
};

const DOTS: Record<Tone, string> = {
  neutral: 'bg-fg-subtle',
  primary: 'bg-primary',
  success: 'bg-success-fg',
  warning: 'bg-warning-fg',
  danger: 'bg-danger-fg',
  info: 'bg-info-fg',
  plus: 'bg-plus-fg',
};

interface BadgeProps {
  tone?: Tone;
  icon?: LucideIcon;
  /** A coloured dot before the label (a status). */
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}

/** A short label in a pill: a status, a type, a count. */
export function Badge({ tone = 'neutral', icon: Icon, dot = false, size = 'sm', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        TONE_SOFT[tone],
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOTS[tone])} aria-hidden="true" />}
      {Icon && <Icon size={size === 'sm' ? 12 : 14} aria-hidden="true" className="shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export default Badge;
