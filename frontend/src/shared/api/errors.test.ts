import { errorBody, errorCode, errorMessage, errorStatus, errorSummary, fieldErrors } from './errors';

const failure = (data: unknown, status = 400) => ({ response: { status, data } });

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

test('the body is what the server answered, and nothing when it did not', () => {
  expect(errorBody(failure({ error: 'x' }))).toEqual({ error: 'x' });
  expect(errorBody(failure('<html></html>', 502))).toBe('<html></html>');
  expect(errorBody(new Error('offline'))).toBeUndefined();
  expect(errorBody(undefined)).toBeUndefined();
});

test('the status is that of the answer, and nothing when there was none', () => {
  expect(errorStatus(failure({}, 402))).toBe(402);
  expect(errorStatus(new Error('offline'))).toBeUndefined();
  expect(errorStatus(null)).toBeUndefined();
  expect(errorStatus('boom')).toBeUndefined();
});

test('a form response is summarised with every field that is wrong', () => {
  expect(errorSummary(failure({ title: ['This field is required.'], category: ['Invalid pk'] }))).toBe(
    'title: This field is required. category: Invalid pk.'
  );
  expect(errorSummary(failure({ error: 'Cannot edit published courses.' }))).toBe('Cannot edit published courses.');
  expect(errorSummary(failure('<html></html>', 500), 'try later')).toBe('try later');
  expect(errorSummary({ message: 'Network Error' })).toMatch(/network/i);
});
