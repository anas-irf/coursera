import type { User } from '../../../shared/auth/types';
import { profileChanges, profileValues, splitInterests, validateProfile } from './profile';

const user: User = {
  id: 7,
  email: 'ada@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  user_type: 'instructor',
  phone_number: null,
  profile_picture: null,
  bio: 'Writes notes.',
  country: 'United Kingdom',
  city: 'London',
  expertise: 'Engines',
  years_of_experience: 12,
  website_url: null,
  linkedin_url: 'https://www.linkedin.com/in/ada',
};

test('the form starts from the user and the profile, every field as text', () => {
  const values = profileValues(user, { payout_email: 'pay@example.com', interests: ['Python', 3, 'Data'] });

  expect(values).toMatchObject({
    first_name: 'Ada',
    phone_number: '',
    years_of_experience: '12',
    website_url: '',
    linkedin_url: 'https://www.linkedin.com/in/ada',
    payout_email: 'pay@example.com',
    interests: 'Python, Data',
    learning_goals: '',
  });
  expect(profileValues(null, null).first_name).toBe('');
});

test('interests are split on commas, blanks dropped, at most ten of forty characters', () => {
  expect(splitInterests('Python, data ,, SQL ')).toEqual(['Python', 'data', 'SQL']);
  expect(splitInterests(Array.from({ length: 12 }, (_, index) => `topic ${index}`).join(','))).toHaveLength(10);
  expect(splitInterests('x'.repeat(50))[0]).toHaveLength(40);
});

test('only the fields of the role are sent, trimmed', () => {
  const values = { ...profileValues(user, null), first_name: ' Ada ', learning_goals: 'Something', interests: 'A, B' };

  const instructor = profileChanges(values, 'instructor');
  expect(instructor.first_name).toBe('Ada');
  expect(instructor.years_of_experience).toBe(12);
  expect(instructor).not.toHaveProperty('learning_goals');

  const student = profileChanges(values, 'student');
  expect(student.interests).toEqual(['A', 'B']);
  expect(student).not.toHaveProperty('expertise');

  const admin = profileChanges(values, 'admin');
  expect(Object.keys(admin)).toEqual(['first_name', 'last_name', 'phone_number', 'bio', 'country', 'city']);
});

test('what is wrong is found before anything is sent', () => {
  const values = {
    ...profileValues(user, null),
    first_name: ' ',
    phone_number: '12',
    bio: 'x'.repeat(501),
    years_of_experience: '120',
    website_url: 'ada.example',
    linkedin_url: 'linkedin',
    payout_email: 'not-an-address',
    learning_goals: 'y'.repeat(1001),
  };

  expect(Object.keys(validateProfile(values, 'instructor')).sort()).toEqual([
    'bio', 'first_name', 'linkedin_url', 'payout_email', 'phone_number', 'website_url', 'years_of_experience',
  ]);
  expect(validateProfile(values, 'student')).toHaveProperty('learning_goals');
  expect(validateProfile(profileValues(user, null), 'instructor')).toEqual({});
});
