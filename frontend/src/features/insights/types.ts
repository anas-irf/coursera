// What the insights endpoints answer: the student's figures and achievements, the instructor's
// dashboard and earnings.
//
// Field names are the API's (snake_case): pages read the wire fields directly.  Ids of courses
// are uuid strings; money is a JSON number in dollars; a rating of 0 means "no reviews yet".
import type { CourseStatus, CourseType, ISODate, ISODateTime, UUID } from '../../shared/types';

// --- the student's home page and achievements -----------------------------------

/** ``GET /insights/student/stats/``: the figures of the student's home page. */
export interface StudentStats {
  courses_enrolled: number;
  courses_active: number;
  courses_completed: number;
  certificates_earned: number;
  /** The mean progress over the enrolments, one decimal. */
  total_progress: number;
  has_plus_subscription: boolean;
  /** Consecutive days with learning activity, counting back from today. */
  learning_streak: number;
  /** Hours, two decimals. */
  total_learning_hours: number;
}

/** One bar of the learning chart: the hours learned in a month. */
export interface MonthlyHours {
  /** The abbreviated month name ("Oct"). */
  month: string;
  hours: number;
}

/** ``GET /insights/student/weekly-progress/``: the last months, oldest first (the names are historic). */
export interface WeeklyProgress {
  monthly_progress: MonthlyHours[];
}

/** One badge of the achievements page. */
export interface Achievement {
  id: number;
  title: string;
  description: string;
  /** An emoji. */
  icon: string;
  earned: boolean;
  /** The day it was earned, ``null`` while it is not. */
  date: ISODate | null;
  /** Percent towards the badge; 100 once it is earned. */
  progress: number;
}

/** ``GET /insights/student/achievements/``. */
export interface Achievements {
  total_points: number;
  current_level: number;
  next_level_points: number;
  /** Place among all students by time learned (1 is the most). */
  global_rank: number;
  /** ``null`` for a student that did not learn this month. */
  monthly_rank: number | null;
  achievements: Achievement[];
}

// --- the instructor's dashboard -------------------------------------------------

export interface DashboardStats {
  total_courses: number;
  /** Distinct learners over all the instructor's courses. */
  total_students: number;
  /** The instructor's share, all time. */
  total_revenue: number;
  /** 0 while no course has been rated (reviews do not exist yet). */
  average_rating: number;
  published_courses: number;
  draft_courses: number;
}

export interface RecentEnrollment {
  student_name: string;
  student_email: string;
  course_title: string;
  enrolled_date: ISODateTime;
}

/** One day of the revenue chart. */
export interface RevenuePoint {
  date: ISODate;
  revenue: number;
}

/** A course of the "top performing" list. */
export interface TopCourse {
  id: UUID;
  title: string;
  course_type: CourseType;
  total_enrolled: number;
  average_rating: number;
  total_revenue: number;
  thumbnail: string | null;
}

/** ``GET /insights/instructor/dashboard/``. */
export interface InstructorDashboard {
  stats: DashboardStats;
  /** The ten newest. */
  recent_enrollments: RecentEnrollment[];
  /** The last 30 days, days without earnings count as 0. */
  revenue_chart: RevenuePoint[];
  /** At most three, by revenue. */
  top_courses: TopCourse[];
}

// --- the instructor's earnings --------------------------------------------------

export interface EarningsSummary {
  /** Paid out so far. */
  total_earnings: number;
  /** Earned and not paid out yet. */
  pending_earnings: number;
  /** Calculated for the current month. */
  monthly_earnings: number;
  /** What the platform keeps of the Plus revenue, in percent. */
  platform_fee_rate: number;
}

/** One bar of the earnings chart (the last six months, oldest first). */
export interface MonthlyEarnings {
  /** The abbreviated month name ("Oct"). */
  month: string;
  earnings: number;
}

export type EarningStatus = 'Paid' | 'Pending';

/** One course and month of the calculation. */
export interface EarningRow {
  id: UUID;
  /** "October 2026". */
  month: string;
  /** The course's title. */
  course: string;
  enrollments: number;
  completions: number;
  engagement_score: number;
  amount: number;
  multiplier: number;
  status: EarningStatus;
}

/** A line of the older transaction list: no page reads it, the rows above replaced it. */
export interface EarningTransaction {
  date: ISODate;
  course: string;
  /** Always ``null``: a share of a pool, not a payment by one student. */
  student_email: null;
  amount: number;
  status: EarningStatus;
}

/** The current month's totals over the instructor's courses. */
export interface EarningsPerformance {
  monthly_enrollments: number;
  monthly_completions: number;
  engagement_score: number;
}

/** How the share is worked out, as the page explains it. */
export interface EarningsModel {
  description: string;
  factors: string[];
}

/** ``GET /insights/instructor/earnings/``. */
export interface InstructorEarnings {
  summary: EarningsSummary;
  recent_transactions: EarningTransaction[];
  monthly_chart: MonthlyEarnings[];
  performance: EarningsPerformance;
  /** The twelve newest rows. */
  recent_earnings: EarningRow[];
  earnings_model: EarningsModel;
}

// --- the instructor's analytics -------------------------------------------------

/** The periods the analytics page offers, in months. */
export type AnalyticsMonths = 3 | 6 | 12;

/** The figures over all the instructor's courses; a rate or an average is ``null`` when nothing was there to compute it from. */
export interface AnalyticsTotals {
  courses: number;
  published_courses: number;
  /** Distinct learners. */
  students: number;
  enrollments: number;
  /** Distinct learners active in the last seven days. */
  active_learners: number;
  completions: number;
  /** Percent, one decimal. */
  completion_rate: number | null;
  average_progress: number | null;
  /** Finished attempts of the quizzes of the courses. */
  quiz_attempts: number;
  average_quiz_score: number | null;
  quiz_pass_rate: number | null;
  /** Hand-ins of the assignments of the courses. */
  submissions: number;
  pending_submissions: number;
  /** The instructor's earning rows, all time. */
  earnings: number;
  average_rating: number | null;
}

/** One calendar month of the period, oldest first. */
export interface AnalyticsMonth {
  /** "2026-05". */
  month: string;
  /** "May". */
  label: string;
  enrollments: number;
  completions: number;
  earnings: number;
}

export type ProgressBucketKey = 'not_started' | 'under_half' | 'over_half' | 'completed';

/** How many learners are at a stage of their course. */
export interface ProgressBucket {
  key: ProgressBucketKey;
  label: string;
  count: number;
}

/** One course of the instructor, any status. */
export interface CourseAnalytics {
  id: UUID;
  title: string;
  status: CourseStatus;
  course_type: CourseType;
  thumbnail: string | null;
  enrollments: number;
  active_learners: number;
  completions: number;
  completion_rate: number | null;
  average_progress: number | null;
  average_quiz_score: number | null;
  average_rating: number | null;
  total_reviews: number;
  revenue: number;
}

/** ``GET /insights/instructor/analytics/?months=3|6|12``. */
export interface InstructorAnalytics {
  months: AnalyticsMonths;
  totals: AnalyticsTotals;
  monthly: AnalyticsMonth[];
  progress_distribution: ProgressBucket[];
  /** Most enrollments first. */
  courses: CourseAnalytics[];
}
