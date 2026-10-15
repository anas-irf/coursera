import type { CourseStatus } from '../types';

export interface CourseStatusInfo {
  label: string;
  badge: string;
}

/**
 * What a course's moderation state is called and how it is drawn, in one place: the instructor's
 * list, the admin's tables and the approval queue used to keep their own (the admin's did not
 * know "rejected").
 */
export const COURSE_STATUS: Record<CourseStatus, CourseStatusInfo> = {
  draft: { label: 'Draft', badge: 'bg-gray-100 text-gray-800' },
  pending_review: { label: 'Pending Review', badge: 'bg-blue-100 text-blue-800' },
  published: { label: 'Published', badge: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-800' },
  unpublished: { label: 'Unpublished', badge: 'bg-yellow-100 text-yellow-800' },
};

const UNKNOWN_BADGE = 'bg-yellow-100 text-yellow-800';

// the status of a row is whatever the server sent, so it is looked up as a plain string
const KNOWN: Partial<Record<string, CourseStatusInfo>> = COURSE_STATUS;

/** ``{label, badge}`` of a status; an unknown one is shown as it is. */
export const courseStatus = (status: string | null | undefined): CourseStatusInfo =>
  (status ? KNOWN[status] : undefined) || { label: status || 'Unknown', badge: UNKNOWN_BADGE };
