import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle, Eye, Calendar, Search } from 'lucide-react';

import { errorMessage } from '../../../shared/api/errors';
import { isFullWeight } from '../../../shared/lib/gradeWeight';
import { formatDate } from '../../../shared/lib/time';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import Modal from '../../../shared/ui/Modal';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useToast } from '../../../shared/ui/Toast';
import { useApproveCourse, usePendingCourses, useRejectCourse } from '../hooks/useAdmin';

const typeBadge = (type, full = false) =>
  type === 'free'
    ? { className: 'bg-green-100 text-green-800', label: 'FREE' }
    : { className: 'bg-purple-100 text-purple-800', label: full ? 'COURSERA PLUS' : 'PLUS' };

const instructorName = (course) => course.instructor?.name || course.instructor?.email;

const ApprovalsPage = () => {
  const pending = usePendingCourses();
  const approve = useApproveCourse();
  const reject = useRejectCourse();
  const toast = useToast();

  const [reviewing, setReviewing] = useState(null); // the course shown in the review dialog
  const [rejecting, setRejecting] = useState(null); // the course the rejection reason is asked for
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleApprove = (courseId) =>
    approve.mutate({ courseId }, {
      onSuccess: () => {
        setReviewing(null);
        toast.success('Course approved successfully!', 'Course Approved');
      },
      onError: (err) =>
        toast.error(errorMessage(err, 'Failed to approve course. Please try again.'), 'Approval Failed'),
    });

  const handleReject = (courseId) => {
    if (!rejectionReason.trim()) {
      toast.warning('Please provide a rejection reason.', 'Missing Reason');
      return;
    }

    reject.mutate({ courseId, reason: rejectionReason }, {
      onSuccess: () => {
        setRejecting(null);
        setReviewing(null);
        setRejectionReason('');
        toast.success('Course rejected successfully!', 'Course Rejected');
      },
      onError: (err) =>
        toast.error(errorMessage(err, 'Failed to reject course. Please try again.'), 'Rejection Failed'),
    });
  };

  const closeRejection = () => {
    setRejecting(null);
    setRejectionReason('');
  };

  if (pending.isPending) {
    return <PageSpinner />;
  }

  if (pending.isError) {
    return (
      <ErrorState
        title="We could not load the approval queue"
        error={pending.error}
        onRetry={() => pending.refetch()}
      />
    );
  }

  const courses = pending.data;
  const term = searchQuery.toLowerCase();
  const filteredCourses = courses.filter(
    (course) =>
      course.title.toLowerCase().includes(term) ||
      course.instructor?.name?.toLowerCase().includes(term) ||
      course.instructor?.email?.toLowerCase().includes(term)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Course Approvals</h2>
          <p className="text-gray-600 mt-1">
            {courses.length} course{courses.length === 1 ? '' : 's'} awaiting approval
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses or instructors..."
              aria-label="Search courses or instructors"
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Course Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredCourses.map((course) => {
          const badge = typeBadge(course.course_type);
          return (
            <article
              key={course.id}
              aria-label={course.title}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">by {instructorName(course)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{course.description}</p>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-xl font-bold text-gray-900">{course.sections_count || 0}</p>
                    <p className="text-xs text-gray-500">Sections</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-gray-900">{course.lectures_count || 0}</p>
                    <p className="text-xs text-gray-500">Lectures</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-gray-900">{course.duration_hours || 0}h</p>
                    <p className="text-xs text-gray-500">Duration</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-xl font-bold ${isFullWeight(course.total_weight) ? 'text-green-600' : 'text-red-600'}`}>
                      {course.total_weight || 0}%
                    </p>
                    <p className="text-xs text-gray-500">Grade Weight</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Calendar size={16} />
                    <span>Submitted {formatDate(course.submitted_date)}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setReviewing(course)}
                      className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Eye size={16} />
                      <span>Review</span>
                    </button>

                    <button
                      onClick={() => handleApprove(course.id)}
                      disabled={approve.isPending}
                      className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={16} />
                      <span>Approve</span>
                    </button>

                    <button
                      onClick={() => setRejecting(course)}
                      className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      <XCircle size={16} />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {filteredCourses.length === 0 && (
        <EmptyState icon={Clock} title="No pending approvals">
          {searchQuery ? 'Try adjusting your search criteria.' : 'All courses have been reviewed. Great job!'}
        </EmptyState>
      )}

      {/* Course Review Modal */}
      {reviewing && !rejecting && (
        <Modal title="Course Review" onClose={() => setReviewing(null)} size="lg">
          <div className="p-6 space-y-6">
            {/* Course Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Instructor</h3>
                <p className="text-gray-900">{instructorName(reviewing)}</p>
                <p className="text-sm text-gray-500">{reviewing.instructor?.email}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Category</h3>
                <p className="text-gray-900">{reviewing.category}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Course Type</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${typeBadge(reviewing.course_type, true).className}`}>
                  {typeBadge(reviewing.course_type, true).label}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Duration</h3>
                <p className="text-gray-900">{reviewing.duration_hours || 0} hours</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
              <p className="text-gray-900">{reviewing.description}</p>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{reviewing.sections_count || 0}</p>
                <p className="text-sm text-gray-500">Sections</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{reviewing.lectures_count || 0}</p>
                <p className="text-sm text-gray-500">Lectures</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{reviewing.duration_hours || 0}h</p>
                <p className="text-sm text-gray-500">Duration</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className={`text-2xl font-bold ${isFullWeight(reviewing.total_weight) ? 'text-green-600' : 'text-red-600'}`}>
                  {reviewing.total_weight || 0}%
                </p>
                <p className="text-sm text-gray-500">Grade Weight</p>
              </div>
            </div>

            {/* Grade Weight Status */}
            <div className={`flex items-center justify-between p-4 rounded-lg ${
              isFullWeight(reviewing.total_weight)
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center space-x-2">
                {isFullWeight(reviewing.total_weight) ? (
                  <CheckCircle className="text-green-600" size={20} />
                ) : (
                  <AlertCircle className="text-red-600" size={20} />
                )}
                <span className={`text-sm font-medium ${
                  isFullWeight(reviewing.total_weight) ? 'text-green-700' : 'text-red-700'
                }`}>
                  Grade Weight: {reviewing.total_weight}%
                  {isFullWeight(reviewing.total_weight)
                    ? ' - Ready for approval'
                    : ` - Missing ${Number((100 - (reviewing.total_weight || 0)).toFixed(2))}%`
                  }
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t">
              <button
                onClick={() => setReviewing(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Close
              </button>
              <button
                onClick={() => setRejecting(reviewing)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Reject Course
              </button>
              <button
                onClick={() => handleApprove(reviewing.id)}
                disabled={approve.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
              >
                Approve Course
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rejection Form */}
      {rejecting && (
        <Modal title="Reject Course" onClose={closeRejection} size="sm">
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting "{rejecting.title}":
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              aria-label="Rejection reason"
              data-autofocus
              className="w-full h-32 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex items-center justify-end space-x-3 mt-4">
              <button
                onClick={closeRejection}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(rejecting.id)}
                disabled={reject.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
              >
                Reject Course
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ApprovalsPage;
