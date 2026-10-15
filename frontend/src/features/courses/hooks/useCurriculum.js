import { useQuery, useQueryClient } from '@tanstack/react-query';

import { errorMessage } from '../../../shared/api/errors';
import { useConfirm } from '../../../shared/ui/ConfirmDialog';
import { useToast } from '../../../shared/ui/Toast';
import * as coursesApi from '../api';
import { courseKeys } from './useCourses';

const uploadProblem = (err, verb) => {
  if (err.code === 'ECONNABORTED' || (err.message || '').includes('timeout')) {
    return [
      'Upload timeout. The file is too large or your connection is slow. Please try with a smaller file or check your internet connection.',
      'Upload Timeout',
    ];
  }
  if (err.response && err.response.status === 413) {
    return ['File too large. Maximum file size is 2GB. Please reduce the file size and try again.', 'File Too Large'];
  }
  if (err.response && err.response.status === 500) {
    return ['Server error while processing your upload. Please try again later.', 'Server Error'];
  }
  return [
    `Error ${verb} lecture: ${errorMessage(err, 'Unknown error')}`,
    verb === 'creating' ? 'Creation Failed' : 'Update Failed',
  ];
};

/**
 * The sections and lectures of one course and everything an instructor does to them.
 *
 * Every change that fails is reported with the server's reason and then thrown again, so the
 * dialog that asked for it stays open with what was typed; the list is refreshed after every
 * change that worked.
 */
const useCurriculum = (courseId) => {
  const client = useQueryClient();
  const toast = useToast();
  const { confirmDelete } = useConfirm();
  const key = courseKeys.sections(courseId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => coursesApi.listSections(courseId),
    enabled: Boolean(courseId),
  });
  const sections = query.data || [];

  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: key }),
    client.invalidateQueries({ queryKey: courseKeys.detail(courseId) }),
  ]);

  // run a change: refresh afterwards, report and re-throw a failure
  const change = async (call, failure, title) => {
    try {
      const result = await call();
      await refresh();
      return result;
    } catch (err) {
      toast.error(errorMessage(err, failure), title);
      throw err;
    }
  };

  const createSection = (data) =>
    change(() => coursesApi.createSection(courseId, data), 'Error creating section. Please try again.', 'Creation Failed');

  const updateSection = (sectionId, data) =>
    change(() => coursesApi.updateSection(sectionId, data), 'Error updating section. Please try again.', 'Update Failed');

  const deleteSection = async (sectionId) => {
    const confirmed = await confirmDelete(
      'This action will permanently delete the section and all its lectures.',
      'Delete Section'
    );
    if (!confirmed) return;

    try {
      await change(() => coursesApi.deleteSection(sectionId), 'Error deleting section. Please try again.', 'Deletion Failed');
    } catch (err) {
      // reported above
    }
  };

  // lecture failures read like upload problems (timeouts, size limits)
  const lectureChange = async (call, verb) => {
    try {
      const result = await call();
      await refresh();
      return result;
    } catch (err) {
      const [message, title] = uploadProblem(err, verb);
      toast.error(message, title);
      throw err;
    }
  };

  const createLecture = (sectionId, lecture) =>
    lectureChange(() => coursesApi.createLecture(sectionId, lecture), 'creating');

  const updateLecture = (lectureId, lecture) =>
    lectureChange(() => coursesApi.updateLecture(lectureId, lecture), 'updating');

  const deleteLecture = async (lectureId) => {
    const confirmed = await confirmDelete('This action will permanently delete the lecture.', 'Delete Lecture');
    if (!confirmed) return;

    try {
      await change(() => coursesApi.deleteLecture(lectureId), 'Error deleting lecture. Please try again.', 'Deletion Failed');
    } catch (err) {
      // reported above
    }
  };

  // reordering shows the new order at once and is put back when the server refuses it
  const reorder = async (apply, call, failure) => {
    client.setQueryData(key, apply);
    try {
      await call();
    } catch (err) {
      toast.error(errorMessage(err, failure), 'Reorder Failed');
      await refresh();
    }
  };

  const reorderSections = (newOrder) =>
    reorder(
      () => newOrder,
      () => coursesApi.reorderSections(
        courseId,
        newOrder.map((section, index) => ({ uuid: section.id, order: index + 1 }))
      ),
      'Error reordering sections. Changes have been reverted.'
    );

  const reorderLectures = (sectionId, newOrder) =>
    reorder(
      (previous = []) =>
        previous.map((section) => (section.id === sectionId ? { ...section, lectures: newOrder } : section)),
      () => coursesApi.reorderLectures(
        sectionId,
        newOrder.map((lecture, index) => ({ uuid: lecture.id, order: index + 1 }))
      ),
      'Error reordering lectures. Changes have been reverted.'
    );

  return {
    sections,
    loading: query.isPending && Boolean(courseId),
    error: query.error,
    refetch: query.refetch,
    createSection,
    updateSection,
    deleteSection,
    createLecture,
    updateLecture,
    deleteLecture,
    reorderSections,
    reorderLectures,
  };
};

export default useCurriculum;
