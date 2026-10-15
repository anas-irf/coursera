import type { AxiosResponse } from 'axios';

import api from '../../shared/api/client';
import type { UUID } from '../../shared/types';
import type {
  Category,
  CourseBody,
  CourseDetail,
  CreateCourseResponse,
  CurriculumLecture,
  CurriculumSection,
  DeleteCourseResponse,
  InstructorCourseRow,
  Language,
  LecturePayload,
  ReorderItem,
  ReorderResponse,
  SectionPayload,
  SubmitForReviewResponse,
  UnpublishResponse,
  UpdateCourseResponse,
} from './types';

// authoring endpoints, served below /courses/instructor/
const BASE = '/courses/instructor';

// uploads may carry videos of up to 2 GB
const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;

type FileField = 'video_file' | 'subtitle_file' | 'reading_file' | 'markdown_file' | 'pdf_file';

const FILE_FIELDS: FileField[] = ['video_file', 'subtitle_file', 'reading_file', 'markdown_file', 'pdf_file'];
const JSON_FIELDS = ['questions', 'quiz_settings', 'assignment_settings'];

const isFileField = (key: string): key is FileField => FILE_FIELDS.some((field) => field === key);

/**
 * The multipart body the lecture endpoints expect: plain fields as they are,
 * files under their own names, questions / quiz and assignment settings as JSON
 * strings (the attachment file of an assignment is sent as its own part).
 */
export function lectureFormData(lecture: LecturePayload): FormData {
  const formData = new FormData();

  Object.entries(lecture).forEach(([key, value]: [string, unknown]) => {
    if (isFileField(key) || JSON_FIELDS.includes(key)) return;
    // a Blob is a part of its own; anything else is sent as the text FormData makes of it
    if (value !== null && value !== undefined) formData.append(key, value instanceof Blob ? value : String(value));
  });

  FILE_FIELDS.forEach((field) => {
    const file = lecture[field];
    if (file) formData.append(field, file);
  });

  const settings = lecture.assignment_settings;
  if (settings && settings.attachment instanceof File) {
    formData.append('attachment', settings.attachment);
  }

  if (lecture.questions) formData.append('questions', JSON.stringify(lecture.questions));
  if (lecture.quiz_settings) formData.append('quiz_settings', JSON.stringify(lecture.quiz_settings));
  if (settings) {
    const { attachment, ...rest } = settings;
    formData.append('assignment_settings', JSON.stringify(attachment instanceof File ? rest : settings));
  }

  return formData;
}

// --- what the course form offers ----------------------------------------------------
/** Categories a course can be filed under: ``[{id, name, slug}]``. */
export const listCategories = (): Promise<Category[]> =>
  api.get<Category[]>('/courses/categories/').then((response) => response.data);

/** Languages a course can be taught in: ``[{id, code, name}]``. */
export const listLanguages = (): Promise<Language[]> =>
  api.get<Language[]>('/courses/languages/').then((response) => response.data);

// --- courses -------------------------------------------------------------------
export const listCourses = (): Promise<InstructorCourseRow[]> =>
  api.get<InstructorCourseRow[]>(`${BASE}/courses/`).then((response) => response.data);

export const getCourse = (courseId: UUID): Promise<CourseDetail> =>
  api.get<CourseDetail>(`${BASE}/courses/${courseId}/`).then((response) => response.data);

/** ``formData`` carries the thumbnail file. */
export const createCourse = (formData: FormData): Promise<CreateCourseResponse> =>
  api.post<CreateCourseResponse>(`${BASE}/courses/`, formData).then((response) => response.data);

/** ``data`` is a plain object, or FormData when the thumbnail changes. */
export const updateCourse = (courseId: UUID, data: CourseBody): Promise<UpdateCourseResponse> =>
  api.patch<UpdateCourseResponse>(`${BASE}/courses/${courseId}/`, data).then((response) => response.data);

export const applyForPublish = (courseId: UUID): Promise<SubmitForReviewResponse> =>
  api.post<SubmitForReviewResponse>(`${BASE}/courses/${courseId}/apply_for_publish/`).then((response) => response.data);

export const unpublish = (courseId: UUID): Promise<UnpublishResponse> =>
  api.post<UnpublishResponse>(`${BASE}/courses/${courseId}/unpublish/`).then((response) => response.data);

/** ``confirmation`` is "<instructor email>/<course title>". */
export const deleteCourse = (courseId: UUID, confirmation: string): Promise<DeleteCourseResponse> =>
  api
    .post<DeleteCourseResponse>(`${BASE}/courses/${courseId}/delete-course/`, { confirmation })
    .then((response) => response.data);

// --- curriculum ----------------------------------------------------------------
// ``deleteSection``, ``deleteLecture`` and the two reorders answer the whole axios response, not
// its ``data`` (as they always did; no caller reads it).
export const listSections = (courseId: UUID): Promise<CurriculumSection[]> =>
  api.get<CurriculumSection[]>(`${BASE}/courses/${courseId}/sections/`).then((response) => response.data);

export const createSection = (courseId: UUID, data: SectionPayload): Promise<CurriculumSection> =>
  api.post<CurriculumSection>(`${BASE}/courses/${courseId}/sections/`, data).then((response) => response.data);

export const updateSection = (sectionId: UUID, data: SectionPayload): Promise<CurriculumSection> =>
  api.put<CurriculumSection>(`${BASE}/sections/${sectionId}/`, data).then((response) => response.data);

export const deleteSection = (sectionId: UUID): Promise<AxiosResponse<unknown>> =>
  api.delete<unknown>(`${BASE}/sections/${sectionId}/`);

export const createLecture = (sectionId: UUID, lecture: LecturePayload): Promise<CurriculumLecture> =>
  api
    .post<CurriculumLecture>(`${BASE}/sections/${sectionId}/lectures/`, lectureFormData(lecture), {
      timeout: UPLOAD_TIMEOUT_MS,
    })
    .then((response) => response.data);

export const updateLecture = (lectureId: UUID, lecture: LecturePayload): Promise<CurriculumLecture> =>
  api
    .put<CurriculumLecture>(`${BASE}/lectures/${lectureId}/`, lectureFormData(lecture), {
      timeout: UPLOAD_TIMEOUT_MS,
    })
    .then((response) => response.data);

export const deleteLecture = (lectureId: UUID): Promise<AxiosResponse<unknown>> =>
  api.delete<unknown>(`${BASE}/lectures/${lectureId}/`);

export const reorderSections = (courseId: UUID, sectionOrders: ReorderItem[]): Promise<AxiosResponse<ReorderResponse>> =>
  api.post<ReorderResponse>(`${BASE}/courses/${courseId}/sections/reorder/`, { section_orders: sectionOrders });

export const reorderLectures = (sectionId: UUID, lectureOrders: ReorderItem[]): Promise<AxiosResponse<ReorderResponse>> =>
  api.post<ReorderResponse>(`${BASE}/sections/${sectionId}/lectures/reorder/`, { lecture_orders: lectureOrders });
