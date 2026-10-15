import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayCircle, Clock, BookOpen, Award } from 'lucide-react';

import { formatDate } from '../../../shared/lib/time';
import CourseThumbnail from '../../../shared/ui/CourseThumbnail';

/**
 * A course the student is enrolled in, with its progress and the button that opens the player.
 * ``compact`` leaves out the lesson count and the last visit (the home page lists three of them).
 */
const EnrolledCourseCard = ({ course, compact = false }) => {
  const navigate = useNavigate();
  const completed = course.status === 'completed';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative">
        <CourseThumbnail course={course} className="w-full h-40 object-cover" />
        <div className="absolute top-4 right-4">
          <PlayCircle className="text-white drop-shadow-lg" size={32} />
        </div>
        {completed && (
          <div className="absolute top-4 left-4 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center">
            <Award size={12} className="mr-1" />
            Completed
          </div>
        )}
      </div>

      <div className="p-6">
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{course.title}</h3>
        <p className="text-sm text-gray-600 mb-4">{course.instructor}</p>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{Math.round(course.progress || 0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${course.progress || 0}%` }}
            ></div>
          </div>
        </div>

        {!compact && (
          <>
            <div className="flex justify-between text-xs text-gray-500 mb-4">
              <span className="flex items-center">
                <Clock size={12} className="mr-1" />
                {course.estimated_completion || 'N/A'}
              </span>
              <span className="flex items-center">
                <BookOpen size={12} className="mr-1" />
                {course.total_lessons || 0} lessons
              </span>
            </div>

            {course.last_accessed && (
              <p className="text-xs text-gray-500 mb-4">
                Last accessed: {formatDate(course.last_accessed)}
              </p>
            )}
          </>
        )}

        <button
          onClick={() => navigate(`/courses/${course.course_id}/learn`)}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {completed ? 'Review Course' : 'Continue Learning'}
        </button>
      </div>
    </div>
  );
};

export default EnrolledCourseCard;
