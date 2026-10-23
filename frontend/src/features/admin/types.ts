// What the admin area reads from the API.  Courses and users are listed by two other slices
// (courses, insights), revenue, reports and the platform by insights, the plans by billing; the
// shapes are the rows those views build for the administrator.
import type { CourseStatus, CourseType, ISODateTime, UserType, UUID } from '../../shared/types';

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
// Revenue (``GET /insights/admin/revenue/``)
// ---------------------------------------------------------------------------------------------

/** How many months the revenue screen covers. */
export type RevenueMonths = 6 | 12;

/** Where a month's figures come from: its revenue pool (the ledger) or its live payments. */
export type RevenueSource = 'ledger' | 'live';

export interface RevenueSummary {
  /** Over the months shown. */
  gross_revenue: number;
  instructor_share: number;
  platform_share: number;
  /** Completed Plus payments since the first of this month. */
  this_month: number;
  /** Students with Plus access now. */
  members: number;
  /** Members whose Plus renews. */
  renewing_members: number;
  /** Monthly recurring revenue of the renewing members. */
  mrr: number;
  failed_payments: number;
  earnings_paid: number;
  earnings_pending: number;
}

export interface RevenueMonth {
  /** "2026-05". */
  month: string;
  /** "May". */
  label: string;
  gross: number;
  instructor_share: number;
  platform_share: number;
  payments: number;
  new_members: number;
  source: RevenueSource;
}

export interface SubscriptionCounts {
  active: number;
  cancelled: number;
  lapsed: number;
  monthly: number;
  yearly: number;
}

export interface PlanMembers {
  cycle: 'monthly' | 'yearly';
  name: string;
  price: number;
  members: number;
}

export interface RevenueCourse {
  id: UUID;
  title: string;
  instructor: string;
  course_type: CourseType;
  earnings: number;
  enrollments: number;
}

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface RecentPayment {
  id: UUID;
  student: string;
  email: string;
  plan: 'monthly' | 'yearly';
  amount: number;
  status: PaymentStatus;
  date: ISODateTime;
}

export interface Revenue {
  currency: string;
  months: number;
  revenue_share_percent: number;
  summary: RevenueSummary;
  monthly: RevenueMonth[];
  subscriptions: SubscriptionCounts;
  plans: PlanMembers[];
  top_courses: RevenueCourse[];
  recent_payments: RecentPayment[];
}

// ---------------------------------------------------------------------------------------------
// Reports (``GET /insights/admin/reports/``, ``GET /insights/admin/reports/<id>/`` is a CSV file)
// ---------------------------------------------------------------------------------------------

export type ReportId = 'users' | 'courses' | 'enrollments' | 'payments' | 'earnings' | 'certificates';

export interface ReportInfo {
  id: ReportId;
  name: string;
  description: string;
  /** How many rows the file has right now. */
  rows: number;
}

/** A downloaded report: the file and the name the server gave it. */
export interface ReportFile {
  blob: Blob;
  filename: string;
}

// ---------------------------------------------------------------------------------------------
// Platform settings (``GET /insights/admin/platform/``, ``GET|PUT /billing/admin/plans/``)
// ---------------------------------------------------------------------------------------------

export interface PlatformRules {
  revenue_share_percent: number;
  course_passing_grade: number;
  quiz_submit_grace_seconds: number;
  access_token_minutes: number;
  refresh_token_days: number;
}

export interface PlatformCategory {
  id: number;
  name: string;
  slug: string;
  courses: number;
  published: number;
}

export interface PlatformLanguage {
  id: number;
  code: string;
  name: string;
  courses: number;
}

export interface PlatformEnvironment {
  demo_mode: boolean;
  debug: boolean;
  database: string;
  realtime: string;
  stripe: boolean;
  api_version: string;
}

export interface Platform {
  rules: PlatformRules;
  categories: PlatformCategory[];
  languages: PlatformLanguage[];
  environment: PlatformEnvironment;
}

export type PlanCycle = 'monthly' | 'yearly';

/** A plan as the administrator edits it. */
export interface AdminPlan {
  cycle: PlanCycle;
  name: string;
  description: string;
  price: number;
  /** False while the built-in default of the cycle is what is sold. */
  configured: boolean;
  members: number;
}

/** ``PUT /billing/admin/plans/<cycle>/``. */
export interface PlanChanges {
  name: string;
  description: string;
  price: number;
}
