import React from 'react';
import { Award, BookOpen, CheckCircle, FileText, PlayCircle } from 'lucide-react';

import { AssignmentPanel, QuizRunner } from '../../assessments';
import VideoLecture from './VideoLecture';

export const LectureIcon = ({ type, size = 16 }) => {
  switch (type) {
    case 'video':
      return <PlayCircle size={size} className="text-blue-500" />;
    case 'reading':
      return <BookOpen size={size} className="text-green-500" />;
    case 'quiz':
      return <FileText size={size} className="text-orange-500" />;
    case 'assignment':
      return <Award size={size} className="text-purple-500" />;
    default:
      return <FileText size={size} className="text-gray-500" />;
  }
};

/** The selected lecture: header with completion state and the content of its type. */
const LectureContent = ({ lecture, onComplete, onReload, onQuizActiveChange }) => {
  if (!lecture) {
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

  const canComplete =
    !lecture.is_completed && (lecture.content_type === 'video' || lecture.content_type === 'reading');

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <LectureIcon type={lecture.content_type} />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{lecture.title}</h1>
              <p className="text-sm text-gray-500 capitalize">{lecture.content_type} Lecture</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {canComplete && (
              <button
                onClick={() => onComplete(lecture.id)}
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
        {lecture.description && <p className="mt-2 text-gray-600">{lecture.description}</p>}
      </div>

      <div className="flex-1 overflow-auto">
        {lecture.content_type === 'video' && <VideoLecture lecture={lecture} />}

        {lecture.content_type === 'reading' && (
          <div className="p-4 sm:p-6">
            <div className="prose max-w-none">
              <div className="mb-4 text-sm text-gray-500">
                Estimated reading time: {lecture.estimated_reading_time} minutes
              </div>
              <div
                key={lecture.id}
                className="text-gray-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: lecture.content || '<p>Reading content not available</p>' }}
              />
            </div>
          </div>
        )}

        {lecture.content_type === 'quiz' && (
          <QuizRunner
            key={lecture.id}
            lecture={lecture}
            onFinished={onReload}
            onActiveChange={onQuizActiveChange}
          />
        )}

        {lecture.content_type === 'assignment' && (
          <AssignmentPanel key={lecture.id} lecture={lecture} onSubmitted={onReload} />
        )}
      </div>
    </div>
  );
};

export default LectureContent;
