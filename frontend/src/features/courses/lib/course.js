/** Pure helpers of the course form: validation, the values of a stored course, the request body. */

export const THUMBNAIL_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

export const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const COURSE_TYPES = [
  { value: 'coursera_plus', label: 'Coursera Plus (Paid via subscription)' },
  { value: 'free', label: 'Free Course (No earnings)' },
];

/** Why a picture cannot be the thumbnail, or ``null`` when it can. */
export function thumbnailProblem(file) {
  if (!THUMBNAIL_TYPES.includes(file.type)) {
    return 'Please select a valid image file (JPEG, JPG, PNG, or WebP)';
  }
  if (file.size > MAX_THUMBNAIL_BYTES) {
    return 'File size must be less than 5MB';
  }
  return null;
}

/** The form of a course that does not exist yet. */
export const blankCourse = () => ({
  title: '',
  subtitle: '',
  description: '',
  category: '',
  language: '',
  level: 'beginner',
  course_type: 'coursera_plus',
  estimated_hours: '10',
});

/** The form values of a stored course (``GET courses/instructor/courses/<id>/``). */
export function courseValues(course) {
  return {
    title: course.title || '',
    subtitle: course.subtitle || '',
    description: course.description || '',
    category: course.category ? String(course.category) : '',
    language: course.language ? String(course.language) : '',
    level: course.level || 'beginner',
    course_type: course.course_type || 'coursera_plus',
    estimated_hours: String(course.estimated_hours || 10),
  };
}

/** True when the title and the description are filled in. */
export const hasRequiredFields = (values) =>
  Boolean(values.title.trim()) && Boolean(values.description.trim());

/**
 * The request body for creating or changing a course.
 *
 * Without a ``thumbnail`` it is a plain object (a JSON request); with one it is a FormData
 * (multipart).  The category and the language are sent when one was chosen; the slug is made by
 * the server.
 */
export function courseBody(values, thumbnail) {
  const fields = {
    title: values.title.trim(),
    subtitle: values.subtitle.trim(),
    description: values.description.trim(),
    level: values.level,
    course_type: values.course_type,
    estimated_hours: Number(values.estimated_hours) || 0,
  };
  if (values.category) fields.category = Number(values.category);
  if (values.language) fields.language = Number(values.language);

  if (!thumbnail) return fields;

  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  form.append('thumbnail', thumbnail);
  return form;
}
