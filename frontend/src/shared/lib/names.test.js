import { fullName, initials } from './names';

test('initials are the first letter of the first and the last word', () => {
  expect(initials('Ada Lovelace')).toBe('AL');
  expect(initials('  grace   brewster   hopper ')).toBe('GH');
  expect(initials('ada')).toBe('A');
  expect(initials('')).toBe('?');
  expect(initials(null)).toBe('?');
});

test('a full name falls back to the e-mail address', () => {
  expect(fullName({ first_name: 'Ada', last_name: 'Lovelace', email: 'a@x.test' })).toBe('Ada Lovelace');
  expect(fullName({ first_name: '', last_name: '', email: 'a@x.test' })).toBe('a@x.test');
  expect(fullName(null, 'Student')).toBe('Student');
});
