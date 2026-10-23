import type { UserType } from '../types';

/** A user as the API describes one: the login answer and ``GET /auth/profile/``. */
export interface User {
  id: number;
  uuid?: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  user_type: UserType;
  phone_number: string | null;
  email_verified?: boolean;
  profile_picture: string | null;
  bio?: string;
  country?: string;
  city?: string;
  /** Instructors: what they teach. */
  expertise?: string;
  linkedin_url?: string | null;
  website_url?: string | null;
  years_of_experience?: number;
  date_joined?: string;
}

/** The roles the demo sign-in offers. */
export type DemoRole = UserType;

/** A seeded account the login page offers to sign in as. */
export interface DemoAccount {
  role: DemoRole;
  email: string;
  name: string;
  /** What there is to see with it. */
  headline: string;
}

/** ``GET /auth/demo/``: empty and disabled unless the server runs in demo mode. */
export interface DemoAccounts {
  enabled: boolean;
  accounts: DemoAccount[];
}

/**
 * The student or instructor profile that comes with the user (``null`` for an admin).  It is
 * kept with the session but no screen reads its fields, so it stays opaque here.
 */
export type Profile = Record<string, unknown>;

/** Who is signed in: the answer of the login and of the profile endpoint. */
export interface Identity {
  user: User;
  profile: Profile | null;
}

/** The body of ``POST /auth/signup/`` (the sign-up form's own state is camelCase). */
export interface SignupPayload {
  email: string;
  password: string;
  confirm_password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  user_type: Exclude<UserType, 'admin'>;
}

/** The answer to a sign-up.  The user is not signed in by it: the form goes back to the login. */
export interface SignupResponse {
  user: User;
  tokens: { access: string; refresh: string };
  message: string;
}

/**
 * Where the session stands:
 *   unknown       the server has not been asked yet
 *   authenticated a user is signed in
 *   anonymous     nobody is signed in
 *   unavailable   the server could not be reached: the session is not known to be over
 */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous' | 'unavailable';

export interface SessionSnapshot {
  status: SessionStatus;
  authenticated: boolean;
  user: User | null;
  profile: Profile | null;
}
