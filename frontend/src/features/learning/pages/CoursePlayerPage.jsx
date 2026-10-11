import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ChevronDown, ChevronRight, Menu, RefreshCw, X } from 'lucide-react';

import { errorMessage } from '../../../shared/api/errors';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useConfirm } from '../../../shared/ui/ConfirmDialog';
import { useToast } from '../../../shared/ui/Toast';
import * as learningApi from '../api';
import LectureContent, { LectureIcon } from '../components/LectureContent';

const storageKey = (courseId) => `selectedLecture_${courseId}`;

const readSelection = (courseId) => {
  try {
    return window.localStorage.getItem(storageKey(courseId));
  } catch (error) {
    return null;
  }
};

const writeSelection = (courseId, lectureId) => {
  try {
    window.localStorage.setItem(storageKey(courseId), lectureId);
  } catch (error) {
    // the position is simply not remembered
  }
};

const allLectures = (sections) => sections.flatMap((section) => section.lectures);

const firstIncomplete = (sections) => {
  const lectures = allLectures(sections);
  return lectures.find((lecture) => !lecture.is_completed) || lectures[0] || null;
};

/** The learning interface of one course: outline sidebar and the selected lecture. */
const CoursePlayerPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expanded, setExpanded] = useState({});
  const quizActive = useRef(false);

  const load = useCallback(
    async ({ first = false } = {}) => {
      try {
        const data = await learningApi.fetchPlayer(courseId);
        setCourse(data);

        if (first) {
          setExpanded(Object.fromEntries(data.sections.map((section) => [section.id, true])));

          const saved = readSelection(courseId);
          const lectures = allLectures(data.sections);
          const initial =
            (saved && lectures.find((lecture) => lecture.id === saved)) || firstIncomplete(data.sections);
          if (initial) {
            setSelectedId(initial.id);
            if (!saved) writeSelection(courseId, initial.id);
          }
        }
      } catch (err) {
        if (err.response && err.response.status === 403) {
          toast.error('You must be enrolled in this course to access learning materials', 'Access Denied');
          navigate('/student', { replace: true });
        } else if (first) {
          setCourse(null);
        } else {
          toast.error(errorMessage(err, 'Failed to refresh the course.'), 'Refresh Failed');
        }
      } finally {
        setLoading(false);
      }
    },
    [courseId, navigate, toast]
  );

  useEffect(() => {
    setLoading(true);
    load({ first: true });
    // toast changes identity on every render of its provider; only the course matters here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const selected = useMemo(() => {
    if (!course) return null;
    return allLectures(course.sections).find((lecture) => lecture.id === selectedId) || null;
  }, [course, selectedId]);

  const reload = useCallback(() => load(), [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const select = async (lecture) => {
    if (quizActive.current) {
      const leave = await confirm({
        type: 'warning',
        title: 'Quiz in Progress',
        message:
          'You are currently taking a quiz. Switching lectures will end your current quiz attempt. Are you sure you want to continue?',
        confirmText: 'Switch Lecture',
        cancelText: 'Stay on Quiz',
      });
      if (!leave) return;
    }

    setSidebarOpen(false);
    setSelectedId(lecture.id);
    writeSelection(courseId, lecture.id);
  };

  const complete = async (lectureId) => {
    try {
      await learningApi.completeLecture(courseId, lectureId);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to mark lecture as complete. Please try again.'), 'Update Failed');
    }
  };

  const onQuizActiveChange = useCallback((active) => {
    quizActive.current = active;
  }, []);

  if (loading) {
    return <PageSpinner className="min-h-screen" />;
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Course not found</h2>
          <p className="text-gray-500">
            The course you're looking for doesn't exist or you don't have access to it.
          </p>
        </div>
      </div>
    );
  }

  const progress = course.progress;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen((open) => !open)}
                className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                aria-label="Course content"
              >
                <Menu size={20} />
              </button>

              <button
                onClick={() => navigate('/student/my-learning')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                aria-label="Back to my learning"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 truncate">{course.course.title}</h1>
                <p className="text-sm text-gray-500 hidden sm:block truncate">by {course.course.instructor}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={`p-2 rounded-lg transition-colors ${
                  refreshing ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title="Refresh course data"
              >
                <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <div className="text-sm text-gray-600 hidden md:block">Progress: {progress.progress_percentage}%</div>
              <div className="w-16 sm:w-24 md:w-32 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress_percentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)] relative">
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setSidebarOpen(false)} />
        )}

        <div
          className={`
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
            w-80 bg-white border-r border-gray-200 overflow-y-auto
            transform transition-transform duration-300 ease-in-out
            lg:transform-none
            mt-16 lg:mt-0
          `}
        >
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Course Content</h2>
              <p className="text-sm text-gray-500 mt-1">
                {progress.completed_lectures} of {progress.total_lectures} lectures completed
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <div className="divide-y divide-gray-200">
            {course.sections.map((section) => (
              <div key={section.id}>
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-medium text-gray-900">{section.title}</h3>
                    <p className="text-sm text-gray-500">
                      {section.completed_lectures}/{section.total_lectures} lectures
                    </p>
                  </div>
                  {expanded[section.id] ? (
                    <ChevronDown size={16} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400" />
                  )}
                </button>

                {expanded[section.id] && (
                  <div className="bg-gray-50">
                    {section.lectures.map((lecture) => (
                      <button
                        key={lecture.id}
                        onClick={() => select(lecture)}
                        className={`w-full px-6 py-3 text-left hover:bg-gray-100 flex items-center space-x-3 ${
                          selectedId === lecture.id ? 'bg-indigo-50 border-r-2 border-indigo-600' : ''
                        }`}
                      >
                        <LectureIcon type={lecture.content_type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{lecture.title}</p>
                          <p className="text-xs text-gray-500 capitalize">{lecture.content_type}</p>
                        </div>
                        {lecture.is_completed && <CheckCircle size={16} className="text-green-500 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-white lg:ml-0 transition-all duration-300 ease-in-out">
          <LectureContent
            lecture={selected}
            onComplete={complete}
            onReload={reload}
            onQuizActiveChange={onQuizActiveChange}
          />
        </div>
      </div>
    </div>
  );
};

export default CoursePlayerPage;
