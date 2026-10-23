import api from '../../shared/api/client';
import type { UUID } from '../../shared/types';
import type {
  BookmarkResponse,
  CatalogCategory,
  CatalogCourse,
  CatalogFilters,
  CatalogPage,
  CatalogRequest,
  CompleteLectureResponse,
  EnrolledCourse,
  EnrolledView,
  EnrollResponse,
  InstructorStudent,
  PlayerPayload,
  WatchProgress,
  WatchReport,
} from './types';

const withoutBlanks = (filters: Partial<CatalogFilters>): Record<string, string> => {
  const params: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all') params[key] = value;
  });
  return params;
};

/**
 * One page of the published courses and how many match in all (``X-Total-Count``).
 * ``filters`` may hold category, level, type, search and sort ("all"/empty are skipped).
 */
export const listCoursesPage = ({ filters = {}, page = 1, pageSize = 12 }: CatalogRequest = {}): Promise<CatalogPage> =>
  api
    .get<CatalogCourse[]>('/learning/courses/', { params: { ...withoutBlanks(filters), page, page_size: pageSize } })
    .then((response) => ({
      items: response.data,
      total: Number(response.headers['x-total-count'] || response.data.length),
    }));

/** The categories the catalogue can be narrowed to (the same list the course form offers). */
export const listCategories = (): Promise<CatalogCategory[]> =>
  api.get<CatalogCategory[]>('/courses/categories/').then((response) => response.data);

/** The student's courses: ``status`` is "active" (running, the default), "completed" or "all". */
export const myCourses = ({ status = 'active' }: { status?: EnrolledView } = {}): Promise<EnrolledCourse[]> =>
  api.get<EnrolledCourse[]>('/learning/enrolled/', { params: { status } }).then((response) => response.data);

export const enroll = (courseId: UUID): Promise<EnrollResponse> =>
  api.post<EnrollResponse>(`/learning/courses/${courseId}/enroll/`).then((response) => response.data);

/** Toggles the bookmark; resolves with the server message. */
export const toggleBookmark = (courseId: UUID): Promise<BookmarkResponse> =>
  api.post<BookmarkResponse>(`/learning/courses/${courseId}/bookmark/`).then((response) => response.data);

/** The player payload: course, enrollment, sections with lectures and progress. */
export const fetchPlayer = (courseId: UUID): Promise<PlayerPayload> =>
  api.get<PlayerPayload>(`/learning/courses/${courseId}/learn/`).then((response) => response.data);

export const completeLecture = (courseId: UUID, lectureId: UUID): Promise<CompleteLectureResponse> =>
  api
    .post<CompleteLectureResponse>(`/learning/courses/${courseId}/lectures/${lectureId}/complete/`)
    .then((response) => response.data);

/** Where the student is in a video (seconds); also credits the time spent watching. */
export const recordWatchProgress = (
  courseId: UUID,
  lectureId: UUID,
  { position, finished = false }: WatchReport
): Promise<WatchProgress> =>
  api
    .post<WatchProgress>(`/learning/courses/${courseId}/lectures/${lectureId}/progress/`, { position, finished })
    .then((response) => response.data);

// --- instructor: the learners of the instructor's courses -------------------
export const instructorStudents = (): Promise<InstructorStudent[]> =>
  api.get<InstructorStudent[]>('/learning/instructor/students/').then((response) => response.data);
