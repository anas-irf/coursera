import api from '../../shared/api/client';
import type {
  Achievements,
  AnalyticsMonths,
  InstructorAnalytics,
  InstructorDashboard,
  InstructorEarnings,
  StudentStats,
  WeeklyProgress,
} from './types';

// --- student -----------------------------------------------------------------
export const fetchStudentStats = (): Promise<StudentStats> =>
  api.get<StudentStats>('/insights/student/stats/').then((response) => response.data);

export const fetchWeeklyProgress = (): Promise<WeeklyProgress> =>
  api.get<WeeklyProgress>('/insights/student/weekly-progress/').then((response) => response.data);

export const fetchAchievements = (): Promise<Achievements> =>
  api.get<Achievements>('/insights/student/achievements/').then((response) => response.data);

// --- instructor ---------------------------------------------------------------
export const fetchInstructorDashboard = (): Promise<InstructorDashboard> =>
  api.get<InstructorDashboard>('/insights/instructor/dashboard/').then((response) => response.data);

export const fetchInstructorEarnings = (): Promise<InstructorEarnings> =>
  api.get<InstructorEarnings>('/insights/instructor/earnings/').then((response) => response.data);

/** Learners, completions, quizzes and earnings of the instructor's courses over the last ``months``. */
export const fetchInstructorAnalytics = (months: AnalyticsMonths): Promise<InstructorAnalytics> =>
  api
    .get<InstructorAnalytics>('/insights/instructor/analytics/', { params: { months } })
    .then((response) => response.data);
