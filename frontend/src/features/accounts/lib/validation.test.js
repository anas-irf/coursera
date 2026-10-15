import {
  passwordChecks,
  passwordProblem,
  serverErrors,
  validateLogin,
  validateSignup,
} from './validation';

const signup = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  password: 'Analytical1',
  confirmPassword: 'Analytical1',
  phoneNumber: '',
};

test('a login needs an address that looks like one and a password', () => {
  expect(validateLogin({ email: '', password: '' })).toEqual({
    email: 'Email is required',
    password: 'Password is required',
  });
  expect(validateLogin({ email: 'not-an-address', password: 'x' })).toEqual({
    email: 'Please enter a valid email',
  });
  expect(validateLogin({ email: 'ada@example.com', password: 'x' })).toEqual({});
});

test('the checklist shows exactly the rules that are enforced', () => {
  const checks = passwordChecks('abc');

  expect(checks.map((check) => check.text)).toEqual([
    'At least 8 characters',
    'At least 1 capital letter',
    'At least 1 number',
    'No spaces',
  ]);
  expect(checks.map((check) => check.met)).toEqual([false, false, false, true]);
  expect(passwordChecks('Analytical1').every((check) => check.met)).toBe(true);
});

test.each([
  ['short', 'Password must be at least 8 characters'],
  ['lowercase1', 'Password must contain a capital letter'],
  ['Uppercase', 'Password must contain a number'],
  ['Has space1 x', 'Password must not contain spaces'],
])('"%s" is refused with a reason', (password, message) => {
  expect(passwordProblem(password)).toBe(message);
  expect(validateSignup({ ...signup, password, confirmPassword: password }, true).password).toBe(message);
});

test('a sign-up that follows every rule has no problems', () => {
  expect(validateSignup(signup, true)).toEqual({});
  expect(passwordProblem('Analytical1')).toBeNull();
});

test('a sign-up asks for the names, a matching confirmation, a phone that is one and the terms', () => {
  const errors = validateSignup(
    { ...signup, firstName: '', lastName: '', confirmPassword: 'other', phoneNumber: '12' },
    false
  );

  expect(errors).toEqual({
    firstName: 'First name is required',
    lastName: 'Last name is required',
    confirmPassword: 'Passwords do not match',
    phoneNumber: 'Please enter a valid phone number',
    terms: 'You must agree to the terms',
  });
  expect(validateSignup({ ...signup, confirmPassword: '' }, true).confirmPassword).toBe(
    'Please confirm your password'
  );
});

test('the server\'s field errors are shown where they belong, anything else as one message', () => {
  expect(serverErrors({ email: 'user with this email already exists.' }, {})).toEqual({
    email: 'user with this email already exists.',
  });
  expect(serverErrors({}, { error: 'Invalid credentials' })).toEqual({ general: 'Invalid credentials' });
  expect(serverErrors({}, { detail: 'Too many attempts' })).toEqual({ general: 'Too many attempts' });
  expect(serverErrors({}, {})).toEqual({ general: 'An error occurred. Please try again.' });
});
