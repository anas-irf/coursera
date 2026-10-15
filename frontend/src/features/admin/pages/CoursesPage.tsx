import React, { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';

import { isFullWeight } from '../../../shared/lib/gradeWeight';
import { formatDate } from '../../../shared/lib/time';
import type { CourseStatus } from '../../../shared/types';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import StatusBadge from '../../../shared/ui/StatusBadge';
import { useAdminCourses } from '../hooks/useAdmin';

type StatusFilter = 'all' | CourseStatus;

const CoursesPage = () => {
  const query = useAdminCourses();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (query.isPending) {
    return <PageSpinner />;
  }

  if (query.isError) {
    return (
      <ErrorState title="We could not load the courses" error={query.error} onRetry={() => query.refetch()} />
    );
  }

  const courses = query.data;
  const filteredCourses = courses.filter(course => {
    const matchesStatus = filter === 'all' || course.status === filter;
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          course.instructor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          course.instructor.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">All Courses</h2>
          <p className="text-gray-600 mt-1">{courses.length} total courses</p>
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

          <select
            aria-label="Status"
            value={filter}
            // the options below are the only values the select can report
            onChange={(e) => setFilter(e.target.value as StatusFilter)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="pending_review">Pending Review</option>
            <option value="draft">Draft</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Courses Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Course
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Instructor
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Content
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Grade Weight
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCourses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center mr-4">
                        <BookOpen className="text-indigo-600" size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 max-w-xs truncate">{course.title}</div>
                        <div className="text-sm text-gray-500">{course.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{course.instructor.name}</div>
                      <div className="text-sm text-gray-500">{course.instructor.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={course.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      course.course_type === 'free'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {course.course_type === 'free' ? 'FREE' : 'PLUS'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      <p>{course.sections_count} sections</p>
                      <p>{course.lectures_count} lectures</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${
                      isFullWeight(course.total_weight) ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {course.total_weight}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(course.created_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCourses.length === 0 && (
          <div className="text-center py-12">
            <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
            <p className="text-gray-500">
              {searchQuery || filter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'No courses have been created yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoursesPage;
