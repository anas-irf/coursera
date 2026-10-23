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

/**
 * ``PATCH /auth/profile/``: the details a user may change about themself.  Everybody: names,
 * phone, place and bio; instructors also their expertise and links; students their goals and
 * interests (the server ignores the fields of another role).
 */
export interface ProfileChanges {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  bio?: string;
  country?: string;
  city?: string;
  expertise?: string;
  years_of_experience?: number;
  website_url?: string;
  linkedin_url?: string;
  payout_email?: string;
  learning_goals?: string;
  interests?: string[];
}

/** What the profile form holds while it is edited (every field as text). */
export interface ProfileFormValues {
  first_name: string;
  last_name: string;
  phone_number: string;
  bio: string;
  country: string;
  city: string;
  expertise: string;
  years_of_experience: string;
  website_url: string;
  linkedin_url: string;
  payout_email: string;
  learning_goals: string;
  /** Comma separated. */
  interests: string;
}

/** ``POST /auth/password/``. */
export interface PasswordChange {
  current_password: string;
  new_password: string;
}

export interface PasswordChanged {
  message: string;
}
