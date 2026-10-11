import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  BookOpen,
  FileText,
  Award,
  CheckCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  Menu,
  X,
  RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../shared/ui/Toast';
import { useConfirm } from '../../shared/ui/ConfirmDialog';

// Helper function to extract YouTube video ID
const getYouTubeVideoId = (url) => {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
};

// Assignment Submission Form Component
const AssignmentSubmissionForm = ({ assignment, onSubmissionSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFile, setSubmissionFile] = useState(null);
  const { success, error, warning } = useToast();

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        warning('File size cannot exceed 50MB', 'File Too Large');
        return;
      }

      // Check file type
      const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.zip'];
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

      if (!allowedTypes.includes(fileExtension)) {
        warning(`File type ${fileExtension} not allowed. Allowed types: ${allowedTypes.join(', ')}`, 'Invalid File Type');
        return;
      }

      setSubmissionFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!submissionText.trim() && !submissionFile) {
      warning('Please provide either text submission or upload a file', 'Missing Submission');
      return;
    }

    console.log('Submitting assignment:', assignment); // Debug log

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('submission_text', submissionText);
      if (submissionFile) {
        formData.append('submission_file', submissionFile);
      }

      console.log('Submitting to:', `/courses/assignments/${assignment.assignment_id}/submit/`); // Debug log

      await api.post(`/courses/assignments/${assignment.assignment_id}/submit/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      success('Assignment submitted successfully!', 'Submission Complete');
      if (onSubmissionSuccess) {
        onSubmissionSuccess();
      }
    } catch (err) {
      console.error('Assignment submission error:', err);
      console.error('Error response:', err.response); // More detailed error logging
      error(err.response?.data?.error || 'Failed to submit assignment. Please try again.', 'Submission Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isLate = assignment.due_date && new Date() > new Date(assignment.due_date);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Text Submission */}
      <div>
        <label htmlFor="submissionText" className="block text-sm font-medium text-gray-700 mb-2">
          Text Submission (Optional)
        </label>
        <textarea
          id="submissionText"
          value={submissionText}
          onChange={(e) => setSubmissionText(e.target.value)}
          rows={6}
          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Enter your submission text here..."
        />
      </div>

      {/* File Upload */}
      <div>
        <label htmlFor="submissionFile" className="block text-sm font-medium text-gray-700 mb-2">
          File Upload (Optional)
        </label>
        <div className="flex items-center justify-center w-full">
          <label
            htmlFor="submissionFile"
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-8 h-8 mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mb-2 text-sm text-gray-500">
                {submissionFile ? submissionFile.name : 'Click to upload file'}
              </p>
              <p className="text-xs text-gray-500">PDF, DOC, DOCX, TXT, JPG, PNG, ZIP (Max 50MB)</p>
            </div>
            <input
              id="submissionFile"
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.zip"
            />
          </label>
        </div>
      </div>

      {/* Late Submission Warning */}
      {isLate && assignment.allow_late_submission && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ This assignment is past the due date. Late submissions may be penalized.
          </p>
        </div>
      )}

      {/* Submit Button */}
      <div className="text-center">
        <button
          type="submit"
          disabled={submitting || (isLate && !assignment.allow_late_submission)}
          className={`px-6 py-3 rounded-lg font-medium ${
            submitting || (isLate && !assignment.allow_late_submission)
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {submitting ? 'Submitting...' : 'Submit Assignment'}
        </button>
        {isLate && !assignment.allow_late_submission && (
          <p className="mt-2 text-sm text-red-600">Late submissions not allowed for this assignment</p>
        )}
      </div>
    </form>
  );
};

