/**
 * What an instructor can do with a course in each moderation state.
 *
 * draft -> (submit) pending_review -> published | rejected -> (resubmit) pending_review ...
 * and published -> (unpublish) draft.  The button of a course is described by ``publishAction``.
 */
import type { CourseStatus } from '../../../shared/types';

export type PublishTone = 'success' | 'info' | 'danger' | 'waiting';

/** The publish button of a course. */
export interface PublishAction {
  kind: 'submit' | 'unpublish' | null;
  label: string;
  tone: PublishTone;
  disabled: boolean;
}

const ACTIONS: Partial<Record<CourseStatus, PublishAction>> = {
  draft: { kind: 'submit', label: 'Request Publish', tone: 'success', disabled: false },
  rejected: { kind: 'submit', label: 'Resubmit for Review', tone: 'info', disabled: false },
  published: { kind: 'unpublish', label: 'Unpublish', tone: 'danger', disabled: false },
  pending_review: { kind: null, label: 'Under Review', tone: 'waiting', disabled: true },
};

// a state the workflow never produces: shown, but nothing can be done from it
const FALLBACK: PublishAction = { kind: null, label: 'Request Publish', tone: 'success', disabled: true };

/** ``{kind: 'submit' | 'unpublish' | null, label, tone, disabled}`` of the publish button. */
export const publishAction = (status: CourseStatus | null | undefined): PublishAction =>
  (status && ACTIONS[status]) || FALLBACK;

/** A published course is unpublished before it can be changed or deleted. */
export const isLocked = (status: CourseStatus | null | undefined): boolean => status === 'published';

export const LOCKED_EDIT_HINT = 'Cannot edit published courses. Please unpublish first.';
export const LOCKED_DELETE_HINT = 'Cannot delete published courses. Please unpublish first.';
