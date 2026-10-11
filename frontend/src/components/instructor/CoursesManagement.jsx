import React, { useState, useEffect } from 'react';
import { Plus, Search, Star, Edit2, Eye, EyeOff, Trash2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { CreateCourseModal, EditCourseModal } from './CourseModals';
import DeleteCourseModal from './DeleteCourseModal';
import authService from '../../services/authService';
import { useToast } from '../../shared/ui/Toast';


const CoursesManagement = () => {
  const [courses, setCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOption, setSortOption] = useState('date');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const { success, error, warning } = useToast();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses/instructor/courses/');
      setCourses(response.data);
      setFilteredCourses(response.data); // Initialize filtered courses
    } catch (error) {
      console.error('Error fetching courses:', error);
      // Set empty array as fallback to prevent infinite reload
      setCourses([]);
      setFilteredCourses([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort courses whenever search term, status filter, or sort option changes
  useEffect(() => {
    let filtered = [...courses];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(course => course.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'revenue':
          return (b.total_revenue || 0) - (a.total_revenue || 0);
        case 'students':
          return (b.total_enrolled || 0) - (a.total_enrolled || 0);
        case 'date':
        default:
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });

    setFilteredCourses(filtered);
  }, [courses, searchTerm, statusFilter, sortOption]);

  const handlePublishToggle = async (courseId, currentStatus) => {
    // Allow publish request for draft and rejected courses
    if (currentStatus === 'draft' || currentStatus === 'rejected') {
      try {
        const response = await api.post(`/courses/instructor/courses/${courseId}/apply_for_publish/`);
        success(response.data.message || 'Course submitted for review!', 'Submit for Review');
        fetchCourses();
      } catch (err) {
        console.error('Error applying for publish:', err);
        if (err.response?.data?.error) {
          error(err.response.data.error, 'Submission Failed');
          if (err.response.data.current_weight !== undefined) {
            warning(
              `Current grade weight: ${err.response.data.current_weight}%. Missing: ${err.response.data.missing_weight}%`,
              'Grade Weight Issue'
            );
          }
        } else {
          error('Failed to submit course for review. Please try again.', 'Submission Failed');
        }
      }
    } else if (currentStatus === 'published') {
      // Handle unpublish
      try {
        const response = await api.post(`/courses/instructor/courses/${courseId}/unpublish/`);
        success(response.data.message || 'Course has been unpublished successfully! You can now edit the course.', 'Course Unpublished');
        fetchCourses();
      } catch (err) {
        console.error('Error unpublishing course:', err);
        if (err.response?.data?.error) {
          error(err.response.data.error, 'Unpublish Failed');
        } else {
          error('Failed to unpublish course. Please try again.', 'Unpublish Failed');
        }
      }
    }
  };

  const handleDeleteClick = (course) => {
    setCourseToDelete(course);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (confirmation) => {
    try {
      await api.post(`/courses/instructor/courses/${courseToDelete.id}/delete-course/`, {
        confirmation
      });

      // Refresh the courses list
      await fetchCourses();

      // Close modal and reset state
      setShowDeleteModal(false);
      const courseTitle = courseToDelete.title;
      setCourseToDelete(null);

      success(`Course "${courseTitle}" has been successfully deleted.`, 'Course Deleted');
    } catch (err) {
      console.error('Error deleting course:', err);
      throw err; // Re-throw to let the modal handle the error
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="pending_review">Pending Review</option>
            <option value="rejected">Rejected</option>
            <option value="unpublished">Unpublished</option>
          </select>
          <select 
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
        {(filteredCourses || []).map((course) => (
          <div key={course.id} className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden">
            <div className="relative">
              <img
                src={course.thumbnail || 'https://via.placeholder.com/300x200/4F46E5/ffffff?text=Course'}
                alt={course.title || 'Course'}
                className="w-full h-48 object-cover"
              />
              <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold ${
                course.status === 'published'
                  ? 'bg-green-100 text-green-800'
                  : course.status === 'pending_review'
                  ? 'bg-blue-100 text-blue-800'
                  : course.status === 'rejected'
                  ? 'bg-red-100 text-red-800'
                  : course.status === 'draft'
                  ? 'bg-gray-100 text-gray-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {course.status === 'pending_review' ? 'Pending Review' : course.status}
              </span>
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
                          Rejected on {new Date(course.rejection_date).toLocaleDateString()}
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
                    disabled={course.status === 'published'}
                    className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center ${
                      course.status === 'published'
                        ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={course.status === 'published' ? 'Cannot edit published courses. Please unpublish first.' : 'Edit course'}
                  >
                    <Edit2 size={16} className="mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => handlePublishToggle(course.id, course.status)}
                    disabled={course.status === 'pending_review'}
                    className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center ${
                      course.status === 'published'
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : course.status === 'pending_review'
                        ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed'
                        : course.status === 'rejected'
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {course.status === 'published' ? (
                      <>
                        <EyeOff size={16} className="mr-1" />
                        Unpublish
                      </>
                    ) : course.status === 'pending_review' ? (
                      <>
                        <Eye size={16} className="mr-1" />
                        Under Review
                      </>
                    ) : course.status === 'rejected' ? (
                      <>
                        <Eye size={16} className="mr-1" />
                        Resubmit for Review
                      </>
                    ) : (
                      <>
                        <Eye size={16} className="mr-1" />
                        Request Publish
                      </>
                    )}
                  </button>
                </div>
                
                {/* Delete button */}
                <button
                  onClick={() => handleDeleteClick(course)}
                  disabled={course.status === 'published'}
                  className={`w-full px-3 py-2 rounded-lg transition-colors flex items-center justify-center border ${
                    course.status === 'published'
                      ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
                  }`}
                  title={course.status === 'published' ? 'Cannot delete published courses. Please unpublish first.' : 'Delete course'}
                >
                  <Trash2 size={16} className="mr-1" />
                  Delete Course
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* No results message */}
      {!loading && filteredCourses.length === 0 && courses.length > 0 && (
        <div className="text-center py-12 bg-white rounded-xl">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setSortOption('date');
            }}
            className="mt-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* No courses at all */}
      {!loading && courses.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses yet</h3>
          <p className="text-gray-600 mb-4">Create your first course to get started!</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200"
          >
            Create Your First Course
          </button>
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateModal && (
        <CreateCourseModal onClose={() => setShowCreateModal(false)} onSave={() => {
          fetchCourses();
          setShowCreateModal(false);
        }} />
      )}

      {/* Edit Course Modal */}
      {selectedCourse && (
        <EditCourseModal
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          onSave={() => {
            fetchCourses();
            setSelectedCourse(null);
          }}
        />
      )}

      {/* Delete Course Modal */}
      {showDeleteModal && courseToDelete && (
        <DeleteCourseModal
          course={courseToDelete}
          currentUser={authService.getCurrentUser()}
          onClose={() => {
            setShowDeleteModal(false);
            setCourseToDelete(null);
          }}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
};

export default CoursesManagement;