import type { ISODateTime } from '../../shared/types';

/** What a notification is about (``Notification.notification_type`` of the backend). */
export type NotificationType =
  | 'course_rejected'
  | 'course_approved'
  | 'course_published'
  | 'course_submission'
  | 'enrollment'
  | 'course_update'
  | 'assignment_due'
  | 'assignment_graded'
  | 'quiz_available'
  | 'certificate_earned'
  | 'payment_success'
  | 'payment_failed'
  | 'announcement'
  | 'message'
  | 'review'
  | 'system';

/** Something the user was told; named so it does not hide the DOM's ``Notification``. */
export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: ISODateTime;
  read_at: ISODateTime | null;
  /** Where the notification leads: a path of the app ("/student/grades") or an absolute url. */
  action_url: string | null;
}

/** ``GET /notifications/count/``. */
export interface UnreadCountResponse {
  unread_count: number;
}

/** ``POST /notifications/<id>/read/``. */
export interface MarkReadResponse {
  message: string;
}

/** ``POST /notifications/read-all/``: how many were marked. */
export interface MarkAllReadResponse {
  marked_read: number;
}
