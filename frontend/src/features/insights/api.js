import api from '../../shared/api/client';

// --- student -----------------------------------------------------------------
export const fetchStudentStats = () =>
  api.get('/insights/student/stats/').then((response) => response.data);

export const fetchWeeklyProgress = () =>
  api.get('/insights/student/weekly-progress/').then((response) => response.data);

export const fetchAchievements = () =>
  api.get('/insights/student/achievements/').then((response) => response.data);

// --- instructor ---------------------------------------------------------------
export const fetchInstructorDashboard = () =>
  api.get('/insights/instructor/dashboard/').then((response) => response.data);

export const fetchInstructorEarnings = () =>
  api.get('/insights/instructor/earnings/').then((response) => response.data);

export const fetchCourseAnalytics = (courseId) =>
  api
    .get(`/insights/instructor/courses/${courseId}/analytics/`)
    .then((response) => response.data);
