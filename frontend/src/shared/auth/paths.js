const HOME = {
  student: '/student',
  instructor: '/instructor',
  admin: '/admin',
};

/** Landing page of a user type (the login page when nobody is logged in). */
export const homePathFor = (userType) => HOME[userType] || '/login';
