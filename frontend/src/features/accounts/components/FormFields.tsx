import React, { useId, useState } from 'react';
import type { ChangeEventHandler, InputHTMLAttributes, ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const INPUT =
  'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

/** What both fields take; whatever else is passed (placeholder, autoComplete ...) goes to the input. */
interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'value' | 'onChange'> {
  label: string;
  name: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  error?: string;
}

/** A labelled text input with its error message underneath. */
export const TextField = ({ label, name, value, onChange, error, type = 'text', ...rest }: FieldProps) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        className={`${INPUT} ${error ? 'border-red-500' : 'border-gray-300'}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

// the type of a password input is the button's to change
interface PasswordFieldProps extends Omit<FieldProps, 'type'> {
  children?: ReactNode;
}

/** A password input with a button that shows or hides what was typed. */
export const PasswordField = ({ label, name, value, onChange, error, children, ...rest }: PasswordFieldProps) => {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          className={`${INPUT} pr-10 ${error ? 'border-red-500' : 'border-gray-300'}`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {children}
    </div>
  );
};
