import api from '../../shared/api/client';
import type { UUID } from '../../shared/types';
import type {
  AdminCourse,
  AdminPlan,
  AdminUser,
  ApproveResult,
  PendingCourse,
  PlanChanges,
  PlanCycle,
  Platform,
  RejectResult,
  ReportFile,
  ReportId,
  ReportInfo,
  Revenue,
  RevenueMonths,
} from './types';

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

/** Plus revenue, the instructors' share and the memberships over the last ``months``. */
export const revenue = (months: RevenueMonths): Promise<Revenue> =>
  api.get<Revenue>('/insights/admin/revenue/', { params: { months } }).then((response) => response.data);

/** The reports that can be downloaded, with their size today. */
export const reports = (): Promise<ReportInfo[]> =>
  api.get<ReportInfo[]>('/insights/admin/reports/').then((response) => response.data);

const FILENAME = /filename="?([^";]+)"?/i;

/** A report as a CSV file, named as the server names it (``users-2026-10-23.csv``). */
export const downloadReport = (id: ReportId): Promise<ReportFile> =>
  api.get<Blob>(`/insights/admin/reports/${id}/`, { responseType: 'blob' }).then((response) => {
    const disposition = String(response.headers['content-disposition'] || '');
    const match = FILENAME.exec(disposition);
    return { blob: response.data, filename: match ? match[1] : `${id}.csv` };
  });

/** The rules, the categories and languages, and how the server runs. */
export const platform = (): Promise<Platform> =>
  api.get<Platform>('/insights/admin/platform/').then((response) => response.data);

/** The two Coursera Plus plans as they are sold (monthly, then yearly). */
export const plans = (): Promise<AdminPlan[]> =>
  api.get<AdminPlan[]>('/billing/admin/plans/').then((response) => response.data);

export const updatePlan = (cycle: PlanCycle, changes: PlanChanges): Promise<AdminPlan> =>
  api.put<AdminPlan>(`/billing/admin/plans/${cycle}/`, changes).then((response) => response.data);
