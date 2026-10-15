// What the admin area reads from the API, and the shapes of its screens that have no backend yet
// (the sample data).  Courses and users are listed by two other slices (courses, insights); the
// shapes are the rows those views build for the administrator.
import type { CourseStatus, CourseType, ISODate, ISODateTime, UserType, UUID } from '../../shared/types';

/** The instructor of a course, as the review lists name them. */
export interface CourseInstructor {
  id: UUID;
  name: string;
  email: string;
}

/** What the approval queue and the all-courses list have in common. */
export interface AdminCourseSummary {
  id: UUID;
  title: string;
  instructor: CourseInstructor;
  /** The name of the category ("Uncategorized" when there is none). */
  category: string;
  course_type: CourseType;
  sections_count: number;
  lectures_count: number;
  /** The graded weights of the course in percent; it can only be published at exactly 100. */
  total_weight: number;
  description: string;
  thumbnail: string | null;
  duration_hours: number;
}

/** A row of the approval queue (``GET /courses/admin/pending/``). */
export interface PendingCourse extends AdminCourseSummary {
  submitted_date: ISODateTime;
}

/** A row of the list of every course (``GET /courses/admin/all/``). */
export interface AdminCourse extends AdminCourseSummary {
  status: CourseStatus;
  created_date: ISODateTime;
  published_date: ISODateTime | null;
  total_enrolled: number;
  average_rating: number;
}

interface AdminUserBase<T extends UserType> {
  /** The uuid of the user (the numeric ``id`` of the signed-in ``User`` is another thing). */
  id: UUID;
  name: string;
  email: string;
  user_type: T;
  join_date: ISODateTime;
  last_login: ISODateTime | null;
  is_active: boolean;
  status: 'active' | 'inactive';
  phone_number: string;
  email_verified: boolean;
  /** An image URL; the screens draw initials instead and never request it. */
  avatar: string;
}

/** The figures of a student. */
export interface AdminStudent extends AdminUserBase<'student'> {
  courses_enrolled: number;
  completed_courses: number;
  active_courses: number;
}

/** The figures of an instructor. */
export interface AdminInstructor extends AdminUserBase<'instructor'> {
  courses_created: number;
  published_courses: number;
  draft_courses: number;
  students_taught: number;
}

/** An administrator has no course figures, only its rights. */
export interface AdminAdministrator extends AdminUserBase<'admin'> {
  is_superuser: boolean;
  is_admin: boolean;
}

/** A row of the user directory (``GET /insights/admin/users/``); the figures depend on the role. */
export type AdminUser = AdminStudent | AdminInstructor | AdminAdministrator;

/** The answer to an approval (``POST /courses/admin/<id>/approve/``). */
export interface ApproveResult {
  message: string;
  course_id: UUID;
  published_date: ISODateTime;
}

/** The answer to a rejection (``POST /courses/admin/<id>/reject/``). */
export interface RejectResult {
  message: string;
  course_id: UUID;
  reason: string;
  rejected_by: string;
  rejection_date: ISODateTime;
}

// ---------------------------------------------------------------------------------------------
// Screens without a backend (see sampleData.ts)
// ---------------------------------------------------------------------------------------------

/** The figures and series of the revenue screen. */
export interface RevenueSample {
  stats: {
    total_revenue: number;
    monthly_growth: number;
    total_subscriptions: number;
    avg_revenue_per_user: number;
  };
  revenue_chart: { month: string; revenue: number; subscriptions: number; courses_sold: number }[];
  top_courses: { name: string; revenue: number; enrollments: number }[];
}

export type ReportType =
  | 'user_activity'
  | 'course_performance'
  | 'financial'
  | 'instructor_performance'
  | 'platform_usage'
  | 'content_quality';

export type ReportFormat = 'PDF' | 'Excel' | 'CSV';

/** One report of the reports screen. */
export interface ReportRow {
  id: number;
  name: string;
  description: string;
  type: ReportType;
  /** A date: "2024-01-15". */
  last_generated: ISODate;
  /** "2.4 MB". */
  file_size: string;
  format: ReportFormat;
}

export interface ReportsSample {
  available_reports: ReportRow[];
}

/** The settings form of the platform: held in the page only, there is no endpoint to store them. */
export interface PlatformSettings {
  // general
  platform_name: string;
  platform_description: string;
  maintenance_mode: boolean;
  allow_registrations: boolean;
  // security
  require_email_verification: boolean;
  password_min_length: number;
  session_timeout: number;
  two_factor_auth: boolean;
  // notifications
  email_notifications: boolean;
  push_notifications: boolean;
  marketing_emails: boolean;
  system_alerts: boolean;
  // courses
  auto_approve_courses: boolean;
  require_instructor_approval: boolean;
  max_course_duration: number;
  min_course_price: number;
  max_course_price: number;
  // payments
  commission_rate: number;
  minimum_payout: number;
  payment_methods: string[];
  // content
  max_video_size: number;
  allowed_file_types: string[];
  content_moderation: boolean;
}
