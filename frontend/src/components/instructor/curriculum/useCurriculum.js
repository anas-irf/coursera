import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useToast } from '../../shared/Toast';
import { useConfirm } from '../../shared/ConfirmDialog';

const useCurriculum = (courseId) => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const { success, error } = useToast();
  const { confirmDelete } = useConfirm();

  const fetchSections = async () => {
    if (!courseId) return;

    try {
      const response = await api.get(`/courses/instructor/courses/${courseId}/sections/`);
      setSections(response.data);
    } catch (error) {
      console.error('Error fetching sections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, [courseId]);

  const createSection = async (sectionData) => {
    try {
      const response = await api.post(`/courses/instructor/courses/${courseId}/sections/`, sectionData);
      fetchSections();
      return response.data;
    } catch (error) {
      console.error('Error creating section:', error);
      error('Error creating section. Please try again.', 'Creation Failed');
    }
  };

  const updateSection = async (sectionId, sectionData) => {
    try {
      const response = await api.put(`/courses/instructor/sections/${sectionId}/`, sectionData);
      fetchSections();
      return response.data;
    } catch (error) {
      console.error('Error updating section:', error);
      error('Error updating section. Please try again.', 'Update Failed');
    }
  };

  const deleteSection = async (sectionId) => {
    const confirmed = await confirmDelete(
      'This action will permanently delete the section and all its lectures.',
      'Delete Section'
    );
    if (!confirmed) return;

    try {
      await api.delete(`/courses/instructor/sections/${sectionId}/`);
      fetchSections();
    } catch (error) {
      console.error('Error deleting section:', error);
      error('Error deleting section. Please try again.', 'Deletion Failed');
    }
  };

  const createLecture = async (sectionId, lectureData) => {
    try {
      // Convert to FormData if there are files
      const formData = new FormData();

      // Add all non-file data
      Object.keys(lectureData).forEach(key => {
        if (key !== 'video_file' && key !== 'subtitle_file' && key !== 'reading_file' && key !== 'markdown_file' && key !== 'pdf_file' && key !== 'questions' && key !== 'quiz_settings' && key !== 'assignment_settings') {
          if (lectureData[key] !== null && lectureData[key] !== undefined) {
            formData.append(key, lectureData[key]);
          }
        }
      });

      // Add file data
      if (lectureData.video_file) {
        formData.append('video_file', lectureData.video_file);
      }
      if (lectureData.subtitle_file) {
        formData.append('subtitle_file', lectureData.subtitle_file);
      }
      if (lectureData.reading_file) {
        formData.append('reading_file', lectureData.reading_file);
      }
      if (lectureData.markdown_file) {
        formData.append('markdown_file', lectureData.markdown_file);
      }
      if (lectureData.pdf_file) {
        formData.append('pdf_file', lectureData.pdf_file);
      }

      // Handle assignment attachment file separately
      if (lectureData.assignment_settings?.attachment && lectureData.assignment_settings.attachment instanceof File) {
        formData.append('attachment', lectureData.assignment_settings.attachment);
      }

      // Add complex objects as JSON strings (excluding attachment file from assignment_settings)
      if (lectureData.questions) {
        formData.append('questions', JSON.stringify(lectureData.questions));
      }
      if (lectureData.quiz_settings) {
        formData.append('quiz_settings', JSON.stringify(lectureData.quiz_settings));
      }
      if (lectureData.assignment_settings) {
        // Create a copy without the attachment file for JSON serialization
        const assignmentSettingsForJson = { ...lectureData.assignment_settings };
        if (assignmentSettingsForJson.attachment instanceof File) {
          delete assignmentSettingsForJson.attachment;
        }
        formData.append('assignment_settings', JSON.stringify(assignmentSettingsForJson));
      }

      const response = await api.post(`/courses/instructor/sections/${sectionId}/lectures/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 900000, // 15 minutes timeout for very large files (up to 2GB)
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        },
      });
      fetchSections();
      return response.data;
    } catch (error) {
      console.error('Error creating lecture:', error);

      // Handle different types of errors
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        error('Upload timeout. The file is too large or your connection is slow. Please try with a smaller file or check your internet connection.', 'Upload Timeout');
      } else if (error.response?.status === 413) {
        error('File too large. Maximum file size is 2GB. Please reduce the file size and try again.', 'File Too Large');
      } else if (error.response?.status === 500) {
        error('Server error while processing your upload. Please try again later.', 'Server Error');
      } else {
        error(`Error creating lecture: ${error.response?.data?.error || error.message || 'Unknown error'}`, 'Creation Failed');
      }

      throw error; // Re-throw so the modal can handle the uploading state
    }
  };

  const updateLecture = async (lectureId, lectureData) => {
    try {
      // Convert to FormData if there are files
      const formData = new FormData();

      // Add all non-file data
      Object.keys(lectureData).forEach(key => {
        if (key !== 'video_file' && key !== 'subtitle_file' && key !== 'reading_file' && key !== 'markdown_file' && key !== 'pdf_file' && key !== 'questions' && key !== 'quiz_settings' && key !== 'assignment_settings') {
          if (lectureData[key] !== null && lectureData[key] !== undefined) {
            formData.append(key, lectureData[key]);
          }
        }
      });

      // Add file data
      if (lectureData.video_file) {
        formData.append('video_file', lectureData.video_file);
      }
      if (lectureData.subtitle_file) {
        formData.append('subtitle_file', lectureData.subtitle_file);
      }
      if (lectureData.reading_file) {
        formData.append('reading_file', lectureData.reading_file);
      }
      if (lectureData.markdown_file) {
        formData.append('markdown_file', lectureData.markdown_file);
      }
      if (lectureData.pdf_file) {
        formData.append('pdf_file', lectureData.pdf_file);
      }

      // Handle assignment attachment file separately
      if (lectureData.assignment_settings?.attachment && lectureData.assignment_settings.attachment instanceof File) {
        formData.append('attachment', lectureData.assignment_settings.attachment);
      }

      // Add complex objects as JSON strings (excluding attachment file from assignment_settings)
      if (lectureData.questions) {
        formData.append('questions', JSON.stringify(lectureData.questions));
      }
      if (lectureData.quiz_settings) {
        formData.append('quiz_settings', JSON.stringify(lectureData.quiz_settings));
      }
      if (lectureData.assignment_settings) {
        // Create a copy without the attachment file for JSON serialization
        const assignmentSettingsForJson = { ...lectureData.assignment_settings };
        if (assignmentSettingsForJson.attachment instanceof File) {
          delete assignmentSettingsForJson.attachment;
        }
        formData.append('assignment_settings', JSON.stringify(assignmentSettingsForJson));
      }

      const response = await api.put(`/courses/instructor/lectures/${lectureId}/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 900000, // 15 minutes timeout for very large files (up to 2GB)
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        },
      });
      fetchSections();
      return response.data;
    } catch (error) {
      console.error('Error updating lecture:', error);

      // Handle different types of errors
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        error('Upload timeout. The file is too large or your connection is slow. Please try with a smaller file or check your internet connection.', 'Upload Timeout');
      } else if (error.response?.status === 413) {
        error('File too large. Maximum file size is 2GB. Please reduce the file size and try again.', 'File Too Large');
      } else if (error.response?.status === 500) {
        error('Server error while processing your upload. Please try again later.', 'Server Error');
      } else {
        error(`Error updating lecture: ${error.response?.data?.error || error.message || 'Unknown error'}`, 'Update Failed');
      }

      throw error; // Re-throw so the modal can handle the uploading state
    }
  };

  const deleteLecture = async (lectureId) => {
    const confirmed = await confirmDelete(
      'This action will permanently delete the lecture.',
      'Delete Lecture'
    );
    if (!confirmed) return;

    try {
      await api.delete(`/courses/instructor/lectures/${lectureId}/`);
      fetchSections();
    } catch (error) {
      console.error('Error deleting lecture:', error);
      error('Error deleting lecture. Please try again.', 'Deletion Failed');
    }
  };

  const reorderSections = async (newSectionOrder) => {
    try {
      const section_orders = newSectionOrder.map((section, index) => ({
        uuid: section.id,
        order: index + 1
      }));

      await api.post(`/courses/instructor/courses/${courseId}/sections/reorder/`, {
        section_orders
      });

      // Update local state immediately for better UX
      setSections(newSectionOrder);
    } catch (error) {
      console.error('Error reordering sections:', error);
      error('Error reordering sections. Changes have been reverted.', 'Reorder Failed');
      // Revert on error
      fetchSections();
    }
  };

  const reorderLectures = async (sectionId, newLectureOrder) => {
    try {
      const lecture_orders = newLectureOrder.map((lecture, index) => ({
        uuid: lecture.id,
        order: index + 1
      }));

      await api.post(`/courses/instructor/sections/${sectionId}/lectures/reorder/`, {
        lecture_orders
      });

      // Update local state immediately for better UX
      setSections(prevSections =>
        prevSections.map(section =>
          section.id === sectionId
            ? { ...section, lectures: newLectureOrder }
            : section
        )
      );
    } catch (error) {
      console.error('Error reordering lectures:', error);
      error('Error reordering lectures. Changes have been reverted.', 'Reorder Failed');
      // Revert on error
      fetchSections();
    }
  };

  const reorderQuizQuestions = async (lectureId, newQuestionOrder) => {
    try {
      const question_orders = newQuestionOrder.map((question, index) => ({
        id: question.id, // Using internal ID for questions
        order: index + 1
      }));

      await api.post(`/assessments/api/quizzes/${lectureId}/reorder-questions/`, {
        question_orders
      });

      return true;
    } catch (error) {
      console.error('Error reordering quiz questions:', error);
      error('Error reordering quiz questions. Please try again.', 'Reorder Failed');
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
    reorderQuizQuestions
  };
};

export default useCurriculum;