import React, { useState, useEffect } from 'react';
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
import { PageSpinner } from '../../../shared/ui/Spinner';
import * as assessmentsApi from '../api';

const GradesPage = () => {
  const [gradebook, setGradebook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'passing', 'failing'

  useEffect(() => {
    fetchGradebook();
  }, []);

  const fetchGradebook = async () => {
    setLoading(true);
    try {
      const data = await assessmentsApi.fetchStudentGradebook();
      setGradebook(data);
      if (data.courses.length > 0) {
        setSelectedCourse(data.courses[0]);
      }
    } catch (error) {
      setGradebook(null);
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade) => {
    if (grade >= 90) return 'text-green-600';
    if (grade >= 80) return 'text-blue-600';
    if (grade >= 70) return 'text-yellow-600';
    if (grade >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getGradeBgColor = (grade) => {
    if (grade >= 90) return 'bg-green-50 border-green-200';
    if (grade >= 80) return 'bg-blue-50 border-blue-200';
    if (grade >= 70) return 'bg-yellow-50 border-yellow-200';
    if (grade >= 60) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredCourses = gradebook?.courses.filter(course => {
    if (filter === 'passing') return course.is_passing;
    if (filter === 'failing') return !course.is_passing;
    return true;
  }) || [];

  const overallStats = gradebook?.courses.reduce((acc, course) => {
    acc.totalGrade += course.final_grade;
    acc.totalCourses += 1;
    if (course.is_passing) acc.passingCourses += 1;
    return acc;
  }, { totalGrade: 0, totalCourses: 0, passingCourses: 0 }) || { totalGrade: 0, totalCourses: 0, passingCourses: 0 };

  if (loading) {
    return <PageSpinner color="border-blue-600" />;
  }

  if (!gradebook || gradebook.courses.length === 0) {
    return (
      <div className="text-center py-12">
        <GraduationCap size={64} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Grades Available</h3>
        <p className="text-gray-500">Enroll in courses to see your grades here.</p>
      </div>
    );
  }

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
              <p className={`text-2xl font-bold ${getGradeColor(overallStats.totalCourses > 0 ? overallStats.totalGrade / overallStats.totalCourses : 0)}`}>
                {overallStats.totalCourses > 0 ? (overallStats.totalGrade / overallStats.totalCourses).toFixed(1) : 0}%
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
                {overallStats.passingCourses}/{overallStats.totalCourses}
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
              <p className="text-2xl font-bold text-purple-600">{overallStats.totalCourses}</p>
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
              <p className="text-2xl font-bold text-yellow-600">
                {overallStats.totalCourses > 0 ? ((overallStats.passingCourses / overallStats.totalCourses) * 100).toFixed(0) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
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
              {filteredCourses.map((course) => (
                <div
                  key={course.course_id}
                  onClick={() => setSelectedCourse(course)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedCourse?.course_id === course.course_id ? 'bg-blue-50 border-r-4 border-r-blue-500' : ''
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
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getGradeBgColor(course.final_grade)}`}>
                        <span className={getGradeColor(course.final_grade)}>
                          {course.letter_grade}
                        </span>
                        <span className={`ml-2 ${getGradeColor(course.final_grade)}`}>
                          {course.final_grade.toFixed(1)}%
                        </span>
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
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Course Detail */}
        <div>
          {selectedCourse ? (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{selectedCourse.course_title}</h3>
                <p className="text-sm text-gray-600">Grade Breakdown</p>
              </div>

              <div className="p-4 space-y-4">
                {/* Final Grade */}
                <div className={`p-4 rounded-lg border ${getGradeBgColor(selectedCourse.final_grade)}`}>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getGradeColor(selectedCourse.final_grade)}`}>
                      {selectedCourse.letter_grade}
                    </div>
                    <div className={`text-lg ${getGradeColor(selectedCourse.final_grade)}`}>
                      {selectedCourse.final_grade.toFixed(1)}%
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Final Grade</p>
                  </div>
                </div>

                {/* Grade Components */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Grade Components</h4>

                  {selectedCourse.components && selectedCourse.components.length > 0 ? (
                    selectedCourse.components.map((component, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          {component.type === 'assignments' ? (
                            <FileText size={16} className="text-purple-600 mr-2" />
                          ) : (
                            <Award size={16} className="text-blue-600 mr-2" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900 capitalize">
                              {component.type}
                            </p>
                            <p className="text-xs text-gray-600">
                              {component.completed}/{component.total} completed
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${getGradeColor(component.score)}`}>
                            {component.score.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-500">
                            Weight: {component.weight}%
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No graded components yet
                    </p>
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
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <GraduationCap size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Course</h3>
              <p className="text-gray-500">Choose a course from the list to view detailed grade breakdown.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GradesPage;