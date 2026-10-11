import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle, Eye, Calendar, MoreVertical, Search, Filter } from 'lucide-react';
import apiService from '../../services/api';
import { useToast } from '../shared/Toast';

// Mock API service with real integration
const api = {
  get: async (endpoint) => {
    // Use real API for pending courses
    if (endpoint.includes('/courses/admin/pending')) {
      try {
        const response = await apiService.get('/courses/admin/pending/');
        return { data: response.data };
      } catch (error) {
        console.error('Error fetching pending courses:', error);
        return { data: [] };
      }
    }

    return { data: {} };
  },

  post: async (endpoint, data) => {
    // Use real API for course approval/rejection
    if (endpoint.includes('/courses/admin/') && endpoint.includes('/approve')) {
      try {
        const courseId = endpoint.split('/')[3];
        const response = await apiService.post(`/courses/admin/${courseId}/approve/`);
        return { data: response.data };
      } catch (error) {
        console.error('Error approving course:', error);
        throw error;
      }
    }

    if (endpoint.includes('/courses/admin/') && endpoint.includes('/reject')) {
      try {
        const courseId = endpoint.split('/')[3];
        const response = await apiService.post(`/courses/admin/${courseId}/reject/`, data);
        return { data: response.data };
      } catch (error) {
        console.error('Error rejecting course:', error);
        throw error;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    return { data: { success: true } };
  }
};

const CourseApprovals = () => {
  const [pendingCourses, setPendingCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { success, error, warning } = useToast();

  useEffect(() => {
    fetchPendingCourses();
  }, []);

  const fetchPendingCourses = async () => {
    try {
      const response = await api.get('/courses/admin/pending');
      setPendingCourses(response.data);
    } catch (error) {
      console.error('Error fetching pending courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (courseId) => {
    try {
      await api.post(`/courses/admin/${courseId}/approve`);
      // Remove from pending list
      setPendingCourses(prev => prev.filter(course => course.id !== courseId));
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(null);
      }
      // Show success message
      success('Course approved successfully!', 'Course Approved');
    } catch (err) {
      console.error('Error approving course:', err);
      error('Failed to approve course. Please try again.', 'Approval Failed');
    }
  };

  const handleReject = async (courseId) => {
    if (!rejectionReason.trim()) {
      warning('Please provide a rejection reason.', 'Missing Reason');
      return;
    }

    try {
      await api.post(`/courses/admin/${courseId}/reject`, {
        reason: rejectionReason
      });

      // Remove from pending list
      setPendingCourses(prev => prev.filter(course => course.id !== courseId));
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(null);
      }
      setShowRejectForm(false);
      setRejectionReason('');
      // Show success message
      success('Course rejected successfully!', 'Course Rejected');
    } catch (err) {
      console.error('Error rejecting course:', err);
      error('Failed to reject course. Please try again.', 'Rejection Failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const filteredCourses = pendingCourses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         course.instructor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         course.instructor?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Course Approvals</h2>
          <p className="text-gray-600 mt-1">{pendingCourses.length} courses awaiting approval</p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses or instructors..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Course Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredCourses.map((course) => (
          <div key={course.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">by {course.instructor?.name || course.instructor?.email}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  course.course_type === 'free'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {course.course_type === 'free' ? 'FREE' : 'PLUS'}
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
                  <p className={`text-xl font-bold ${course.total_weight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {course.total_weight || 0}%
                  </p>
                  <p className="text-xs text-gray-500">Grade Weight</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Calendar size={16} />
                  <span>Submitted {new Date(course.submitted_date).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedCourse(course)}
                    className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Eye size={16} />
                    <span>Review</span>
                  </button>

                  <button
                    onClick={() => handleApprove(course.id)}
                    className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                  >
                    <CheckCircle size={16} />
                    <span>Approve</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedCourse(course);
                      setShowRejectForm(true);
                    }}
                    className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                  >
                    <XCircle size={16} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCourses.length === 0 && (
        <div className="text-center py-12">
          <Clock size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pending approvals</h3>
          <p className="text-gray-500">
            {searchQuery
              ? 'Try adjusting your search criteria.'
              : 'All courses have been reviewed. Great job!'}
          </p>
        </div>
      )}

      {/* Course Review Modal */}
      {selectedCourse && !showRejectForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Course Review</h2>
              <button
                onClick={() => setSelectedCourse(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Course Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Instructor</h3>
                  <p className="text-gray-900">{selectedCourse.instructor?.name || selectedCourse.instructor?.email}</p>
                  <p className="text-sm text-gray-500">{selectedCourse.instructor?.email}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Category</h3>
                  <p className="text-gray-900">{selectedCourse.category}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Course Type</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    selectedCourse.course_type === 'free'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {selectedCourse.course_type === 'free' ? 'FREE' : 'COURSERA PLUS'}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Duration</h3>
                  <p className="text-gray-900">{selectedCourse.duration_hours || 0} hours</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                <p className="text-gray-900">{selectedCourse.description}</p>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedCourse.sections_count || 0}</p>
                  <p className="text-sm text-gray-500">Sections</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedCourse.lectures_count || 0}</p>
                  <p className="text-sm text-gray-500">Lectures</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedCourse.duration_hours || 0}h</p>
                  <p className="text-sm text-gray-500">Duration</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className={`text-2xl font-bold ${selectedCourse.total_weight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedCourse.total_weight || 0}%
                  </p>
                  <p className="text-sm text-gray-500">Grade Weight</p>
                </div>
              </div>

              {/* Grade Weight Status */}
              <div className={`flex items-center justify-between p-4 rounded-lg ${
                selectedCourse.total_weight === 100
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center space-x-2">
                  {selectedCourse.total_weight === 100 ? (
                    <CheckCircle className="text-green-600" size={20} />
                  ) : (
                    <AlertCircle className="text-red-600" size={20} />
                  )}
                  <span className={`text-sm font-medium ${
                    selectedCourse.total_weight === 100 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    Grade Weight: {selectedCourse.total_weight}%
                    {selectedCourse.total_weight === 100
                      ? ' - Ready for approval'
                      : ` - Missing ${100 - (selectedCourse.total_weight || 0)}%`
                    }
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-4 pt-6 border-t">
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowRejectForm(true);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Reject Course
                </button>
                <button
                  onClick={() => handleApprove(selectedCourse.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Approve Course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Form */}
      {showRejectForm && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Course</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting "{selectedCourse.title}":
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full h-32 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex items-center justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedCourse.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Reject Course
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseApprovals;