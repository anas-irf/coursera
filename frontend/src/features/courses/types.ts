import type { ContentType, CourseLevel, CourseStatus, CourseType, ISODateTime, UUID } from '../../shared/types';

// ---------------------------------------------------------------------------------------------
// the instructor's courses
// ---------------------------------------------------------------------------------------------

/**
 * One row of ``GET /courses/instructor/courses/`` (``total_revenue`` is a column the billing
 * slice adds to it).
 */
export interface InstructorCourseRow {
  id: UUID;
  title: string;
  status: CourseStatus;
  course_type: CourseType;
  total_enrolled: number;
  average_rating: number;
  created_at: ISODateTime;
  thumbnail: string | null;
  total_revenue: number;
  /**
   * The list never sends these three, yet the page draws the rejection box from the last two and
   * the search reads the first: they are declared because the code reads them, and are absent in
   * every answer today.
   */
  description?: string;
  rejection_reason?: string | null;
  rejection_date?: ISODateTime | null;
}

/** What the course form offers as a category: ``GET /courses/categories/``. */
export interface Category {
  id: number;
  name: string;
  slug: string;
}

/** What the course form offers as a language: ``GET /courses/languages/``. */
export interface Language {
  id: number;
  code: string;
  name: string;
}

/**
 * ``GET /courses/instructor/courses/<id>/``: every column of the course, its sections, and the
 * names of its category and language.  Decimals (``estimated_hours``, ``duration_hours``,
 * ``average_rating``) arrive as strings; the foreign keys are the keys of the rows they point at.
 */
export interface CourseDetail {
  id: UUID;
  uuid: UUID;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  instructor: number;
  co_instructors: number[];
  course_type: CourseType;
  category: number | null;
  subcategory: number | null;
  tags: number[];
  level: CourseLevel;
  language: number | null;
  duration_hours: string;
  thumbnail: string | null;
  preview_video: string | null;
  requirements: unknown;
  what_you_learn: unknown;
  who_is_for: string;
  estimated_hours: string;
  status: CourseStatus;
  is_featured: boolean;
  rejection_reason: string | null;
  rejection_date: ISODateTime | null;
  rejected_by: number | null;
  total_enrolled: number;
  total_reviews: number;
  average_rating: string;
  published_date: ISODateTime | null;
  last_updated: ISODateTime;
  meta_description: string;
  meta_keywords: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  sections: CurriculumSection[];
  /** Left out of the answer for a course that has no category (or no language). */
  category_name?: string;
  language_name?: string;
}

/** What the course form holds while it is filled in: every control is text. */
export interface CourseFormValues {
  title: string;
  subtitle: string;
  description: string;
  /** The key of the chosen category as text, ``''`` for none. */
  category: string;
  /** The key of the chosen language as text, ``''`` for none. */
  language: string;
  level: CourseLevel;
  course_type: CourseType;
  estimated_hours: string;
}

/** The JSON body of a course request (the category and the language only when one was chosen). */
export interface CourseFields {
  title: string;
  subtitle: string;
  description: string;
  level: CourseLevel;
  course_type: CourseType;
  estimated_hours: number;
  category?: number;
  language?: number;
}

/** A plain object (a JSON request), or FormData (multipart) when a thumbnail goes with it. */
export type CourseBody = CourseFields | FormData;

// --- what the course endpoints answer ----------------------------------------------------------

export interface CreateCourseResponse {
  id: UUID;
  message: string;
  title: string;
}

/**
 * The course as the create serializer shows it: the columns of ``CourseDetail`` without the
 * read-only statistics and the nested sections; its ``id`` is the database key, not the uuid.
 */
export interface UpdateCourseResponse
  extends Omit<
    CourseDetail,
    | 'id'
    | 'uuid'
    | 'instructor'
    | 'total_enrolled'
    | 'total_reviews'
    | 'average_rating'
    | 'published_date'
    | 'sections'
    | 'category_name'
    | 'language_name'
  > {
  id: number;
}

export interface SubmitForReviewResponse {
  status: 'pending_review';
  message: string;
}

export interface UnpublishResponse {
  message: string;
  course_id: UUID;
  status: CourseStatus;
}

export interface DeleteCourseResponse {
  message: string;
}

// ---------------------------------------------------------------------------------------------
// the curriculum
// ---------------------------------------------------------------------------------------------

/**
 * The kinds of question a quiz has.  The same union as in assessments, which this slice may not
 * import.
 */
export type QuestionType = 'multiple_choice' | 'true_false' | 'multiple_select' | 'fill_blank' | 'essay';

export interface QuizOption {
  /** Kept when the question is sent back, so that saving changes the option instead of replacing it. */
  id?: UUID;
  option_text: string;
  is_correct: boolean;
  order: number;
}

