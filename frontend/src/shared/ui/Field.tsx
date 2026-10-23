import React, { cloneElement, useId } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { cn } from '../lib/cn';

/** What a control gets from its field: the id the label points at and the help it is described by. */
interface ControlProps {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

interface FieldProps {
  label: ReactNode;
  /** One control (an input, a select ...): it is given the id the label points at. */
  children: ReactElement<ControlProps>;
  hint?: ReactNode;
  error?: ReactNode;
  /** Marks the label with an asterisk and the control as required. */
  required?: boolean;
  /** Keeps the label for screen readers only (a search box whose placeholder says it all). */
  hideLabel?: boolean;
  className?: string;
  /** Something on the right of the label (a counter, a link). */
  aside?: ReactNode;
}

/**
 * A labelled control with its hint and error underneath.  The label is tied to the control, the
 * hint and the error describe it, and an error marks it invalid, so it can be reached by name.
 */
export function Field({ label, children, hint, error, required = false, hideLabel = false, className, aside }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <div className={cn('mb-1.5 flex items-center justify-between gap-2', hideLabel && 'sr-only')}>
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
          {required && (
            <span className="ml-0.5 text-danger-fg" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {aside}
      </div>
      {cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required || undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}

/** A group of related fields with a title (a fieldset). */
export function FieldGroup({ legend, description, children, className }: {
  legend: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="text-sm font-medium text-fg">{legend}</legend>
      {description && <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>}
      <div className="mt-2">{children}</div>
    </fieldset>
  );
}

export default Field;
