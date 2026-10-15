// What the learning endpoints answer: the catalogue, the student's courses, the course player and
// the instructor's roster.
//
// Field names are the API's (snake_case): components read the wire fields directly.  Ids are uuid
// strings; progress is a number from 0 to 100; times are ISO 8601 strings.
import type { CourseLevel, CourseType, EnrollmentStatus, ISODateTime, UUID } from '../../shared/types';
import type { AssignmentLecture, QuizLecture } from '../assessments';

// --- the catalogue (Explore) ----------------------------------------------------

/** Why a student cannot enrol: what the catalogue says besides ``can_enroll: false``. */
export type EnrollmentMessage = '' | 'Already enrolled' | 'Plus subscription required';

/** One course of ``GET /learning/courses/`` as its card draws it. */
export interface CatalogCourse {
  id: UUID;
  title: string;
  /** The instructor's name. */
  instructor: string;
  instructor_id: UUID;
  thumbnail: string | null;
  rating: number;
  /** How many students are enrolled. */
  students: number;
  /** "20 min", "1 hour", "5.5 hours", or "-" when no video length was recorded. */
  duration: string;
  duration_seconds: number;
  level: CourseLevel;
  /** The category's name ("General" for a course without one). */
  category: string;
  course_type: CourseType;
  /** The number of sections. */
  modules: number;
  /** Cut to 200 characters. */
  description: string;
  is_enrolled: boolean;
  is_bookmarked: boolean;
  /** True for everybody but a student who is enrolled or lacks the Plus membership the course needs. */
  can_enroll: boolean;
  enrollment_message: EnrollmentMessage;
  /** The student's own progress; 0 when not enrolled. */
  progress: number;
}

/** A page of the catalogue with how many courses match in all: built here from ``X-Total-Count``. */
export interface CatalogPage {
  items: CatalogCourse[];
  total: number;
}

/** The catalogue's filters, as the Explore page holds them: ``'all'`` or empty means no filter. */
export interface CatalogFilters {
  category: string;
  level: string;
  type: string;
  search: string;
  sort: string;
}

/** What one request for a page of the catalogue is made of. */
export interface CatalogRequest {
  filters?: Partial<CatalogFilters>;
  /** From 1. */
  page?: number;
  pageSize?: number;
}

/** ``POST /learning/courses/<id>/enroll/``. */
export interface EnrollResponse {
  message: string;
  /** The uuid of the new enrolment (not the course's). */
  enrollment_id: UUID;
}

/** ``POST /learning/courses/<id>/bookmark/``: "Course bookmarked" or "Bookmark removed". */
export interface BookmarkResponse {
  message: string;
}

// --- my courses -----------------------------------------------------------------

/** Which of the student's enrolments ``GET /learning/enrolled/`` lists (its ``status`` parameter). */
export type EnrolledView = 'active' | 'completed' | 'all';

/** One row of ``GET /learning/enrolled/``: an enrolment with the card data of its course. */
export interface EnrolledCourse {
  /** The enrolment's id; the course's is ``course_id``. */
  id: UUID;
  course_id: UUID;
  title: string;
  instructor: string;
  thumbnail: string | null;
  progress: number;
  status: EnrollmentStatus;
  last_accessed: ISODateTime | null;
  /** The title of the first lecture not finished, "All lessons completed" when there is none. */
  next_lesson: string;
  total_lessons: number;
  completed_lessons: number;
  /** "3 hours", "2 days", "1 weeks": worded by the server. */
  estimated_completion: string;
}

// --- the player -----------------------------------------------------------------

/** The fields every lecture of the player has, whatever its content. */
export interface LectureBase {
  id: UUID;
  title: string;
  description: string;
  order: number;
  is_preview: boolean;
  is_downloadable: boolean;
  is_completed: boolean;
  /** Seconds of the lecture the student has watched. */
  progress_seconds: number;
  /** Where to resume a video, in seconds. */
  last_watched_position: number;
  watch_count: number;
}

/** How a video lecture is served: embedded from YouTube, or a file the platform hosts. */
export type VideoType = 'youtube' | 'local';

export interface Subtitle {
  /** The language code ("en"). */
  language: string;
  language_name: string;
  url: string | null;
  is_auto_generated: boolean;
}

