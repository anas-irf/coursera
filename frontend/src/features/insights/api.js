import api from '../../shared/api/client';

// These read models are served from the prefix of the app they were first written in.

// --- student -----------------------------------------------------------------
export const fetchStudentStats = () =>
  api.get('/auth/student/stats/').then((response) => response.data);

export const fetchWeeklyProgress = () =>
  api.get('/auth/student/weekly-progress/').then((response) => response.data);

export const fetchAchievements = () =>
  api.get('/courses/student/achievements/').then((response) => response.data);

// --- instructor ---------------------------------------------------------------
export const fetchInstructorDashboard = () =>
  api.get('/courses/instructor/dashboard/').then((response) => response.data);

export const fetchInstructorEarnings = () =>
  api.get('/payments/instructor/earnings/').then((response) => response.data);

export const fetchCourseAnalytics = (courseId) =>
  api
    .get(`/courses/instructor/courses/${courseId}/analytics/`)
    .then((response) => response.data);