export interface QuizQuestion {
  /** Kept when the quiz is sent back (see ``QuizOption``); a question that was just added has none. */
  id?: UUID;
  question_text: string;
  question_type: QuestionType;
  points: number;
  explanation: string;
  /** The acceptable answers of a fill-in-the-blank question. */
  correct_answers?: string[];
  options: QuizOption[];
}

export interface QuizSettings {
  passing_score: number;
  /** Minutes; ``null`` for no limit. */
  time_limit: number | null;
  max_attempts: number;
  /** Percent of the final grade; ``0`` for a practice quiz. */
  weight: number;
  randomize_questions: boolean;
  show_answers: boolean;
}

/**
 * The settings of an assignment.  The server sends the attachment as ``attachment`` and
 * ``existing_attachment`` (its url); the form holds the file just chosen in ``attachment``.
 */
export interface AssignmentSettings {
  max_points: number;
  /** ``YYYY-MM-DDTHH:mm`` (the value of a ``datetime-local`` input), ``''`` or ``null`` for none. */
  due_date: string | null;
  passing_score: number;
  /** Percent of the final grade; ``0`` for a practice assignment. */
  weight: number;
  instructions: string;
  attachment?: string | File | null;
  existing_attachment?: string | null;
  allow_late_submission?: boolean;
}

/** The video of a video lecture (``null`` on a lecture of another kind). */
export interface VideoContent {
  video_url: string;
  video_file: string | null;
  duration: number;
  existing_video_name: string | null;
}

/** The document of a reading lecture (``null`` on a lecture of another kind). */
export interface ReadingDocument {
  file: string | null;
  existing_file: string | null;
  file_name: string | null;
  file_type: 'markdown_file' | 'pdf_file' | null;
  is_downloadable: boolean;
}

/**
 * A lecture as the instructor edits it.  Every lecture carries the same keys: the ones of a
 * kind it is not are ``null`` (``questions`` and ``article_content`` are empty).  Not to be
 * confused with the learner's ``PlayerLecture``.
 */
export interface CurriculumLecture {
  id: UUID;
  title: string;
  description: string;
  content_type: ContentType;
  order: number;
  is_preview: boolean;
  is_downloadable: boolean;
  /** Kept for the shape of version 1: always empty. */
  resources: unknown[];
  /** Percent of the learners that completed it. */
  completion_rate: number;
  video_content: VideoContent | null;
  subtitle_file: string | null;
  existing_video_name: string | null;
  existing_subtitle_name: string | null;
  article_content: string;
  reading_document: ReadingDocument | null;
  quiz_settings: QuizSettings | null;
  questions: QuizQuestion[];
  assignment_settings: AssignmentSettings | null;
}

/** A section with its lectures, as the instructor edits it. */
export interface CurriculumSection {
  id: UUID;
  title: string;
  description: string;
  order: number;
  is_preview: boolean;
  lectures: CurriculumLecture[];
  /** Seconds of video in the section. */
  total_duration: number;
}

/** What the section dialog holds, and what is sent to change a section. */
export interface SectionFormData {
  title: string;
  description: string;
  is_preview: boolean;
}

/** What is sent to create a section: the form and its position. */
export interface SectionPayload extends SectionFormData {
  order?: number;
}

/**
 * What the lecture dialog holds while it is open: the controls of the four lecture forms in one
 * flat object (a lecture is a video, a reading, a quiz or an assignment, and the dialog keeps
 * what was typed in the other tabs).
 */
export interface LectureFormData {
  title: string;
  description: string;
  content_type: ContentType;
  video_url: string;
  /** The url of the stored video, or the file just chosen. */
  video_file: File | string | null;
  subtitle_file: File | null;
  article_content: string;
  markdown_file: File | null;
  pdf_file: File | null;
  questions: QuizQuestion[];
  quiz_settings: QuizSettings;
  assignment_settings: AssignmentSettings;
  reading_document: ReadingDocument | null;
  is_preview: boolean;
  is_downloadable: boolean;
  existing_video_name: string | null;
  existing_subtitle_name: string | null;
}

/**
 * What a lecture request is made of: the dialog's state, the files it holds apart
 * (``reading_file``, the attachment inside ``assignment_settings``) and the position.  A field
 * that is ``null`` or missing is not sent.
 */
export type LecturePayload = {
  [Field in keyof LectureFormData]?: LectureFormData[Field] | null;
} & {
  order?: number | null;
  reading_file?: File | null;
};

/** One entry of a reorder request: the position (from 1) a section or lecture is given. */
export interface ReorderItem {
  uuid: UUID;
  order: number;
}

export interface ReorderResponse {
  message: string;
}
