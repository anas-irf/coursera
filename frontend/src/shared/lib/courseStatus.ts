import type { CourseStatus } from '../types';

/** The tones a status is drawn in (the same names as the badges of the UI kit). */
export type StatusTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'plus';

export interface CourseStatusInfo {
  label: string;
  tone: StatusTone;
}

/**
 * What a course's moderation state is called and how it is drawn, in one place: the instructor's
 * list, the admin's tables, the charts and the approval queue used to keep their own (the
 * admin's did not know "rejected").
 */
export const COURSE_STATUS: Record<CourseStatus, CourseStatusInfo> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_review: { label: 'Pending Review', tone: 'info' },
  published: { label: 'Published', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  unpublished: { label: 'Unpublished', tone: 'warning' },
};

const UNKNOWN_TONE: StatusTone = 'warning';

// the status of a row is whatever the server sent, so it is looked up as a plain string
const KNOWN: Partial<Record<string, CourseStatusInfo>> = COURSE_STATUS;

/** ``{label, tone}`` of a status; an unknown one is shown as it is. */
export const courseStatus = (status: string | null | undefined): CourseStatusInfo =>
  (status ? KNOWN[status] : undefined) || { label: status || 'Unknown', tone: UNKNOWN_TONE };
