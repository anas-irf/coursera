import React from 'react';

import { cn } from '../lib/cn';
import { initials } from '../lib/names';

// saturated enough for white initials in both themes
const COLORS = ['bg-brand-600', 'bg-violet-600', 'bg-emerald-600', 'bg-rose-600', 'bg-amber-600', 'bg-cyan-600', 'bg-indigo-600'];

// the same person always gets the same colour
const colorFor = (name: string): string => {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  return COLORS[hash % COLORS.length];
};

interface AvatarProps {
  name?: string;
  className?: string;
}

/** A round badge with the initials of ``name`` (drawn locally: nothing is requested from anyone). */
export function Avatar({ name = '', className = 'h-8 w-8 text-xs' }: AvatarProps) {
  const label = name.trim() || 'User';
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white',
        colorFor(label),
        className
      )}
    >
      {initials(label)}
    </span>
  );
}

export default Avatar;
