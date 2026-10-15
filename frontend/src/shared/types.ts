// Types that more than one feature uses.  What belongs to one slice lives in
// features/<slice>/types.ts and reaches the others through the slice's index.

/** A uuid, as the API sends it (courses, sections, lectures, enrollments ...). */
export type UUID = string;

/** An ISO 8601 timestamp: "2026-10-12T09:30:00Z". */
export type ISODateTime = string;

/** An ISO 8601 date: "2026-10-12". */
export type ISODate = string;

export type UserType = 'student' | 'instructor' | 'admin';

export type CourseStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'unpublished';
export type CourseType = 'free' | 'coursera_plus';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
export type ContentType = 'video' | 'reading' | 'quiz' | 'assignment';
export type EnrollmentStatus = 'active' | 'completed';

/**
 * The body of an error response: ``{error, code?}`` for the domain errors of the backend,
 * ``{detail}`` for DRF and ``{field: [message, ...]}`` for serializers.  Some carry more
 * (``requires_subscription``, ``checkout_url``), hence the open index.
 */
export interface ApiErrorBody {
  error?: string;
  code?: string;
  detail?: string;
  message?: string;
  [field: string]: unknown;
}
