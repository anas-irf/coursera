import {
  MAX_THUMBNAIL_BYTES,
  blankCourse,
  courseBody,
  courseValues,
  hasRequiredFields,
  isCourseType,
  isLevel,
  thumbnailProblem,
} from './course';

const picture = (overrides: Partial<Pick<File, 'type' | 'size'>> = {}) => ({
  type: 'image/png',
  size: 1024,
  ...overrides,
});

test('a select hands over text: only the levels and types the form offers are taken', () => {
  expect(isLevel('beginner')).toBe(true);
  expect(isLevel('advanced')).toBe(true);
  expect(isLevel('expert')).toBe(false);
  expect(isLevel('')).toBe(false);
  expect(isCourseType('free')).toBe(true);
  expect(isCourseType('coursera_plus')).toBe(true);
  expect(isCourseType('paid')).toBe(false);
});

test('a thumbnail must be a small picture', () => {
  expect(thumbnailProblem(picture())).toBeNull();
  expect(thumbnailProblem(picture({ type: 'image/webp' }))).toBeNull();
  expect(thumbnailProblem(picture({ type: 'application/pdf' }))).toMatch(/valid image/);
  expect(thumbnailProblem(picture({ size: MAX_THUMBNAIL_BYTES + 1 }))).toMatch(/5MB/);
});

test('the form of a stored course reads the ids of its category and language as strings', () => {
  expect(
    courseValues({
      title: 'Python', subtitle: '', description: 'About', category: 4, language: 2,
      level: 'advanced', course_type: 'free', estimated_hours: '12',
    })
  ).toEqual({
    title: 'Python', subtitle: '', description: 'About', category: '4', language: '2',
    level: 'advanced', course_type: 'free', estimated_hours: '12',
  });
  expect(courseValues({ title: 'No extras' })).toEqual({
    ...blankCourse(), title: 'No extras',
  });
});

test('title and description are required', () => {
  expect(hasRequiredFields({ ...blankCourse(), title: 'T', description: 'D' })).toBe(true);
  expect(hasRequiredFields({ ...blankCourse(), title: '  ', description: 'D' })).toBe(false);
  expect(hasRequiredFields(blankCourse())).toBe(false);
});

test('without a new thumbnail the body is a plain object and carries the chosen category and language', () => {
  const body = courseBody(
    { ...blankCourse(), title: ' Python ', description: 'About', category: '4', language: '2', estimated_hours: '7.5' },
    null
  );

  expect(body).toEqual({
    title: 'Python', subtitle: '', description: 'About', level: 'beginner', course_type: 'coursera_plus',
    estimated_hours: 7.5, category: 4, language: 2,
  });
  expect(body).not.toHaveProperty('slug'); // the server makes it
  expect(body).not.toHaveProperty('status');
});

test('nothing is sent for a category or language that was not chosen', () => {
  const body = courseBody({ ...blankCourse(), title: 'T', description: 'D' }, null);

  expect(body).not.toHaveProperty('category');
  expect(body).not.toHaveProperty('language');
});

test('a new thumbnail makes the body multipart', () => {
  const file = new File(['x'], 'cover.png', { type: 'image/png' });
  const body = courseBody({ ...blankCourse(), title: 'T', description: 'D', category: '4' }, file);

  expect(body).toBeInstanceOf(FormData);
  expect(body.get('title')).toBe('T');
  expect(body.get('category')).toBe('4');
  expect(body.get('thumbnail')).toBeInstanceOf(File);
});

test('hours that are not a number become zero instead of NaN', () => {
  expect(courseBody({ ...blankCourse(), estimated_hours: '' }, null).estimated_hours).toBe(0);
});
