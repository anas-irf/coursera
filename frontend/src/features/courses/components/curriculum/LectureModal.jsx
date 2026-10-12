import React, { useState, useEffect } from 'react';
import { Play, HelpCircle, ClipboardList, X, BookOpen } from 'lucide-react';
import { useToast } from '../../../../shared/ui/Toast';
import VideoLectureForm from './forms/VideoLectureForm';
import QuizForm from './forms/QuizForm';
import AssignmentForm from './forms/AssignmentForm';
import ReadingForm from './forms/ReadingForm';

const LectureModal = ({ lecture, onClose, onSave, title }) => {
  const { error } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [assignmentAttachment, setAssignmentAttachment] = useState(null); // Store file separately
  const [readingFile, setReadingFile] = useState(null); // Store reading file separately
  const [formData, setFormData] = useState({
    title: lecture?.title || '',
    description: lecture?.description || '',
    content_type: lecture?.content_type || 'video',
    video_url: lecture?.video_content?.video_url || '',
    video_file: lecture?.video_content?.video_file || null,
    subtitle_file: null, // New subtitle file
    article_content: lecture?.article_content || '',
    markdown_file: lecture?.markdown_file || null,
    pdf_file: lecture?.pdf_file || null,
    questions: lecture?.questions || [],
    quiz_settings: lecture?.quiz_settings || {
      passing_score: 60,
      time_limit: null,
      max_attempts: 3,
      weight: 0,
      randomize_questions: false,
      show_answers: true
    },
    assignment_settings: lecture?.assignment_settings || {
      max_points: 100,
      due_date: '',
      passing_score: 60,
      weight: 0,
      instructions: ''
      // Note: attachment is not set to null by default to avoid overriding uploaded files
    },
    reading_document: lecture?.reading_document || null,
    is_preview: lecture?.is_preview || false,
    is_downloadable: lecture?.is_downloadable || false,
    existing_video_name: lecture?.video_content?.existing_video_name || null,
    existing_subtitle_name: lecture?.existing_subtitle_name || null
  });

  const [activeTab, setActiveTab] = useState(formData.content_type);

  useEffect(() => {
    setFormData(prev => ({ ...prev, content_type: activeTab }));
  }, [activeTab]);

  const validateForm = () => {
    if (!formData.title.trim()) {
      error('Please enter a lecture title', 'Validation Error');
      return false;
    }

    if (activeTab === 'video') {
      if (!formData.video_url && !formData.video_file) {
        error('Please provide a video URL or upload a video file', 'Video Content Required');
        return false;
      }
    }

    if (activeTab === 'reading') {
      if (!formData.article_content && !formData.markdown_file && !formData.pdf_file && !readingFile && !formData.reading_document?.existing_file) {
        error('Please provide reading content: write rich text, upload a markdown file, or upload a PDF file', 'Reading Content Required');
        return false;
      }
    }

    if (activeTab === 'quiz') {
      if (!formData.questions || formData.questions.length === 0) {
        error('Please add at least one quiz question', 'Quiz Content Required');
        return false;
      }

      // Validate weight for graded quizzes
      if (formData.quiz_settings?.weight && formData.quiz_settings.weight > 0) {
        if (formData.quiz_settings.weight < 0.01 || formData.quiz_settings.weight > 40) {
          error('Quiz weight must be between 0.01% and 40%', 'Invalid Weight');
          return false;
        }
      }

      for (let i = 0; i < formData.questions.length; i++) {
        const question = formData.questions[i];
        if (!question.question_text.trim()) {
          error(`Please enter text for question ${i + 1}`, 'Question Incomplete');
          return false;
        }
        if (!question.options.every(opt => opt.option_text.trim())) {
          error(`Please fill all options for question ${i + 1}`, 'Options Incomplete');
          return false;
        }
        if (!question.options.some(opt => opt.is_correct)) {
          error(`Please mark the correct answer for question ${i + 1}`, 'Correct Answer Missing');
          return false;
        }
      }
    }

    if (activeTab === 'assignment') {
      if (!formData.assignment_settings?.instructions?.trim()) {
        error('Please provide assignment instructions', 'Assignment Instructions Required');
        return false;
      }

      // Validate weight for graded assignments
      if (formData.assignment_settings?.weight && formData.assignment_settings.weight > 0) {
        if (formData.assignment_settings.weight < 0.01 || formData.assignment_settings.weight > 40) {
          error('Assignment weight must be between 0.01% and 40%', 'Invalid Weight');
          return false;
        }
      }

      // Validate due date (must be at least 1 hour from now)
      if (formData.assignment_settings?.due_date) {
        const dueDate = new Date(formData.assignment_settings.due_date);
        const minDate = new Date();
        minDate.setHours(minDate.getHours() + 1);

        if (dueDate <= minDate) {
          error('Due date must be at least 1 hour from now', 'Invalid Due Date');
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    try {
      setIsUploading(true);
      // Merge the attachment file and reading file with formData before saving
      const dataToSave = {
        ...formData,
        assignment_settings: {
          ...formData.assignment_settings,
          attachment: assignmentAttachment // Add the file here
        },
        reading_file: readingFile // Add reading file here for backward compatibility
      };

      // For reading lectures, also include specific file types if they exist in formData
      if (formData.content_type === 'reading') {
        if (formData.markdown_file) {
          dataToSave.markdown_file = formData.markdown_file;
        }
        if (formData.pdf_file) {
          dataToSave.pdf_file = formData.pdf_file;
        }
      }
      await onSave(dataToSave);
    } catch (error) {
      console.error('Error saving lecture:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const contentTypes = [
    { id: 'video', label: 'Video Lecture', icon: Play },
    { id: 'reading', label: 'Reading', icon: BookOpen },
    { id: 'quiz', label: 'Quiz', icon: HelpCircle },
    { id: 'assignment', label: 'Assignment', icon: ClipboardList }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex space-x-1 border-b">
            {contentTypes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === id
                    ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lecture Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Introduction to Components"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Brief description of this lecture"
            />
          </div>

          {activeTab === 'video' && (
            <VideoLectureForm
              formData={formData}
              setFormData={setFormData}
              isUploading={isUploading}
              setIsUploading={setIsUploading}
            />
          )}

          {activeTab === 'reading' && (
            <ReadingForm
              formData={formData}
              setFormData={setFormData}
              readingFile={readingFile}
              setReadingFile={setReadingFile}
            />
          )}

          {activeTab === 'quiz' && (
            <QuizForm formData={formData} setFormData={setFormData} />
          )}

          {activeTab === 'assignment' && (
            <AssignmentForm
              formData={formData}
              setFormData={setFormData}
              assignmentAttachment={assignmentAttachment}
              setAssignmentAttachment={setAssignmentAttachment}
            />
          )}

          <div className="space-y-3 pt-4 border-t">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_preview}
                onChange={(e) => setFormData({...formData, is_preview: e.target.checked})}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Allow free preview</span>
            </label>

            {activeTab !== 'quiz' && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_downloadable}
                  onChange={(e) => setFormData({...formData, is_downloadable: e.target.checked})}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Allow download</span>
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg transition-colors ${
                isUploading
                  ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                isUploading
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                `${lecture ? 'Update' : 'Create'} Lecture`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LectureModal;