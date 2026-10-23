import React, { useId } from 'react';

import { BRAND } from '../brand';
import { cn } from '../lib/cn';

/** The mark alone: a graduation cap on the brand gradient (public/favicon.svg draws the same). */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  // one gradient per drawing: a hidden copy of the logo must not take the others' fill with it
  const gradient = `logo-mark-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2d7ff9" />
          <stop offset="1" stopColor="#0047ad" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${gradient})`} />
      <path
        d="M18 31.5v9.2c0 1.2.6 2.3 1.6 2.9 3.7 2.3 7.8 3.4 12.4 3.4s8.7-1.1 12.4-3.4c1-.6 1.6-1.7 1.6-2.9v-9.2l-14 6.6z"
        fill="#fff"
        fillOpacity=".85"
      />
      <path d="M32 14 57 25.5 32 37 7 25.5z" fill="#fff" />
      <path d="M52 27.8v10.7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="52" cy="40.6" r="2.6" fill="#fff" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  /** White text, for a coloured background. */
  inverted?: boolean;
  /** Only the mark on a phone (a crowded top bar), the name from ``sm`` up. */
  compact?: boolean;
}

/** The mark and the name of the product. */
export function Logo({ className, inverted = false, compact = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} aria-label={BRAND.name} role="img">
      <LogoMark />
      <span className={cn('items-baseline gap-1.5', compact ? 'hidden sm:flex' : 'flex')} aria-hidden="true">
        <span className={cn('text-lg font-semibold tracking-tight', inverted ? 'text-white' : 'text-fg')}>
          {BRAND.wordmark}
        </span>
        <span
          className={cn(
            'rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider',
            inverted ? 'bg-white/15 text-white' : 'bg-primary-soft text-primary-fg'
          )}
        >
          {BRAND.tag}
        </span>
      </span>
    </span>
  );
}

export default Logo;