export interface PlayerVideoLecture extends LectureBase {
  content_type: 'video';
  video_type: VideoType;
  /** The YouTube address of a ``youtube`` lecture. */
  video_url: string | null;
  /** The media path of a hosted file. */
  video_file_url: string | null;
  /** Seconds; 0 when it was never recorded. */
  duration: number;
  /** The server has no picture for a video yet: always ``null`` today. */
  thumbnail: string | null;
  subtitles: Subtitle[];
}

export interface PlayerReadingLecture extends LectureBase {
  content_type: 'reading';
  /** HTML, cleaned by the server and again by ``safeHtml`` where it is shown. */
  content: string;
  /** Minutes. */
  estimated_reading_time: number;
  file_url: string | null;
}

/** A quiz lecture: the lecture fields plus the quiz block ``QuizRunner`` reads (owned by assessments). */
export interface PlayerQuizLecture extends LectureBase, QuizLecture {
  content_type: 'quiz';
}

/**
 * An assignment lecture: the lecture fields plus the assignment block ``AssignmentPanel`` reads
 * (owned by assessments).  The assignment's own title and description replace the lecture's.
 */
export interface PlayerAssignmentLecture extends LectureBase, AssignmentLecture {
  content_type: 'assignment';
}

/** A lecture of the player, narrowed on ``content_type``. */
export type PlayerLecture =
  | PlayerVideoLecture
  | PlayerReadingLecture
  | PlayerQuizLecture
  | PlayerAssignmentLecture;

export interface PlayerSection {
  id: UUID;
  title: string;
  description: string;
  order: number;
  is_preview: boolean;
  lectures: PlayerLecture[];
  completed_lectures: number;
  total_lectures: number;
}

export interface PlayerCourse {
  id: UUID;
  title: string;
  description: string;
  instructor: string;
  thumbnail: string | null;
  level: CourseLevel;
  category: string;
}

export interface PlayerEnrollment {
  id: UUID;
  enrolled_date: ISODateTime;
  progress_percentage: number;
  last_accessed: ISODateTime | null;
  status: EnrollmentStatus;
}

export interface PlayerProgress {
  total_lectures: number;
  completed_lectures: number;
  progress_percentage: number;
}

/** ``GET /learning/courses/<id>/learn/``: the whole learning interface of one course. */
export interface PlayerPayload {
  course: PlayerCourse;
  enrollment: PlayerEnrollment;
  sections: PlayerSection[];
  progress: PlayerProgress;
}

/** ``POST /learning/courses/<id>/lectures/<id>/complete/``. */
export interface CompleteLectureResponse {
  success: boolean;
  message: string;
  /** The course's progress after the lecture was marked. */
  progress_percentage: number;
}

/** What a watch heartbeat may say besides the position. */
export interface WatchOptions {
  /** True when the video reached its end. */
  finished?: boolean;
}

/** The body of a watch heartbeat: where the student is in a video, in seconds. */
export interface WatchReport extends WatchOptions {
  position: number;
}

/** ``POST /learning/courses/<id>/lectures/<id>/progress/``: what the server now has for the lecture. */
export interface WatchProgress {
  last_watched_position: number;
  progress_seconds: number;
  watch_count: number;
  /** Seconds the student has spent in the whole course. */
  total_time_spent: number;
}

/**
 * What a video player calls to say where the student is (``finished`` when it ended).  Best
 * effort: the answer is not needed and a failure is not reported.
 */
export type ReportWatch = (position: number, options?: WatchOptions) => unknown;

// --- the instructor's roster ----------------------------------------------------

/** One learner of the instructor's courses, with all their courses folded into one row. */
export interface InstructorStudent {
  id: UUID;
  name: string;
  email: string;
  /** The address of a generated picture. */
  avatar: string;
  /** "2 courses": worded by the server (the number is ``courses_enrolled_count``). */
  courses_enrolled: string;
  courses_enrolled_count: number;
  /** The mean progress over the courses. */
  progress: number;
  last_active: ISODateTime | null;
  enrolled_date: ISODateTime;
  /** The roster lists every enrolment, whatever its state. */
  status: EnrollmentStatus | 'expired' | 'refunded';
}
