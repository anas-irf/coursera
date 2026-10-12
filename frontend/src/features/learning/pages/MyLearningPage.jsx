import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayCircle, Clock, BookOpen, Award, Search } from 'lucide-react';

import { mediaUrl } from '../../../shared/lib/media';
import { PageSpinner } from '../../../shared/ui/Spinner';
import * as learningApi from '../api';

const MyLearningPage = () => {
  const navigate = useNavigate();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, completed
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let cancelled = false;
    learningApi
      .myCourses()
      .then((courses) => !cancelled && setEnrolledCourses(courses))
      .catch(() => !cancelled && setEnrolledCourses([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCourses = enrolledCourses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.instructor.toLowerCase().includes(searchTerm.toLowerCase());

    if (filter === 'all') return matchesSearch;
    // the list only holds running enrolments; rows have no status unless completed
    if (filter === 'active') return matchesSearch && course.status !== 'completed';
    if (filter === 'completed') return matchesSearch && course.status === 'completed';

    return matchesSearch;
  });

  if (loading) {
    return <PageSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Learning</h1>
        <p className="text-gray-600">Continue your learning journey</p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search your courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">All Courses</option>
            <option value="active">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Course Grid */}
      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <div key={course.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="relative">
                <img
                  src={mediaUrl(course.thumbnail) || 'https://via.placeholder.com/400x200/4F46E5/ffffff?text=Course'}
                  alt={course.title}
                  className="w-full h-40 object-cover"
                />
                <div className="absolute top-4 right-4">
                  <PlayCircle className="text-white drop-shadow-lg" size={32} />
                </div>
                {course.status === 'completed' && (
                  <div className="absolute top-4 left-4 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center">
                    <Award size={12} className="mr-1" />
                    Completed
                  </div>
                )}
              </div>

              <div className="p-6">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{course.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{course.instructor}</p>

                {/* Progress Bar */}
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

                {/* Course Stats */}
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

                {/* Last Accessed */}
                {course.last_accessed && (
                  <p className="text-xs text-gray-500 mb-4">
                    Last accessed: {new Date(course.last_accessed).toLocaleDateString()}
                  </p>
                )}

                {/* Action Button */}
                <button
                  onClick={() => navigate(`/courses/${course.course_id}/learn`)}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {course.status === 'completed' ? 'Review Course' : 'Continue Learning'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          {enrolledCourses.length === 0 ? (
            <div>
              <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No enrolled courses</h3>
              <p className="text-gray-500 mb-6">Start your learning journey by enrolling in a course!</p>
              <button
                onClick={() => navigate('/student/explore')}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Browse Courses
              </button>
            </div>
          ) : (
            <div>
              <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyLearningPage;