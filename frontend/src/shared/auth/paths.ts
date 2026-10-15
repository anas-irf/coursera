import type { UserType } from '../types';

const HOME: Record<UserType, string> = {
  student: '/student',
  instructor: '/instructor',
  admin: '/admin',
};

/** Landing page of a user type (the login page when nobody is logged in). */
export const homePathFor = (userType: UserType | null | undefined): string =>
  (userType && HOME[userType]) || '/login';
