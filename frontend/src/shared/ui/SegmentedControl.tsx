import React, { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
  /** A line under the label (the option cards of a form). */
  description?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The name of the group for screen readers. */
  label: string;
  /** "cards" lays the options out as selectable cards with their descriptions. */
  variant?: 'segments' | 'cards';
  className?: string;
}

/**
 * One choice out of a few (``role="radiogroup"``): a video's source, a quiz's kind, the theme.
 * The arrow keys move the choice, like the radio buttons it stands for.
 */
export function SegmentedControl<T extends string>({
  options, value, onChange, label, variant = 'segments', className,
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !back) return;
    event.preventDefault();
    const next = (index + (forward ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        variant === 'segments'
          ? 'inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-surface-muted p-1'
          : 'grid gap-3 sm:grid-cols-2',
        className
      )}
    >
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon, description }, index) => {
        const checked = optionValue === value;
        return (
          <button
            key={optionValue}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(optionValue)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              variant === 'segments'
                ? cn(
                    'inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium',
                    checked ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg'
                  )
                : cn(
                    'flex items-start gap-3 rounded-xl border p-4',
                    checked
                      ? 'border-primary bg-primary-soft/60 ring-1 ring-primary'
                      : 'border-line bg-surface hover:border-line-strong'
                  )
            )}
          >
            {Icon && (
              <Icon
                size={variant === 'segments' ? 16 : 18}
                aria-hidden="true"
                className={cn('shrink-0', variant === 'cards' && (checked ? 'text-primary-fg' : 'text-fg-subtle'))}
              />
            )}
            <span className="min-w-0">
              <span className={cn('block', variant === 'cards' && 'font-medium text-fg')}>{optionLabel}</span>
              {description && variant === 'cards' && (
                <span className="mt-0.5 block text-xs text-fg-muted">{description}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
