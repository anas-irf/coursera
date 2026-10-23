/**
 * The profile form: what it starts from (the user and the role's profile as the server sent them)
 * and what it sends (only the fields of the user's role, trimmed).
 */
import type { Profile, User } from '../../../shared/auth/types';
import type { UserType } from '../../../shared/types';
import type { ProfileChanges, ProfileFormValues } from '../types';

const text = (value: unknown): string => (typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value));

/** The interests of a student profile (a list of strings), as the comma separated text of the form. */
const interestsText = (value: unknown): string =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').join(', ') : '';

export function profileValues(user: User | null, profile: Profile | null): ProfileFormValues {
  return {
    first_name: text(user?.first_name),
    last_name: text(user?.last_name),
    phone_number: text(user?.phone_number),
    bio: text(user?.bio),
    country: text(user?.country),
    city: text(user?.city),
    expertise: text(user?.expertise),
    years_of_experience: user?.years_of_experience ? String(user.years_of_experience) : '',
    website_url: text(user?.website_url),
    linkedin_url: text(user?.linkedin_url),
    payout_email: text(profile?.payout_email),
    learning_goals: text(profile?.learning_goals),
    interests: interestsText(profile?.interests),
  };
}

/** "Python, data , , SQL" -> ["Python", "data", "SQL"] (at most ten, each at most 40 characters). */
export function splitInterests(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.slice(0, 40))
    .slice(0, 10);
}

/** What the form sends for a user of ``role``. */
export function profileChanges(values: ProfileFormValues, role: UserType | null): ProfileChanges {
  const changes: ProfileChanges = {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    phone_number: values.phone_number.trim(),
    bio: values.bio.trim(),
    country: values.country.trim(),
    city: values.city.trim(),
  };
  if (role === 'instructor') {
    changes.expertise = values.expertise.trim();
    changes.years_of_experience = Number(values.years_of_experience) || 0;
    changes.website_url = values.website_url.trim();
    changes.linkedin_url = values.linkedin_url.trim();
    changes.payout_email = values.payout_email.trim();
  }
  if (role === 'student') {
    changes.learning_goals = values.learning_goals.trim();
    changes.interests = splitInterests(values.interests);
  }
  return changes;
}

const PHONE = /^\+?1?\d{9,15}$/;
const URL = /^https?:\/\/\S+\.\S+/i;
const EMAIL = /\S+@\S+\.\S+/;

/** ``{field: message}`` of what is wrong before anything is sent (empty when it is fine). */
export function validateProfile(values: ProfileFormValues, role: UserType | null): Partial<Record<keyof ProfileFormValues, string>> {
  const errors: Partial<Record<keyof ProfileFormValues, string>> = {};
  if (!values.first_name.trim()) errors.first_name = 'First name is required';
  if (!values.last_name.trim()) errors.last_name = 'Last name is required';
  if (values.phone_number.trim() && !PHONE.test(values.phone_number.trim())) {
    errors.phone_number = 'Use 9 to 15 digits, optionally starting with +';
  }
  if (values.bio.length > 500) errors.bio = 'At most 500 characters';
  if (role === 'instructor') {
    const years = Number(values.years_of_experience || 0);
    if (!Number.isInteger(years) || years < 0 || years > 80) errors.years_of_experience = 'A whole number from 0 to 80';
    if (values.website_url.trim() && !URL.test(values.website_url.trim())) errors.website_url = 'Enter a full address (https://...)';
    if (values.linkedin_url.trim() && !URL.test(values.linkedin_url.trim())) errors.linkedin_url = 'Enter a full address (https://...)';
    if (values.payout_email.trim() && !EMAIL.test(values.payout_email.trim())) errors.payout_email = 'Please enter a valid email';
  }
  if (role === 'student' && values.learning_goals.length > 1000) errors.learning_goals = 'At most 1000 characters';
  return errors;
}
