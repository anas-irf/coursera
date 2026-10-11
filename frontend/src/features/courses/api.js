import api from '../../shared/api/client';

// authoring endpoints, served below /courses/instructor/
const BASE = '/courses/instructor';

// uploads may carry videos of up to 2 GB
const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;

const FILE_FIELDS = ['video_file', 'subtitle_file', 'reading_file', 'markdown_file', 'pdf_file'];
const JSON_FIELDS = ['questions', 'quiz_settings', 'assignment_settings'];

/**
 * The multipart body the lecture endpoints expect: plain fields as they are,
 * files under their own names, questions / quiz and assignment settings as JSON
 * strings (the attachment file of an assignment is sent as its own part).
 */
export function lectureFormData(lecture) {
  const formData = new FormData();

  Object.entries(lecture).forEach(([key, value]) => {
    if (FILE_FIELDS.includes(key) || JSON_FIELDS.includes(key)) return;
    if (value !== null && value !== undefined) formData.append(key, value);
  });

  FILE_FIELDS.forEach((field) => {
    if (lecture[field]) formData.append(field, lecture[field]);
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

// --- courses -------------------------------------------------------------------
export const listCourses = () => api.get(`${BASE}/courses/`).then((response) => response.data);

export const getCourse = (courseId) =>
  api.get(`${BASE}/courses/${courseId}/`).then((response) => response.data);

/** ``formData`` carries the thumbnail file. */
export const createCourse = (formData) =>
  api.post(`${BASE}/courses/`, formData).then((response) => response.data);

/** ``data`` is a plain object, or FormData when the thumbnail changes. */
export const updateCourse = (courseId, data) =>
  api.patch(`${BASE}/courses/${courseId}/`, data).then((response) => response.data);

export const applyForPublish = (courseId) =>
  api.post(`${BASE}/courses/${courseId}/apply_for_publish/`).then((response) => response.data);

export const unpublish = (courseId) =>
  api.post(`${BASE}/courses/${courseId}/unpublish/`).then((response) => response.data);

/** ``confirmation`` is "<instructor email>/<course title>". */
export const deleteCourse = (courseId, confirmation) =>
  api.post(`${BASE}/courses/${courseId}/delete-course/`, { confirmation }).then((response) => response.data);

// --- curriculum ----------------------------------------------------------------
export const listSections = (courseId) =>
  api.get(`${BASE}/courses/${courseId}/sections/`).then((response) => response.data);

export const createSection = (courseId, data) =>
  api.post(`${BASE}/courses/${courseId}/sections/`, data).then((response) => response.data);

export const updateSection = (sectionId, data) =>
  api.put(`${BASE}/sections/${sectionId}/`, data).then((response) => response.data);

export const deleteSection = (sectionId) => api.delete(`${BASE}/sections/${sectionId}/`);

export const createLecture = (sectionId, lecture) =>
  api
    .post(`${BASE}/sections/${sectionId}/lectures/`, lectureFormData(lecture), { timeout: UPLOAD_TIMEOUT_MS })
    .then((response) => response.data);

export const updateLecture = (lectureId, lecture) =>
  api
    .put(`${BASE}/lectures/${lectureId}/`, lectureFormData(lecture), { timeout: UPLOAD_TIMEOUT_MS })
    .then((response) => response.data);

export const deleteLecture = (lectureId) => api.delete(`${BASE}/lectures/${lectureId}/`);

export const reorderSections = (courseId, sectionOrders) =>
  api.post(`${BASE}/courses/${courseId}/sections/reorder/`, { section_orders: sectionOrders });

export const reorderLectures = (sectionId, lectureOrders) =>
  api.post(`${BASE}/sections/${sectionId}/lectures/reorder/`, { lecture_orders: lectureOrders });

// the quiz routes sit below an extra "api/" segment on the server
export const reorderQuizQuestions = (lectureId, questionOrders) =>
  api.post(`/assessments/api/quizzes/${lectureId}/reorder-questions/`, { question_orders: questionOrders });
