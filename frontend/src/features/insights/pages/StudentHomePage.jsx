import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useSubscription } from '../../billing';
import {
  CourseCard,
  EnrolledCourseCard,
  useMyCourses,
  useRecommendedCourses,
} from '../../learning';
import { useStudentStats, useWeeklyProgress } from '../hooks/useInsights';

const CONTINUE_COUNT = 3;
const NOT_LOADED = '–';

/** Hours with one decimal ("0.3", "12.5", "5"): twenty minutes of study must not read as zero. */
const hours = (value) => Number((value || 0).toFixed(1));

const Figure = ({ label, value }) => (
  <div role="group" aria-label={label} className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-sm text-indigo-100">{label}</div>
  </div>
);

const StudentHomePage = () => {
  const navigate = useNavigate();
  const stats = useStudentStats();
  const enrolled = useMyCourses({ status: 'active' });
  const recommended = useRecommendedCourses();
  const subscription = useSubscription();
  const weeklyProgress = useWeeklyProgress();

  // a figure that could not be loaded is shown as such, never as a zero
  const figure = (read) => (stats.isSuccess ? read(stats.data) : NOT_LOADED);
  const showUpgrade = !subscription.loading && !subscription.error && !subscription.isPlus;
  const monthly = weeklyProgress.data ? weeklyProgress.data.monthly_progress || [] : [];
  const hasLearningTime = monthly.some((month) => month.hours > 0);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-8 text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome back! 👋</h1>
        <p className="text-indigo-100 mb-6">Ready to continue your learning journey?</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Figure label="Courses Enrolled" value={figure((data) => data.courses_enrolled || 0)} />
          <Figure label="Completed" value={figure((data) => data.courses_completed || 0)} />
          <Figure label="Certificates" value={figure((data) => data.certificates_earned || 0)} />
          <Figure label="Hours Learned" value={figure((data) => hours(data.total_learning_hours))} />
        </div>

        {stats.isError && (
          <p role="alert" className="mt-4 text-sm text-indigo-100">
            Your figures could not be loaded.{' '}
            <button onClick={() => stats.refetch()} className="underline font-medium">Try again</button>
          </p>
        )}
      </div>

      {/* Continue Learning Section */}
      {enrolled.isPending && <PageSpinner className="h-40" />}
      {enrolled.isError && (
        <ErrorState
          title="We could not load your courses"
          error={enrolled.error}
          onRetry={() => enrolled.refetch()}
        />
      )}
      {enrolled.isSuccess && enrolled.data.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Continue Learning</h2>
            <button
              onClick={() => navigate('/student/my-learning')}
              className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm font-medium"
            >
              View All <ChevronRight size={16} className="ml-1" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrolled.data.slice(0, CONTINUE_COUNT).map((course) => (
              <EnrolledCourseCard key={course.id} course={course} compact />
            ))}
          </div>
        </div>
      )}

      {/* Recommended Courses */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Recommended for You</h2>
          <button
            onClick={() => navigate('/student/explore')}
            className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm font-medium"
          >
            Browse All <ChevronRight size={16} className="ml-1" />
          </button>
        </div>

        {recommended.isPending && <PageSpinner className="h-40" />}
        {recommended.isError && (
          <ErrorState
            title="We could not load the courses"
            error={recommended.error}
            onRetry={() => recommended.refetch()}
          />
        )}
        {recommended.isSuccess && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommended.data.length > 0 ? (
              recommended.data.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">No courses available</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subscription Status */}
      {showUpgrade && (
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">Unlock Premium Content</h3>
          <p className="text-purple-100 mb-4">
            Get access to all courses, certificates, and premium features with Coursera Plus
          </p>
          <button
            onClick={() => navigate('/student/checkout')}
            className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Upgrade to Plus
          </button>
        </div>
      )}

      {/* Learning Progress Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Progress</h3>
        {weeklyProgress.isPending && <PageSpinner className="h-40" />}
        {weeklyProgress.isError && (
          <ErrorState
            className="py-6"
            title="We could not load your progress"
            error={weeklyProgress.error}
            onRetry={() => weeklyProgress.refetch()}
          />
        )}
        {weeklyProgress.isSuccess && !hasLearningTime && (
          <EmptyState icon={BarChart2} title="No learning time yet" className="py-6">
            The hours you spend watching lectures will show up here.
          </EmptyState>
        )}
        {weeklyProgress.isSuccess && hasLearningTime && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hours" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentHomePage;
