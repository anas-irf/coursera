import React from 'react';
import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons on the right (they wrap under the title on a phone). */
  actions?: ReactNode;
  /** A small line above the title. */
  eyebrow?: ReactNode;
  className?: string;
}

/** The title of a page: the one ``h1``, its line of context and its main actions. */
export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm font-medium text-primary-fg">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem] sm:leading-9">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}

interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** The title of a section of a page (an ``h2``). */
export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-2', className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export default PageHeader;
