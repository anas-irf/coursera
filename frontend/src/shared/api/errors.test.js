import { errorCode, errorMessage, fieldErrors } from './errors';

const failure = (data, status = 400) => ({ response: { status, data } });

test('domain errors use the error key', () => {
  expect(errorMessage(failure({ error: 'Already enrolled in this course' }))).toBe('Already enrolled in this course');
});

test('DRF detail and serializer errors are understood', () => {
  expect(errorMessage(failure({ detail: 'Not found.' }, 404))).toBe('Not found.');
  expect(errorMessage(failure({ email: ['user with this email already exists.'] }))).toBe(
    'user with this email already exists.'
  );
});

test('unreadable responses fall back', () => {
  expect(errorMessage(failure('<html>boom</html>', 500), 'try later')).toBe('try later');
  expect(errorMessage({ message: 'Network Error' })).toMatch(/network/i);
});

test('field errors keep the first message per field', () => {
  expect(fieldErrors(failure({ email: ['bad', 'worse'], password: ['short'], error: 'x' }))).toEqual({
    email: 'bad',
    password: 'short',
  });
});

test('the stable code of an error is read when there is one', () => {
  expect(errorCode(failure({ error: 'Time is up', code: 'time_limit_exceeded' }))).toBe('time_limit_exceeded');
  expect(errorCode(failure({ error: 'plain' }))).toBeNull();
  expect(errorCode(failure('<html></html>', 500))).toBeNull();
  expect(errorCode(new Error('offline'))).toBeNull();
});