const CourseLearning = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { success, error, warning } = useToast();
  const { confirm } = useConfirm();
  const [courseData, setCourseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  // Quiz-related state
  const [quizMode, setQuizMode] = useState(null); // null, 'taking', 'results'
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResults, setQuizResults] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);

  useEffect(() => {
    fetchCourseData();
  }, [courseId]);

  const fetchCourseData = async () => {
    try {
      const response = await api.get(`/courses/${courseId}/learn/`);
      setCourseData(response.data);

      // Auto-expand all sections initially
      const expanded = {};
      response.data.sections.forEach(section => {
        expanded[section.id] = true;
      });
      setExpandedSections(expanded);

      // Try to restore previously selected lecture from localStorage
      const savedLectureId = localStorage.getItem(`selectedLecture_${courseId}`);
      let lectureToSelect = null;

      if (savedLectureId) {
        // Find the saved lecture in the course data
        for (const section of response.data.sections) {
          const savedLecture = section.lectures.find(l => l.id === savedLectureId);
          if (savedLecture) {
            lectureToSelect = savedLecture;
            break;
          }
        }
      }

      // If no saved lecture found, select first incomplete lecture or first lecture
      if (!lectureToSelect) {
        lectureToSelect = findFirstIncompleteLecture(response.data.sections);
      }

      if (lectureToSelect) {
        setSelectedLecture(lectureToSelect);
        // Save to localStorage if it's a new selection (not restored from localStorage)
        if (!savedLectureId) {
          localStorage.setItem(`selectedLecture_${courseId}`, lectureToSelect.id);
        }
      }
    } catch (error) {
      console.error('Error fetching course data:', error);
      if (error.response?.status === 403) {
        error('You must be enrolled in this course to access learning materials', 'Access Denied');
        navigate('/student/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const findFirstIncompleteLecture = (sections) => {
    for (const section of sections) {
      for (const lecture of section.lectures) {
        if (!lecture.is_completed) {
          return lecture;
        }
      }
    }
    // If all completed, return first lecture
    if (sections.length > 0 && sections[0].lectures.length > 0) {
      return sections[0].lectures[0];
    }
    return null;
  };

  const refreshCourseDataOnly = async () => {
    try {
      const response = await api.get(`/courses/${courseId}/learn/`);
      setCourseData(response.data);
      console.log('Course data refreshed:', response.data);

      // Update the selected lecture with fresh data but don't change selection
      if (selectedLecture) {
        for (const section of response.data.sections) {
          const updatedLecture = section.lectures.find(l => l.id === selectedLecture.id);
          if (updatedLecture) {
            setSelectedLecture(updatedLecture);
            console.log('Updated selected lecture:', updatedLecture);
            // Check if this is an assignment and log submission data
            if (updatedLecture.content_type === 'assignment' && updatedLecture.submission) {
              console.log('Assignment submission data:', updatedLecture.submission);
            }
            // Ensure localStorage is updated
            localStorage.setItem(`selectedLecture_${courseId}`, updatedLecture.id);
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing course data:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCourseDataOnly();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleLectureSelect = async (lecture) => {
    // Check if user is in the middle of taking a quiz
    if (quizMode === 'taking') {
      const confirmSwitch = await confirm({
        type: 'warning',
        title: 'Quiz in Progress',
        message: 'You are currently taking a quiz. Switching lectures will end your current quiz attempt. Are you sure you want to continue?',
        confirmText: 'Switch Lecture',
        cancelText: 'Stay on Quiz'
      });
      if (!confirmSwitch) {
        return; // Don't switch lectures
      }
    }

    // Close mobile sidebar when lecture is selected
    setIsSidebarOpen(false);

    // Reset quiz state when switching lectures
    if (quizMode !== null) {
      setQuizMode(null);
      setCurrentQuiz(null);
      setQuizAnswers({});
      setQuizResults(null);
      setQuizLoading(false);
    }

    setSelectedLecture(lecture);
    // Save selected lecture to localStorage
    localStorage.setItem(`selectedLecture_${courseId}`, lecture.id);
    // Update last accessed time
    updateLastAccessed();
  };

  const updateLastAccessed = async () => {
    try {
      // This would be an API call to update last accessed time
      // await api.patch(`/courses/${courseId}/last-accessed/`);
    } catch (error) {
      console.error('Error updating last accessed:', error);
    }
  };

  const markLectureComplete = async (lectureId) => {
    try {
      await api.post(`/courses/${courseId}/lectures/${lectureId}/complete/`);
      // Refresh course data to update progress
      fetchCourseData();
    } catch (error) {
      console.error('Error marking lecture complete:', error);
      error('Failed to mark lecture as complete. Please try again.', 'Update Failed');
    }
  };

  // Quiz Functions
  const startQuiz = async (quizId) => {
    setQuizLoading(true);
    try {
      const response = await api.post(`/courses/quizzes/${quizId}/attempt/`, {
        action: 'start'
      });

      setCurrentQuiz(response.data);
      setQuizAnswers({});
      setQuizMode('taking');
      setQuizResults(null);
    } catch (error) {
      console.error('Error starting quiz:', error);
      error('Failed to start quiz. Please try again.', 'Quiz Error');
    } finally {
      setQuizLoading(false);
    }
  };

  const submitQuiz = async () => {
    if (!currentQuiz) return;

    setQuizLoading(true);
    try {
      const response = await api.post(`/courses/quizzes/${currentQuiz.quiz.id}/attempt/`, {
        action: 'submit',
        attempt_id: currentQuiz.attempt_id,
        answers: quizAnswers
      });

      setQuizResults(response.data.results);
      setQuizMode('results');

      // Refresh course data to update progress without changing lecture selection
      await refreshCourseDataOnly();
    } catch (error) {
      console.error('Error submitting quiz:', error);
      error('Failed to submit quiz. Please try again.', 'Quiz Submission Failed');
    } finally {
      setQuizLoading(false);
    }
  };

  const handleQuizAnswer = (questionId, answer) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const exitQuiz = () => {
    setQuizMode(null);
    setCurrentQuiz(null);
    setQuizAnswers({});
    setQuizResults(null);
  };

  const getLectureIcon = (contentType) => {
    switch (contentType) {
      case 'video':
        return <PlayCircle size={16} className="text-blue-500" />;
      case 'reading':
        return <BookOpen size={16} className="text-green-500" />;
      case 'quiz':
        return <FileText size={16} className="text-orange-500" />;
      case 'assignment':
        return <Award size={16} className="text-purple-500" />;
      default:
        return <FileText size={16} className="text-gray-500" />;
    }
  };

  const renderLectureContent = () => {
    if (!selectedLecture) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No lecture selected</h3>
            <p className="text-gray-500">Select a lecture from the sidebar to start learning</p>
          </div>
        </div>
      );
    }

    const lecture = selectedLecture;

    return (
      <div className="h-full flex flex-col">
        {/* Lecture Header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getLectureIcon(lecture.content_type)}
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{lecture.title}</h1>
                <p className="text-sm text-gray-500 capitalize">{lecture.content_type} Lecture</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!lecture.is_completed && lecture.content_type === 'video' && (
                <button
                  onClick={() => markLectureComplete(lecture.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Mark Complete
                </button>
              )}
              {!lecture.is_completed && lecture.content_type === 'reading' && (
                <button
                  onClick={() => markLectureComplete(lecture.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Mark Complete
                </button>
              )}
              {lecture.is_completed && (
                <span className="flex items-center text-green-600">
                  <CheckCircle size={16} className="mr-1" />
                  Completed
                </span>
              )}
            </div>
          </div>
          {lecture.description && (
            <p className="mt-2 text-gray-600">{lecture.description}</p>
          )}
        </div>

        {/* Lecture Content */}
        <div className="flex-1 overflow-auto">
          {lecture.content_type === 'video' && (
            <div className="p-4 sm:p-6">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                {lecture.video_type === 'youtube' && lecture.video_url ? (
                  // YouTube Video
                  <iframe
                    key={lecture.id}
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(lecture.video_url)}?enablejsapi=1&rel=0&modestbranding=1`}
                    title={lecture.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : lecture.video_file_url ? (
                  // Local Video (with or without subtitles)
                  <video
                    key={lecture.id} // Force re-mount when switching videos
                    controls
                    crossOrigin="anonymous"
                    className="w-full h-full"
                    poster={lecture.thumbnail}
                    preload="metadata"
                    onTimeUpdate={(e) => {
                      // Save progress
                      const currentTime = Math.floor(e.target.currentTime);
                      // You could save this to backend periodically
                    }}
                    onLoadedMetadata={(e) => {
                      // Enable text tracks after video loads
                      const video = e.target;
                      if (video.textTracks && video.textTracks.length > 0) {
                        video.textTracks[0].mode = 'showing';
                      }
                    }}
                  >
                    <source src={lecture.video_file_url} type="video/mp4" />

                    {/* Add subtitles if available */}
                    {lecture.subtitles && lecture.subtitles.length > 0 && lecture.subtitles.map((subtitle, index) => (
                      <track
                        key={subtitle.language}
                        kind="captions"
                        src={subtitle.url}
                        srcLang={subtitle.language}
                        label={subtitle.language_name}
                        {...(index === 0 ? { default: true } : {})}
                      />
                    ))}

                    Your browser does not support the video tag.
                  </video>
                ) : (
                  // No video available
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <PlayCircle className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                      <p className="text-gray-500">Video content not available</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center space-x-4">
                  {lecture.duration > 0 && (
                    <span>Duration: {Math.floor(lecture.duration / 60)}:{(lecture.duration % 60).toString().padStart(2, '0')}</span>
                  )}
                  <span className="capitalize">
                    {lecture.video_type === 'youtube' ? 'YouTube Video' : 'Local Video'}
                  </span>
                  {lecture.subtitles && lecture.subtitles.length > 0 && (
                    <span className="text-blue-600">
                      Subtitles: {lecture.subtitles.map(s => s.language_name).join(', ')}
                    </span>
                  )}
                </div>
                <span>Watched {lecture.watch_count} time{lecture.watch_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}

          {lecture.content_type === 'reading' && (
            <div className="p-4 sm:p-6">
              <div className="prose max-w-none">
                <div className="mb-4 text-sm text-gray-500">
                  Estimated reading time: {lecture.estimated_reading_time} minutes
                </div>
                <div
                  key={lecture.id} // Force re-render when switching reading content
                  className="text-gray-800 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: lecture.content || '<p>Reading content not available</p>' }}
                />
              </div>
            </div>
          )}

          {lecture.content_type === 'quiz' && (
            <div className="p-4 sm:p-6">
              {/* Quiz Overview */}
              {quizMode === null && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="font-medium text-blue-900 mb-2">Quiz Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-blue-700">Attempts:</span> {lecture.attempts_taken}/{lecture.max_attempts}
                      </div>
                      <div>
                        <span className="text-blue-700">Passing Score:</span> {lecture.passing_score}%
                      </div>
                      <div>
                        <span className="text-blue-700">Best Score:</span> {lecture.best_score}%
                      </div>
                      <div>
                        <span className="text-blue-700">Status:</span>
                        <span className={`ml-1 ${lecture.passed ? 'text-green-600' : 'text-red-600'}`}>
                          {lecture.passed ? 'Passed' : 'Not Passed'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <button
                      onClick={() => startQuiz(lecture.quiz_id)}
                      disabled={!lecture.can_attempt || quizLoading}
                      className={`px-6 py-3 rounded-lg font-medium ${
                        lecture.can_attempt && !quizLoading
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {quizLoading ? 'Loading...' : lecture.attempts_taken === 0 ? 'Start Quiz' : 'Retake Quiz'}
                    </button>
                    {!lecture.can_attempt && lecture.attempts_taken >= lecture.max_attempts && (
                      <p className="mt-2 text-sm text-red-600">Maximum attempts reached</p>
                    )}
                  </div>
                </>
              )}

              {/* Quiz Taking Interface */}
              {quizMode === 'taking' && currentQuiz && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-blue-900">{currentQuiz.quiz.title}</h3>
                        <p className="text-sm text-blue-700 mt-1">{currentQuiz.quiz.description}</p>
                      </div>
                      <div className="text-right text-sm text-blue-700">
                        <div>Passing Score: {currentQuiz.quiz.passing_score}%</div>
                        {currentQuiz.quiz.time_limit && (
                          <div>Time Limit: {currentQuiz.quiz.time_limit} minutes</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {currentQuiz.questions.map((question, index) => (
                      <div key={question.id} className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-start space-x-3 mb-4">
                          <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <h4 className="text-lg font-medium text-gray-900 mb-2">{question.text}</h4>
                            <div className="text-sm text-gray-500 mb-4">
                              {question.points} point{question.points !== 1 ? 's' : ''} • {question.type.replace('_', ' ').toUpperCase()}
                            </div>

                            {/* Multiple Choice / True False */}
                            {(question.type === 'multiple_choice' || question.type === 'true_false') && (
                              <div className="space-y-2">
                                {question.options.map((option) => (
                                  <label key={option.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`question-${question.id}`}
                                      value={option.id}
                                      onChange={(e) => handleQuizAnswer(question.id, { selected_option: e.target.value })}
                                      className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-gray-900">{option.text}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {/* Multiple Select */}
                            {question.type === 'multiple_select' && (
                              <div className="space-y-2">
                                {question.options.map((option) => (
                                  <label key={option.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      value={option.id}
                                      onChange={(e) => {
                                        const currentAnswers = quizAnswers[question.id]?.selected_options || [];
                                        const newAnswers = e.target.checked
                                          ? [...currentAnswers, option.id]
                                          : currentAnswers.filter(id => id !== option.id);
                                        handleQuizAnswer(question.id, { selected_options: newAnswers });
                                      }}
                                      className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-gray-900">{option.text}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {/* Fill in the Blank */}
                            {question.type === 'fill_blank' && (
                              <input
                                type="text"
                                placeholder="Enter your answer..."
                                onChange={(e) => handleQuizAnswer(question.id, { text_answer: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mt-8 p-6 bg-gray-50 rounded-lg">
                    <button
                      onClick={exitQuiz}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                    >
                      Exit Quiz
                    </button>
                    <button
                      onClick={submitQuiz}
                      disabled={quizLoading}
                      className={`px-6 py-3 rounded-lg font-medium ${
                        quizLoading
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {quizLoading ? 'Submitting...' : 'Submit Quiz'}
                    </button>
                  </div>
                </div>
              )}

              {/* Quiz Results */}
              {quizMode === 'results' && quizResults && (
                <div className="max-w-2xl mx-auto">
                  <div className={`border-2 rounded-lg p-6 mb-6 ${
                    quizResults.passed
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="text-center">
                      <div className={`text-6xl font-bold mb-2 ${
                        quizResults.passed ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {Math.round(quizResults.score)}%
                      </div>
                      <h3 className={`text-xl font-semibold mb-2 ${
                        quizResults.passed ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {quizResults.passed ? 'Quiz Passed!' : quizResults.current_attempt_passed ? 'Great! But You Already Passed Before' : 'Quiz Not Passed'}
                      </h3>

                      {/* Show best score if different from current */}
                      {quizResults.best_score !== quizResults.score && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="text-sm text-blue-700">
                            <span className="font-medium">Your Best Score:</span> {Math.round(quizResults.best_score)}%
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                        <div>
                          <span className="font-medium">This Attempt:</span> {quizResults.earned_points}/{quizResults.total_points} points
                        </div>
                        <div>
                          <span className="font-medium">Passing Score:</span> {quizResults.passing_score}%
                        </div>
                        <div>
                          <span className="font-medium">Attempt:</span> {quizResults.attempt_number}/{quizResults.attempt_number + quizResults.attempts_remaining}
                        </div>
                        <div>
                          <span className="font-medium">Status:</span>
                          <span className={`ml-1 font-semibold ${quizResults.passed ? 'text-green-600' : 'text-red-600'}`}>
                            {quizResults.passed ? 'PASSED' : 'NOT PASSED'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <button
                      onClick={exitQuiz}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Continue Learning
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {lecture.content_type === 'assignment' && (
            <div className="p-4 sm:p-6">
              {/* Debug: Log assignment data */}
              {console.log('Assignment lecture data:', lecture)}
              
              {/* Assignment Header */}
              {lecture.title && (
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{lecture.title}</h2>
                  {lecture.description && (
                    <p className="text-gray-700 mb-4">{lecture.description}</p>
                  )}
                </div>
              )}

              {/* Assignment Instructions */}
              {lecture.instructions && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-blue-900 mb-2">Instructions</h3>
                  <div className="text-blue-800 whitespace-pre-wrap">{lecture.instructions}</div>
                </div>
              )}

              {/* Assignment Attachment */}
              {lecture.attachment && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-gray-900 mb-2">Assignment Materials</h3>
                  {/* Debug: Log attachment info */}
                  {console.log('Attachment URL:', lecture.attachment, 'Name:', lecture.attachment_name)}
                  
                  <div className="flex items-center space-x-3">
                    <FileText className="text-red-500" size={20} />
                    <div className="flex-1">
                      <a 
                        href={lecture.attachment}
                        download={lecture.attachment_name || 'assignment-file'}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            console.log('Attempting to download:', lecture.attachment);
                            
                            // Try to fetch the file first to check if it exists
                            const response = await fetch(lecture.attachment);
                            if (!response.ok) {
                              throw new Error(`File not found: ${response.status}`);
                            }
                            
                            // Create blob and download
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = lecture.attachment_name || 'assignment-file';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                          } catch (error) {
                            console.error('Download failed:', error);
                            error('Failed to download file. The file might not exist or there might be a server issue.', 'Download Failed');
                          }
                        }}
                      >
                        {lecture.attachment_name || 'Download Assignment File'}
                      </a>
                      <p className="text-sm text-gray-500">Click to download assignment materials</p>
                      <p className="text-xs text-gray-400">URL: {lecture.attachment}</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          console.log('Download button clicked for:', lecture.attachment);
                          
                          const response = await fetch(lecture.attachment);
                          if (!response.ok) {
                            throw new Error(`File not found: ${response.status}`);
                          }
                          
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = lecture.attachment_name || 'assignment-file';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          window.URL.revokeObjectURL(url);
                        } catch (error) {
                          console.error('Download failed:', error);
                          error('Failed to download file. The file might not exist or there might be a server issue.', 'Download Failed');
                        }
                      }}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                      title="Download file"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              )}
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-purple-900 mb-2">Assignment Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-purple-700">Due Date:</span>{' '}
                    {lecture.due_date ? new Date(lecture.due_date).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'No due date'}
                  </div>
                  <div>
                    <span className="text-purple-700">Max Points:</span> {lecture.max_points || 'Not set'}
                  </div>
                  <div>
                    <span className="text-purple-700">Passing Score:</span> {lecture.passing_score || 'Not set'}%
                  </div>
                  <div>
                    <span className="text-purple-700">Status:</span>
                    <span className={`ml-1 ${lecture.submission?.submitted ? 'text-green-600' : 'text-orange-600'}`}>
                      {lecture.submission?.submitted ? 'Submitted' : 'Not Submitted'}
                    </span>
                  </div>
                </div>
              </div>

              {lecture.submission?.submitted ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">Your Submission</h4>
                  <p className="text-sm text-green-700">
                    Submitted on: {lecture.submission.submission_date ? new Date(lecture.submission.submission_date).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Date not available'}
                    {lecture.submission.is_late && <span className="text-red-600 ml-2">(Late)</span>}
                  </p>

                  {/* Display submitted text */}
                  {lecture.submission.submission_text && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-green-700 mb-1">Text Submission:</p>
                      <div className="bg-white p-3 rounded border text-sm text-gray-700">
                        {lecture.submission.submission_text}
                      </div>
                    </div>
                  )}

                  {/* Display submitted file */}
                  {lecture.submission.has_file && lecture.submission.original_filename && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-green-700 mb-1">Uploaded File:</p>
                      <div className="flex items-center justify-between bg-white p-3 rounded border">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm text-gray-700">{lecture.submission.original_filename}</span>
                        </div>
                        {lecture.submission.has_file && lecture.submission.original_filename && (
                          <button
                            onClick={async () => {
                              try {
                                // Use the new download endpoint
                                const response = await api.get(`/courses/assignments/submissions/${lecture.submission.id}/download/`, {
                                  responseType: 'blob'
                                });

                                // Create blob URL and download
                                const blob = new Blob([response.data]);
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = lecture.submission.original_filename;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                window.URL.revokeObjectURL(url);
                              } catch (error) {
                                console.error('Download error:', error);
                                error('Failed to download file. Please try again.', 'Download Failed');
                              }
                            }}
                            className="flex items-center px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {lecture.submission.graded && (
                    <div className="mt-3">
                      <p className="text-sm">
                        <span className="text-green-700">Grade:</span> {lecture.submission.grade}/{lecture.max_points}
                      </p>
                      {lecture.submission.feedback && (
                        <div className="mt-2">
                          <p className="text-sm text-green-700">Feedback:</p>
                          <p className="text-sm text-gray-700 italic">{lecture.submission.feedback}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <AssignmentSubmissionForm
                  key={lecture.assignment_id} // Force re-mount when switching assignments
                  assignment={lecture}
                  onSubmissionSuccess={fetchCourseData}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!courseData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Course not found</h2>
          <p className="text-gray-500">The course you're looking for doesn't exist or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <Menu size={20} />
              </button>

              <button
                onClick={() => navigate('/student/dashboard')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 truncate">{courseData.course.title}</h1>
                <p className="text-sm text-gray-500 hidden sm:block truncate">by {courseData.course.instructor}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={`p-2 rounded-lg transition-colors ${
                  refreshing
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title="Refresh course data"
              >
                <RefreshCw
                  size={18}
                  className={refreshing ? 'animate-spin' : ''}
                />
              </button>
              <div className="text-sm text-gray-600 hidden md:block">
                Progress: {courseData.progress.progress_percentage}%
              </div>
              <div className="w-16 sm:w-24 md:w-32 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${courseData.progress.progress_percentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)] relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Course Content */}
        <div className={`
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
          w-80 bg-white border-r border-gray-200 overflow-y-auto
          transform transition-transform duration-300 ease-in-out
          lg:transform-none
          mt-16 lg:mt-0
        `}>
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Course Content</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {courseData.progress.completed_lectures} of {courseData.progress.total_lectures} lectures completed
                </p>
              </div>
              {/* Mobile Close Button */}
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {courseData.sections.map((section) => (
              <div key={section.id}>
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-medium text-gray-900">{section.title}</h3>
                    <p className="text-sm text-gray-500">
                      {section.completed_lectures}/{section.total_lectures} lectures
                    </p>
                  </div>
                  {expandedSections[section.id] ? (
                    <ChevronDown size={16} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400" />
                  )}
                </button>

                {expandedSections[section.id] && (
                  <div className="bg-gray-50">
                    {section.lectures.map((lecture) => (
                      <button
                        key={lecture.id}
                        onClick={() => handleLectureSelect(lecture)}
                        className={`w-full px-6 py-3 text-left hover:bg-gray-100 flex items-center space-x-3 ${
                          selectedLecture?.id === lecture.id ? 'bg-indigo-50 border-r-2 border-indigo-600' : ''
                        }`}
                      >
                        {getLectureIcon(lecture.content_type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{lecture.title}</p>
                          <p className="text-xs text-gray-500 capitalize">{lecture.content_type}</p>
                        </div>
                        {lecture.is_completed && (
                          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-white lg:ml-0 transition-all duration-300 ease-in-out">
          {renderLectureContent()}
        </div>
      </div>
    </div>
  );
};

export default CourseLearning;