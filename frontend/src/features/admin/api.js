import api from '../../shared/api/client';

// Moderation and the user directory are served below /courses/admin/.
const BASE = '/courses/admin';

/** Courses waiting for a review decision. */
export const pendingCourses = () => api.get(`${BASE}/pending/`).then((response) => response.data);

/** Every course with its status and instructor. */
export const allCourses = () => api.get(`${BASE}/all/`).then((response) => response.data);

/** Every user with the figures of their role. */
export const users = () => api.get(`${BASE}/users/`).then((response) => response.data);

export const approveCourse = (courseId) =>
  api.post(`${BASE}/${courseId}/approve/`).then((response) => response.data);

export const rejectCourse = (courseId, reason) =>
  api.post(`${BASE}/${courseId}/reject/`, { reason }).then((response) => response.data);
