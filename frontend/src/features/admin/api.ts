import api from '../../shared/api/client';
import type { UUID } from '../../shared/types';
import type { AdminCourse, AdminUser, ApproveResult, PendingCourse, RejectResult } from './types';

// moderation is part of the courses slice
const BASE = '/courses/admin';

/** Courses waiting for a review decision. */
export const pendingCourses = (): Promise<PendingCourse[]> =>
  api.get<PendingCourse[]>(`${BASE}/pending/`).then((response) => response.data);

/** Every course with its status and instructor. */
export const allCourses = (): Promise<AdminCourse[]> =>
  api.get<AdminCourse[]>(`${BASE}/all/`).then((response) => response.data);

/** Every user with the figures of their role. */
export const users = (): Promise<AdminUser[]> =>
  api.get<AdminUser[]>('/insights/admin/users/').then((response) => response.data);

export const approveCourse = (courseId: UUID): Promise<ApproveResult> =>
  api.post<ApproveResult>(`${BASE}/${courseId}/approve/`).then((response) => response.data);

export const rejectCourse = (courseId: UUID, reason: string): Promise<RejectResult> =>
  api.post<RejectResult>(`${BASE}/${courseId}/reject/`, { reason }).then((response) => response.data);
