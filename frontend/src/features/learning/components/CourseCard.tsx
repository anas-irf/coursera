import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Star, Clock, BookOpen, Crown } from 'lucide-react';

import { errorMessage, errorStatus } from '../../../shared/api/errors';
import type { UUID } from '../../../shared/types';
import CourseThumbnail from '../../../shared/ui/CourseThumbnail';
import { useConfirm } from '../../../shared/ui/ConfirmDialog';
import { useToast } from '../../../shared/ui/Toast';
import { useEnroll, useToggleBookmark } from '../hooks/useLearning';
import type { CatalogCourse } from '../types';

interface CourseCardProps {
  /**
   * A catalogue course.  The "Go to Course" button opens ``course_id`` when the record has one and
   * ``id`` otherwise, as it always did; the catalogue sends no ``course_id``.
   */
  course: CatalogCourse & { course_id?: UUID };
}

const CourseCard = ({ course }: CourseCardProps) => {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(Boolean(course.is_bookmarked));
  const enroll = useEnroll();
  const bookmark = useToggleBookmark();
  const toast = useToast();
  const { confirm } = useConfirm();

  const enrolling = enroll.isPending;
  const goToCheckout = () => navigate('/student/checkout');

  const handleEnroll = async () => {
    if (!course.can_enroll || enrolling) return;

    try {
      await enroll.mutateAsync(course.id);
      toast.success('Successfully enrolled in course!', 'Enrollment Complete');
    } catch (err) {
      if (errorStatus(err) === 402) {
        const upgrade = await confirm({
          type: 'info',
          title: 'Coursera Plus Required',
          message: 'This course requires Coursera Plus. Would you like to upgrade now?',
          confirmText: 'Upgrade Now',
          cancelText: 'Not Now'
        });
        if (upgrade) goToCheckout();
      } else {
        toast.error(errorMessage(err, 'Failed to enroll. Please try again.'), 'Enrollment Failed');
      }
    }
  };

  const toggleBookmark = () => {
    const next = !liked;
    setLiked(next); // optimistic; undone if the server refuses
    bookmark.mutate(course.id, {
      onError: (err) => {
        setLiked(!next);
        toast.error(errorMessage(err, 'The bookmark could not be saved.'), 'Bookmark failed');
      },
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden">
      <div className="relative">
        <CourseThumbnail course={course} className="w-full h-48 object-cover" />
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            course.course_type === "free"
              ? "bg-green-500 text-white"
              : "bg-purple-500 text-white"
          }`}>
            {course.course_type === "free" ? "FREE" : "PLUS"}
          </span>
          {course.is_enrolled && (
            <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
              ENROLLED
            </span>
          )}
        </div>
        <button
          onClick={toggleBookmark}
          aria-label={liked ? 'Remove bookmark' : 'Bookmark this course'}
          aria-pressed={liked}
          className="absolute top-4 right-4 bg-white/90 backdrop-blur p-2 rounded-full hover:bg-white transition-colors"
        >
          <Heart
            size={18}
            className={liked ? "fill-red-500 text-red-500" : "text-gray-600"}
          />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
            {course.category}
          </span>
          <span className="text-xs text-gray-500">{course.level}</span>
        </div>

        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
          {course.title}
        </h3>
        <p className="text-sm text-gray-600 mb-3">{course.instructor}</p>

        <div className="flex items-center space-x-4 mb-3">
          <div className="flex items-center">
            <Star size={16} className="text-yellow-500 fill-current" />
            <span className="text-sm font-medium ml-1">{course.rating}</span>
          </div>
          <span className="text-sm text-gray-500">
            ({(course.students || 0).toLocaleString()} students)
          </span>
        </div>

        {/* Progress bar for enrolled courses */}
        {course.is_enrolled && course.progress !== undefined && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
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
        )}

        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center space-x-3 text-sm text-gray-500">
            <span className="flex items-center">
              <Clock size={14} className="mr-1" />
              {course.duration}
            </span>
            <span className="flex items-center">
              <BookOpen size={14} className="mr-1" />
              {course.modules} modules
            </span>
          </div>
        </div>

        {course.is_enrolled ? (
          <button
            onClick={() => navigate(`/courses/${course.course_id || course.id}/learn`)}
            className="w-full mt-3 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium bg-green-600 text-white hover:bg-green-700"
          >
            Go to Course
          </button>
        ) : course.can_enroll ? (
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="w-full mt-3 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
          >
            {enrolling ? "Enrolling..." : "Enroll Now"}
          </button>
        ) : course.course_type === 'coursera_plus' && course.enrollment_message === 'Plus subscription required' ? (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-center py-2 px-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
              <Crown className="h-4 w-4 text-yellow-600 mr-2" />
              <span className="text-sm font-medium text-yellow-800">Coursera Plus Required</span>
            </div>
            <button
              onClick={goToCheckout}
              className="w-full px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transform hover:scale-105"
            >
              <Crown className="h-4 w-4 inline mr-1" />
              Upgrade to Access
            </button>
          </div>
        ) : (
          <button
            disabled
            className="w-full mt-3 px-4 py-2 rounded-lg text-sm font-medium bg-gray-300 text-gray-500 cursor-not-allowed"
          >
            {course.enrollment_message || "Cannot Enroll"}
          </button>
        )}
      </div>
    </div>
  );
};

export default CourseCard;
