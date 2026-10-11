import api from '../../shared/api/client';

/** Published courses; ``filters`` may hold category, level, type, search and sort ("all"/empty are skipped). */
export const listCourses = (filters = {}) => {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all') params[key] = value;
  });
  return api.get('/learning/courses/', { params }).then((response) => response.data);
};

export const myCourses = () => api.get('/learning/enrolled/').then((response) => response.data);

export const enroll = (courseId) =>
  api.post(`/learning/courses/${courseId}/enroll/`).then((response) => response.data);

/** Toggles the bookmark; resolves with the server message. */
export const toggleBookmark = (courseId) =>
  api.post(`/learning/courses/${courseId}/bookmark/`).then((response) => response.data);

/** The player payload: course, enrollment, sections with lectures and progress. */
export const fetchPlayer = (courseId) =>
  api.get(`/learning/courses/${courseId}/learn/`).then((response) => response.data);

export const completeLecture = (courseId, lectureId) =>
  api.post(`/learning/courses/${courseId}/lectures/${lectureId}/complete/`).then((response) => response.data);

// --- instructor: the learners of the instructor's courses -------------------
export const courseStudents = (courseId) =>
  api.get(`/learning/instructor/courses/${courseId}/students/`).then((response) => response.data);

export const instructorStudents = () =>
  api.get('/learning/instructor/students/').then((response) => response.data);
