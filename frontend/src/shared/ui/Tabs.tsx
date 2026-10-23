import React, { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
  /** A count shown after the label. */
  count?: number;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The name of the tab list for screen readers. */
  label: string;
  variant?: 'underline' | 'pills';
  className?: string;
}

/**
 * A row of tabs (``role="tablist"``).  The arrow keys move between them, as in any tab list; the
 * page renders the panel of the chosen one.
 */
export function Tabs<T extends string>({ items, value, onChange, label, variant = 'underline', className }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + items.length) % items.length;
    onChange(items[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        // a long list scrolls sideways on a phone; never up and down
        'flex max-w-full items-center overflow-x-auto overflow-y-hidden',
        variant === 'underline' ? 'gap-6 border-b border-line' : 'gap-1 rounded-lg bg-surface-muted p-1',
        className
      )}
    >
      {items.map(({ value: itemValue, label: itemLabel, icon: Icon, count }, index) => {
        const selected = itemValue === value;
        return (
          <button
            key={itemValue}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(itemValue)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              variant === 'underline'
                ? cn(
                    'border-b-2 px-0.5 pb-2.5 pt-1',
                    selected ? 'border-primary text-primary-fg' : 'border-transparent text-fg-muted hover:text-fg'
                  )
                : cn(
                    'rounded-md px-3 py-1.5',
                    selected ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg'
                  )
            )}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            {itemLabel}
            {count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-xs tabular-nums',
                  selected ? 'bg-primary-soft text-primary-fg' : 'bg-surface-muted text-fg-subtle'
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
