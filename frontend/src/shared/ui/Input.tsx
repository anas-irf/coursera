import React, { forwardRef } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../lib/cn';

/** The look of every text control: inputs, selects and text areas. */
export function inputClasses(invalid = false, className?: string): string {
  return cn(
    'block w-full rounded-lg border bg-surface text-sm text-fg shadow-xs transition-colors',
    'placeholder:text-fg-subtle focus:outline-none focus:ring-2',
    'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-fg-muted',
    invalid
      ? 'border-danger focus:border-danger focus:ring-danger/25'
      : 'border-line-strong focus:border-primary focus:ring-ring/25',
    className
  );
}

const isInvalid = (value: InputHTMLAttributes<HTMLElement>['aria-invalid']): boolean =>
  value === true || value === 'true';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** An icon inside the box, on the left. */
  icon?: LucideIcon;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon: Icon, className, type = 'text', ...rest },
  ref
) {
  const control = (
    <input
      ref={ref}
      type={type}
      className={inputClasses(isInvalid(rest['aria-invalid']), cn('h-10 px-3', Icon && 'pl-9', !Icon && className))}
      {...rest}
    />
  );
  if (!Icon) return control;
  return (
    <div className={cn('relative', className)}>
      <Icon
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
      />
      {control}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={inputClasses(isInvalid(rest['aria-invalid']), cn('px-3 py-2 leading-6', className))}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref
) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        className={inputClasses(isInvalid(rest['aria-invalid']), 'h-10 cursor-pointer appearance-none pl-3 pr-9')}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle"
      />
    </div>
  );
});

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  /** The accessible name (the placeholder is not one). */
  label: string;
}

/** A search box with a clear button. */
export function SearchInput({ value, onChange, label, className, placeholder, ...rest }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
      />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClasses(false, 'h-10 pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none')}
        {...rest}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-muted hover:text-fg"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default Input;
