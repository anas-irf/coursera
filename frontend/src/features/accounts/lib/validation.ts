/**
 * What the login and sign-up forms check before anything is sent.
 *
 * The password rules the form shows as a checklist and the rules it enforces are the same list
 * (``PASSWORD_RULES``): the checklist used to promise four rules and the form enforced one.
 */
import type { ApiErrorBody } from '../../../shared/types';
import type { FieldErrors, PasswordCheck, PasswordRule, SignupFormValues } from '../types';

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', text: 'At least 8 characters', test: (password) => password.length >= 8 },
  { id: 'capital', text: 'At least 1 capital letter', test: (password) => /[A-Z]/.test(password) },
  { id: 'number', text: 'At least 1 number', test: (password) => /[0-9]/.test(password) },
  { id: 'spaces', text: 'No spaces', test: (password) => !/\s/.test(password) },
];

/** ``[{id, text, met}]`` for the checklist. */
export const passwordChecks = (password: string): PasswordCheck[] =>
  PASSWORD_RULES.map(({ id, text, test }) => ({ id, text, met: test(password) }));

const PASSWORD_MESSAGES: Record<PasswordRule['id'], string> = {
  length: 'Password must be at least 8 characters',
  capital: 'Password must contain a capital letter',
  number: 'Password must contain a number',
  spaces: 'Password must not contain spaces',
};

/** The first rule the password breaks, as a message, or ``null``. */
export function passwordProblem(password: string): string | null {
  const broken = PASSWORD_RULES.find(({ test }) => !test(password));
  return broken ? PASSWORD_MESSAGES[broken.id] : null;
}

const EMAIL = /\S+@\S+\.\S+/;
const PHONE = /^\+?1?\d{9,15}$/;

/** ``{field: message}`` of what is wrong with a login (empty when it is fine to send). */
export function validateLogin({ email, password }: Pick<SignupFormValues, 'email' | 'password'>): FieldErrors {
  const errors: FieldErrors = {};

  if (!email) {
    errors.email = 'Email is required';
  } else if (!EMAIL.test(email)) {
    errors.email = 'Please enter a valid email';
  }

  if (!password) errors.password = 'Password is required';

  return errors;
}

/** ``{field: message}`` of what is wrong with a sign-up (empty when it is fine to send). */
export function validateSignup(values: Omit<SignupFormValues, 'userType'>, agreedToTerms: boolean): FieldErrors {
  const errors = validateLogin(values);

  if (values.password && !errors.password) {
    const problem = passwordProblem(values.password);
    if (problem) errors.password = problem;
  }

  if (!values.firstName) errors.firstName = 'First name is required';
  if (!values.lastName) errors.lastName = 'Last name is required';

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  if (values.phoneNumber && !PHONE.test(values.phoneNumber)) {
    errors.phoneNumber = 'Please enter a valid phone number';
  }

  if (!agreedToTerms) errors.terms = 'You must agree to the terms';

  return errors;
}

/**
 * The messages the form shows for a failed request: the fields the server complained about, else
 * one general message.  ``fields`` is ``fieldErrors(error)``, ``data`` the response body (an
 * object, or text when a proxy answered).
 */
export function serverErrors(fields: Record<string, string>, data: unknown): FieldErrors {
  const known: FieldErrors = {
    email: fields.email,
    password: fields.password,
    firstName: fields.first_name,
    lastName: fields.last_name,
    phoneNumber: fields.phone_number,
  };
  const shown: FieldErrors = Object.fromEntries(Object.entries(known).filter(([, message]) => message));

  if (Object.keys(shown).length > 0) return shown;

  // the body of an answer is whatever the server (or a proxy in front of it) sent
  const body = (typeof data === 'object' && data !== null ? data : {}) as ApiErrorBody;
  return { general: body.error || body.detail || 'An error occurred. Please try again.' };
}
