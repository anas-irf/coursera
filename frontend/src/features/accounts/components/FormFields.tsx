import React, { useState } from 'react';
import type { ChangeEventHandler, InputHTMLAttributes, ReactNode } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';

import { cn } from '../../../shared/lib/cn';
import { Field } from '../../../shared/ui/Field';
import { Input, inputClasses } from '../../../shared/ui/Input';
import { passwordChecks } from '../lib/validation';

/** What both fields take; whatever else is passed (placeholder, autoComplete ...) goes to the input. */
interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'value' | 'onChange'> {
  label: string;
  name: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  error?: string;
  hint?: ReactNode;
}

/** A labelled text input with its error message underneath. */
export const TextField = ({ label, name, value, onChange, error, hint, type = 'text', required, ...rest }: FieldProps) => (
  <Field label={label} error={error} hint={hint} required={required}>
    <Input type={type} name={name} value={value} onChange={onChange} {...rest} />
  </Field>
);

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/** A password box with the button that shows what was typed (it takes the field's id and help). */
const PasswordInput = ({ className, ...rest }: PasswordInputProps) => {
  const [visible, setVisible] = useState(false);
  const invalid = rest['aria-invalid'] === true || rest['aria-invalid'] === 'true';
  return (
    <div className={cn('relative', className)}>
      <input type={visible ? 'text' : 'password'} className={inputClasses(invalid, 'h-10 pl-3 pr-10')} {...rest} />
      <button
        type="button"
        onClick={() => setVisible((shown) => !shown)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
      >
        {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  );
};

// the type of a password input is the button's to change
interface PasswordFieldProps extends Omit<FieldProps, 'type'> {
  children?: ReactNode;
}

/** A password input with a button that shows or hides what was typed. */
export const PasswordField = ({ label, name, value, onChange, error, hint, children, required, ...rest }: PasswordFieldProps) => (
  <div>
    <Field label={label} error={error} hint={hint} required={required}>
      <PasswordInput name={name} value={value} onChange={onChange} {...rest} />
    </Field>
    {children}
  </div>
);

/** The password rules as a checklist that ticks itself while the password is typed. */
export const PasswordChecklist = ({ password }: { password: string }) => (
  <div className="mt-2 rounded-lg border border-line bg-surface-muted/60 p-3">
    <p className="mb-1.5 text-xs font-medium text-fg-muted">Password must contain:</p>
    <ul className="grid gap-1 sm:grid-cols-2">
      {passwordChecks(password).map((check) => (
        <li key={check.id} className="flex items-center gap-1.5 text-xs">
          <Check
            size={14}
            aria-hidden="true"
            className={check.met ? 'text-success-fg' : 'text-fg-subtle/50'}
          />
          <span className={check.met ? 'text-success-fg' : 'text-fg-subtle'}>{check.text}</span>
        </li>
      ))}
    </ul>
  </div>
);
