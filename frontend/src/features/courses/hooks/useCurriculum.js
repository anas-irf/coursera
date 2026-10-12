import { useCallback, useEffect, useState } from 'react';

import { errorMessage } from '../../../shared/api/errors';
import { useConfirm } from '../../../shared/ui/ConfirmDialog';
import { useToast } from '../../../shared/ui/Toast';
import * as coursesApi from '../api';

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
  return [`Error ${verb} lecture: ${errorMessage(err, 'Unknown error')}`, verb === 'creating' ? 'Creation Failed' : 'Update Failed'];
};

/** The sections and lectures of one course and everything an instructor does to them. */
const useCurriculum = (courseId) => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const { confirmDelete } = useConfirm();

  const fetchSections = useCallback(async () => {
    if (!courseId) return;
    try {
      setSections(await coursesApi.listSections(courseId));
    } catch (err) {
      // keep what is shown
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const createSection = async (data) => {
    try {
      const section = await coursesApi.createSection(courseId, data);
      fetchSections();
      return section;
    } catch (err) {
      toast.error('Error creating section. Please try again.', 'Creation Failed');
      return undefined;
    }
  };

  const updateSection = async (sectionId, data) => {
    try {
      const section = await coursesApi.updateSection(sectionId, data);
      fetchSections();
      return section;
    } catch (err) {
      toast.error('Error updating section. Please try again.', 'Update Failed');
      return undefined;
    }
  };

  const deleteSection = async (sectionId) => {
    const confirmed = await confirmDelete(
      'This action will permanently delete the section and all its lectures.',
      'Delete Section'
    );
    if (!confirmed) return;

    try {
      await coursesApi.deleteSection(sectionId);
      fetchSections();
    } catch (err) {
      toast.error('Error deleting section. Please try again.', 'Deletion Failed');
    }
  };

  // Failures are re-thrown so the lecture dialog can leave its "uploading" state.
  const createLecture = async (sectionId, lecture) => {
    try {
      const created = await coursesApi.createLecture(sectionId, lecture);
      fetchSections();
      return created;
    } catch (err) {
      const [message, title] = uploadProblem(err, 'creating');
      toast.error(message, title);
      throw err;
    }
  };

  const updateLecture = async (lectureId, lecture) => {
    try {
      const updated = await coursesApi.updateLecture(lectureId, lecture);
      fetchSections();
      return updated;
    } catch (err) {
      const [message, title] = uploadProblem(err, 'updating');
      toast.error(message, title);
      throw err;
    }
  };

  const deleteLecture = async (lectureId) => {
    const confirmed = await confirmDelete('This action will permanently delete the lecture.', 'Delete Lecture');
    if (!confirmed) return;

    try {
      await coursesApi.deleteLecture(lectureId);
      fetchSections();
    } catch (err) {
      toast.error('Error deleting lecture. Please try again.', 'Deletion Failed');
    }
  };

  const reorderSections = async (newOrder) => {
    try {
      await coursesApi.reorderSections(
        courseId,
        newOrder.map((section, index) => ({ uuid: section.id, order: index + 1 }))
      );
      setSections(newOrder);
    } catch (err) {
      toast.error('Error reordering sections. Changes have been reverted.', 'Reorder Failed');
      fetchSections();
    }
  };

  const reorderLectures = async (sectionId, newOrder) => {
    try {
      await coursesApi.reorderLectures(
        sectionId,
        newOrder.map((lecture, index) => ({ uuid: lecture.id, order: index + 1 }))
      );
      setSections((prev) =>
        prev.map((section) => (section.id === sectionId ? { ...section, lectures: newOrder } : section))
      );
    } catch (err) {
      toast.error('Error reordering lectures. Changes have been reverted.', 'Reorder Failed');
      fetchSections();
    }
  };

  const reorderQuizQuestions = async (lectureId, newOrder) => {
    try {
      await coursesApi.reorderQuizQuestions(
        lectureId,
        newOrder.map((question, index) => ({ id: question.id, order: index + 1 }))
      );
      return true;
    } catch (err) {
      toast.error('Error reordering quiz questions. Please try again.', 'Reorder Failed');
      return false;
    }
  };

  return {
    sections,
    loading,
    createSection,
    updateSection,
    deleteSection,
    createLecture,
    updateLecture,
    deleteLecture,
    reorderSections,
    reorderLectures,
    reorderQuizQuestions,
  };
};

export default useCurriculum;
