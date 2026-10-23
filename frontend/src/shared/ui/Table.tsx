import React from 'react';
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from '../lib/cn';

/**
 * The tables of the app.  ``Table`` scrolls sideways inside its card on a narrow screen instead
 * of widening the page; the cells keep one padding and one type size everywhere.
 */
export function Table({ className, children, label }: { className?: string; children: ReactNode; label?: string }) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table aria-label={label} className="w-full min-w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-line bg-surface-muted/60">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function TR({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn('transition-colors hover:bg-surface-muted/50', className)} {...rest}>
      {children}
    </tr>
  );
}

export function TH({ className, children, align = 'left', ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle first:pl-5 last:pr-5',
        align === 'right' && 'text-right',
        className
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TD({ className, children, align = 'left', ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'px-4 py-3.5 align-middle text-fg-muted first:pl-5 last:pr-5',
        align === 'right' && 'text-right tabular-nums',
        className
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

export default Table;
