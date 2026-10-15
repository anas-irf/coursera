import React, { useMemo, useState } from 'react';
import { Plus, Search, Star, Edit2, Eye, EyeOff, Trash2, AlertCircle, BookOpen } from 'lucide-react';

import { useAuth } from '../../../shared/auth/AuthProvider';
import { errorMessage } from '../../../shared/api/errors';
import { formatDate } from '../../../shared/lib/time';
import CourseThumbnail from '../../../shared/ui/CourseThumbnail';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import StatusBadge from '../../../shared/ui/StatusBadge';
import { useToast } from '../../../shared/ui/Toast';
import { CreateCourseModal, EditCourseModal } from '../components/CourseModals';
import DeleteCourseModal from '../components/DeleteCourseModal';
import {
  useDeleteCourse,
  useInstructorCourses,
  useSubmitForReview,
  useUnpublishCourse,
} from '../hooks/useCourses';
import { visibleCourses } from '../lib/courseList';
import { LOCKED_DELETE_HINT, LOCKED_EDIT_HINT, isLocked, publishAction } from '../lib/publishing';

const TONES = {
  success: 'bg-green-100 text-green-700 hover:bg-green-200',
  info: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  danger: 'bg-red-100 text-red-700 hover:bg-red-200',
  waiting: 'bg-yellow-100 text-yellow-700 cursor-not-allowed',
};

const CoursesPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const courses = useInstructorCourses();
  const submitForReview = useSubmitForReview();
  const unpublish = useUnpublishCourse();
  const deleteCourse = useDeleteCourse();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOption, setSortOption] = useState('date');

  const all = useMemo(() => courses.data || [], [courses.data]);
  const shown = useMemo(
    () => visibleCourses(all, { search: searchTerm, status: statusFilter, sort: sortOption }),
    [all, searchTerm, statusFilter, sortOption]
  );

  const handlePublish = (course) => {
    const action = publishAction(course.status);

    if (action.kind === 'submit') {
      submitForReview.mutate(course.id, {
        onSuccess: (data) => toast.success(data.message || 'Course submitted for review!', 'Submit for Review'),
        onError: (err) => {
          toast.error(
            errorMessage(err, 'Failed to submit course for review. Please try again.'),
            'Submission Failed'
          );
          const detail = err.response && err.response.data;
          if (detail && detail.current_weight !== undefined) {
            toast.warning(
              `Current grade weight: ${detail.current_weight}%. Missing: ${detail.missing_weight}%`,
              'Grade Weight Issue'
            );
          }
        },
      });
    } else if (action.kind === 'unpublish') {
      unpublish.mutate(course.id, {
        onSuccess: (data) =>
          toast.success(
            data.message || 'Course has been unpublished successfully! You can now edit the course.',
            'Course Unpublished'
          ),
        onError: (err) =>
          toast.error(errorMessage(err, 'Failed to unpublish course. Please try again.'), 'Unpublish Failed'),
      });
    }
  };

  // errors are re-thrown so the dialog can show them
  const handleDeleteConfirm = async (confirmation) => {
    const { title } = courseToDelete;
    await deleteCourse.mutateAsync({ courseId: courseToDelete.id, confirmation });
    setCourseToDelete(null);
    toast.success(`Course "${title}" has been successfully deleted.`, 'Course Deleted');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortOption('date');
  };

  if (courses.isPending) {
    return <PageSpinner />;
  }

  if (courses.isError) {
    return (
      <ErrorState
        title="We could not load your courses"
        error={courses.error}
        onRetry={() => courses.refetch()}
      />
    );
  }

  const createButton = (label, className) => (
    <button onClick={() => setShowCreateModal(true)} className={className}>
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">My Courses</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 flex items-center shrink-0"
        >
          <Plus size={20} className="mr-2" />
          Create New Course
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search courses..."
                aria-label="Search courses"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <select
            aria-label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="pending_review">Pending Review</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            aria-label="Sort"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="date">Sort by Date</option>
            <option value="revenue">Sort by Revenue</option>
            <option value="students">Sort by Students</option>
          </select>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shown.map((course) => {
          const action = publishAction(course.status);
          const locked = isLocked(course.status);
          return (
            <div key={course.id} className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden">
              <div className="relative">
                <CourseThumbnail course={course} className="w-full h-48 object-cover" />
                <StatusBadge status={course.status} className="absolute top-4 right-4" />
              </div>

              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.title}</h3>

                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                  <div className="text-center">
                    <p className="text-gray-500">Students</p>
                    <p className="font-semibold text-gray-900">{course.total_enrolled}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Rating</p>
                    <p className="font-semibold text-yellow-600 flex items-center justify-center">
                      <Star size={14} className="mr-1" />
                      {course.average_rating || 'N/A'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500">Revenue</p>
                    <p className="font-semibold text-green-600">${course.total_revenue}</p>
                  </div>
                </div>

                {/* Rejection reason display */}
                {course.status === 'rejected' && course.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <div className="flex items-start space-x-2">
                      <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800 mb-1">Course Rejected</p>
                        <p className="text-sm text-red-700">{course.rejection_reason}</p>
                        {course.rejection_date && (
                          <p className="text-xs text-red-600 mt-1">
                            Rejected on {formatDate(course.rejection_date)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {/* Edit and Publish/Unpublish buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedCourse(course)}
                      disabled={locked}
                      className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center ${
                        locked
                          ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title={locked ? LOCKED_EDIT_HINT : 'Edit course'}
                    >
                      <Edit2 size={16} className="mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handlePublish(course)}
                      disabled={action.disabled}
                      className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center ${TONES[action.tone]} ${
                        action.disabled ? 'cursor-not-allowed' : ''
                      }`}
                    >
                      {action.kind === 'unpublish' ? (
                        <EyeOff size={16} className="mr-1" />
                      ) : (
                        <Eye size={16} className="mr-1" />
                      )}
                      {action.label}
                    </button>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => setCourseToDelete(course)}
                    disabled={locked}
                    className={`w-full px-3 py-2 rounded-lg transition-colors flex items-center justify-center border ${
                      locked
                        ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
                    }`}
                    title={locked ? LOCKED_DELETE_HINT : 'Delete course'}
                  >
                    <Trash2 size={16} className="mr-1" />
                    Delete Course
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* No results message */}
      {shown.length === 0 && all.length > 0 && (
        <EmptyState
          icon={Search}
          title="No courses found"
          className="py-12 bg-white rounded-xl"
          action={
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
            >
              Clear filters
            </button>
          }
        >
          Try adjusting your search or filter criteria.
        </EmptyState>
      )}

      {/* No courses at all */}
      {all.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          className="py-12 bg-white rounded-xl"
          action={createButton(
            'Create Your First Course',
            'px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200'
          )}
        >
          Create your first course to get started!
        </EmptyState>
      )}

      {showCreateModal && (
        <CreateCourseModal
          onClose={() => setShowCreateModal(false)}
          onSave={() => setShowCreateModal(false)}
        />
      )}

      {selectedCourse && (
        <EditCourseModal
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          onSave={() => setSelectedCourse(null)}
        />
      )}

      {courseToDelete && (
        <DeleteCourseModal
          course={courseToDelete}
          currentUser={user}
          onClose={() => setCourseToDelete(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
};

export default CoursesPage;
