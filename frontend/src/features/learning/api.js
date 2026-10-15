import api from '../../shared/api/client';

const withoutBlanks = (filters) => {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all') params[key] = value;
  });
  return params;
};

/**
 * One page of the published courses and how many match in all (``X-Total-Count``).
 * ``filters`` may hold category, level, type, search and sort ("all"/empty are skipped).
 */
export const listCoursesPage = ({ filters = {}, page = 1, pageSize = 12 } = {}) =>
  api
    .get('/learning/courses/', { params: { ...withoutBlanks(filters), page, page_size: pageSize } })
    .then((response) => ({
      items: response.data,
      total: Number(response.headers['x-total-count'] || response.data.length),
    }));

/** The student's courses: ``status`` is "active" (running, the default), "completed" or "all". */
export const myCourses = ({ status = 'active' } = {}) =>
  api.get('/learning/enrolled/', { params: { status } }).then((response) => response.data);

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

/** Where the student is in a video (seconds); also credits the time spent watching. */
export const recordWatchProgress = (courseId, lectureId, { position, finished = false }) =>
  api
    .post(`/learning/courses/${courseId}/lectures/${lectureId}/progress/`, { position, finished })
    .then((response) => response.data);

// --- instructor: the learners of the instructor's courses -------------------
export const instructorStudents = () =>
  api.get('/learning/instructor/students/').then((response) => response.data);
