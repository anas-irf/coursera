import type { UserType } from '../../shared/types';

/** What a person can sign up as: an administrator account is never made through the form. */
export type SignupRole = Exclude<UserType, 'admin'>;

/**
 * What the login and sign-up form holds while it is filled in (camelCase; ``SignupPayload`` in
 * ``shared/auth/types`` is what is sent).
 */
export interface SignupFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber: string;
  userType: SignupRole;
}

/** Where a message of the form is shown: under a field, by the terms, or above the form. */
export type FormField = keyof SignupFormValues | 'terms' | 'general';

/** ``{field: message}`` of what is wrong with the form (empty when it is fine to send). */
export type FieldErrors = Partial<Record<FormField, string>>;

/** One rule of the password: the checklist shows ``text`` and the form enforces ``test``. */
export interface PasswordRule {
  id: 'length' | 'capital' | 'number' | 'spaces';
  text: string;
  test: (password: string) => boolean;
}

/** A rule of the password and whether the password typed so far meets it. */
export interface PasswordCheck {
  id: PasswordRule['id'];
  text: string;
  met: boolean;
}
