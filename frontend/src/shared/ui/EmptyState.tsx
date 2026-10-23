import React from 'react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** "Nothing here yet": an icon, a title, a line of help and, optionally, the way to fill it. */
export function EmptyState({ icon: Icon, title, children, action, className = 'py-12' }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 text-center', className)}>
      {Icon && (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-fg-subtle ring-8 ring-surface-muted/40">
          <Icon size={22} aria-hidden="true" />
        </span>
      )}
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-fg-muted">{children}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
