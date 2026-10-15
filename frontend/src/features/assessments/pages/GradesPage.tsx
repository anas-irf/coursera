import React, { useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  FileText,
  Award,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Target,
  BarChart3
} from 'lucide-react';

import { formatDate } from '../../../shared/lib/time';
import type { UUID } from '../../../shared/types';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useGradebook } from '../hooks/useAssignments';
import { filterCourses, gradeBand, gradebookStats, isGradeFilter } from '../lib/grades';
import type { GradeFilter } from '../lib/grades';

const GradesPage = () => {
  const query = useGradebook();
  const [chosenId, setChosenId] = useState<UUID | null>(null);
  const [filter, setFilter] = useState<GradeFilter>('all'); // 'all', 'passing', 'failing'

  if (query.isPending) {
    return <PageSpinner color="border-blue-600" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="We could not load your grades"
        error={query.error}
        onRetry={() => query.refetch()}
      />
    );
  }

  const gradebook = query.data;

  if (!gradebook || gradebook.courses.length === 0) {
    return (
      <EmptyState icon={GraduationCap} title="No Grades Available">
        Enroll in courses to see your grades here.
      </EmptyState>
    );
  }

  const stats = gradebookStats(gradebook.courses);
  const filteredCourses = filterCourses(gradebook.courses, filter);
  // the first course is shown until the student picks another one
  const selectedCourse =
    gradebook.courses.find((course) => course.course_id === chosenId) || gradebook.courses[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Grades</h1>
        <p className="text-gray-600 mt-1">Track your academic progress across all courses</p>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <BarChart3 size={24} className="text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Overall Average</p>
              <p className={`text-2xl font-bold ${gradeBand(stats.average).text}`}>
                {stats.average.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Passing Courses</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.passingCourses}/{stats.totalCourses}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-full">
              <BookOpen size={24} className="text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Courses</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalCourses}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full">
              <Target size={24} className="text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.successRate.toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <label htmlFor="grade-filter" className="text-sm font-medium text-gray-700">Filter:</label>
        <select
          id="grade-filter"
          value={filter}
          onChange={(e) => {
            const chosen = e.target.value;
            if (isGradeFilter(chosen)) setFilter(chosen);
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Courses</option>
          <option value="passing">Passing</option>
          <option value="failing">Needs Improvement</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Courses List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Course Grades</h2>
            </div>

            <div className="divide-y divide-gray-200">
              {filteredCourses.map((course) => {
                const band = gradeBand(course.final_grade);
                return (
                  <button
                    key={course.course_id}
                    onClick={() => setChosenId(course.course_id)}
                    aria-pressed={selectedCourse.course_id === course.course_id}
                    className={`block w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedCourse.course_id === course.course_id ? 'bg-blue-50 border-r-4 border-r-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-1">{course.course_title}</h3>
                        <p className="text-sm text-gray-600 mb-2">Instructor: {course.instructor}</p>

                        <div className="flex items-center space-x-4 text-sm">
                          <span className="flex items-center text-gray-500">
                            <Calendar size={12} className="mr-1" />
                            Enrolled: {formatDate(course.enrollment_date)}
                          </span>
                          <span className="flex items-center text-blue-600">
                            <Clock size={12} className="mr-1" />
                            {course.progress_percentage}% Complete
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${band.bg}`}>
                          <span className={band.text}>{course.letter_grade}</span>
                          <span className={`ml-2 ${band.text}`}>{course.final_grade.toFixed(1)}%</span>
                        </div>
                        <div className="mt-1 flex items-center justify-end">
                          {course.is_passing ? (
                            <span className="text-green-600 text-xs flex items-center">
                              <CheckCircle size={12} className="mr-1" />
                              Passing
                            </span>
                          ) : (
                            <span className="text-red-600 text-xs flex items-center">
                              <AlertCircle size={12} className="mr-1" />
                              Below Passing
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Course Detail */}
        <div>
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{selectedCourse.course_title}</h3>
              <p className="text-sm text-gray-600">Grade Breakdown</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Final Grade */}
              <div className={`p-4 rounded-lg border ${gradeBand(selectedCourse.final_grade).bg}`}>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${gradeBand(selectedCourse.final_grade).text}`}>
                    {selectedCourse.letter_grade}
                  </div>
                  <div className={`text-lg ${gradeBand(selectedCourse.final_grade).text}`}>
                    {selectedCourse.final_grade.toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Final Grade</p>
                </div>
              </div>

              {/* Grade Components */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Grade Components</h4>

                {selectedCourse.components && selectedCourse.components.length > 0 ? (
                  selectedCourse.components.map((component) => (
                    <div
                      key={component.type}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        {component.type === 'assignments' ? (
                          <FileText size={16} className="text-purple-600 mr-2" />
                        ) : (
                          <Award size={16} className="text-blue-600 mr-2" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 capitalize">{component.type}</p>
                          <p className="text-xs text-gray-600">
                            {component.completed}/{component.total} completed
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${gradeBand(component.score).text}`}>
                          {component.score.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">Weight: {component.weight}%</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No graded components yet</p>
                )}
              </div>

              {/* Progress */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Course Progress</span>
                  <span className="text-sm text-gray-600">{selectedCourse.progress_percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${selectedCourse.progress_percentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Status */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-center">
                  {selectedCourse.is_passing ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle size={20} className="mr-2" />
                      <span className="font-medium">Passing Grade</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-red-600">
                      <AlertCircle size={20} className="mr-2" />
                      <span className="font-medium">Below Passing Threshold</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradesPage;
