import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Search } from 'lucide-react';

import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import EnrolledCourseCard from '../components/EnrolledCourseCard';
import { useMyCourses } from '../hooks/useLearning';
import type { EnrolledCourse, EnrolledView } from '../types';

const isCompleted = (course: EnrolledCourse) => course.status === 'completed';

// the value of a select is a string: only the three options are filters
const isFilter = (value: string): value is EnrolledView =>
  value === 'active' || value === 'completed' || value === 'all';

const MyLearningPage = () => {
  const navigate = useNavigate();
  // every course of the student comes in one list; the select below only narrows it
  const courses = useMyCourses({ status: 'all' });
  const [filter, setFilter] = useState<EnrolledView>('active'); // active (in progress), completed, all
  const [searchTerm, setSearchTerm] = useState('');

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

  const enrolledCourses = courses.data;
  const term = searchTerm.toLowerCase();
  const filteredCourses = enrolledCourses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(term) ||
                         course.instructor.toLowerCase().includes(term);

    if (filter === 'active') return matchesSearch && !isCompleted(course);
    if (filter === 'completed') return matchesSearch && isCompleted(course);
    return matchesSearch;
  });

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
            aria-label="Search your courses"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2">
          <select
            aria-label="Show"
            value={filter}
            onChange={(e) => {
              if (isFilter(e.target.value)) setFilter(e.target.value);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="active">In Progress</option>
            <option value="completed">Completed</option>
            <option value="all">All Courses</option>
          </select>
        </div>
      </div>

      {/* Course Grid */}
      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <EnrolledCourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : enrolledCourses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No enrolled courses"
          action={
            <button
              onClick={() => navigate('/student/explore')}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Browse Courses
            </button>
          }
        >
          Start your learning journey by enrolling in a course!
        </EmptyState>
      ) : (
        <EmptyState icon={Search} title="No courses found">
          Try adjusting your search or filter criteria.
        </EmptyState>
      )}
    </div>
  );
};

export default MyLearningPage;
