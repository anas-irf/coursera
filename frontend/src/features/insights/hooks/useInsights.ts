import { useQuery } from '@tanstack/react-query';

import * as insightsApi from '../api';

/** Query keys of the insights (``['insights', audience, resource]``). */
export const insightsKeys = {
  all: ['insights'] as const,
  studentStats: ['insights', 'student', 'stats'] as const,
  weeklyProgress: ['insights', 'student', 'weekly-progress'] as const,
  achievements: ['insights', 'student', 'achievements'] as const,
  instructorDashboard: ['insights', 'instructor', 'dashboard'] as const,
  instructorEarnings: ['insights', 'instructor', 'earnings'] as const,
};

/** The four figures of the student's home page. */
export function useStudentStats() {
  return useQuery({ queryKey: insightsKeys.studentStats, queryFn: insightsApi.fetchStudentStats });
}

/** Hours learned per month (``{monthly_progress: [{month, hours}]}``). */
export function useWeeklyProgress() {
  return useQuery({ queryKey: insightsKeys.weeklyProgress, queryFn: insightsApi.fetchWeeklyProgress });
}

export function useAchievements() {
  return useQuery({ queryKey: insightsKeys.achievements, queryFn: insightsApi.fetchAchievements });
}

export function useInstructorDashboard() {
  return useQuery({
    queryKey: insightsKeys.instructorDashboard,
    queryFn: insightsApi.fetchInstructorDashboard,
  });
}

export function useInstructorEarnings() {
  return useQuery({
    queryKey: insightsKeys.instructorEarnings,
    queryFn: insightsApi.fetchInstructorEarnings,
  });
}
