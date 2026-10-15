import React from 'react';

import { initials } from '../lib/names';

const COLORS = ['bg-indigo-600', 'bg-purple-600', 'bg-blue-600', 'bg-emerald-600', 'bg-rose-600', 'bg-amber-600'];

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
export function Avatar({ name = '', className = 'w-8 h-8 text-xs' }: AvatarProps) {
  const label = name.trim() || 'User';
  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white ${colorFor(label)} ${className}`}
    >
      {initials(label)}
    </span>
  );
}

export default Avatar;
