import React, { useState, useEffect } from 'react';
import { ChevronRight, PlayCircle} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CourseCard from './CourseCard';
import api from '../../services/api';

const HomeView = ({ onNavigateToCheckout }) => {
  const [stats, setStats] = useState(null);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [recommendedCourses, setRecommendedCourses] = useState([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [weeklyProgress, setWeeklyProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    try {
      const [statsRes, enrolledRes, coursesRes, subscriptionRes, progressRes] = await Promise.all([
        api.get("/auth/student/stats/"),
        api.get("/courses/enrolled/"),
        api.get("/courses/all/"),
        api.get("/auth/student/subscription-status/"),
        api.get("/auth/student/weekly-progress/"),
      ]);

      setStats(statsRes.data);
      setEnrolledCourses(enrolledRes.data.slice(0, 3));
      setRecommendedCourses(coursesRes.data.slice(0, 6));
      setSubscriptionStatus(subscriptionRes.data);
      setWeeklyProgress(progressRes.data);
    } catch (error) {

      // Set fallback data on error
      setStats({
        courses_enrolled: 0,
        courses_completed: 0,
        certificates_earned: 0,
        total_learning_hours: 0,
        learning_streak: 0
      });
      setEnrolledCourses([]);
      setRecommendedCourses([]);
      setSubscriptionStatus({ has_subscription: false, can_access_plus_courses: false });
      setWeeklyProgress({ monthly_progress: [] });
    } finally {
      setLoading(false);
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
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-8 text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome back! 👋</h1>
        <p className="text-indigo-100 mb-6">Ready to continue your learning journey?</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold">{stats?.courses_enrolled || 0}</div>
            <div className="text-sm text-indigo-100">Courses Enrolled</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold">{stats?.courses_completed || 0}</div>
            <div className="text-sm text-indigo-100">Completed</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold">{stats?.certificates_earned || 0}</div>
            <div className="text-sm text-indigo-100">Certificates</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold">{Math.round(stats?.total_learning_hours || 0)}</div>
            <div className="text-sm text-indigo-100">Hours Learned</div>
          </div>
        </div>
      </div>

      {/* Continue Learning Section */}
      {enrolledCourses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Continue Learning</h2>
            <button className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm font-medium">
              View All <ChevronRight size={16} className="ml-1" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrolledCourses.map((course) => (
              <div key={course.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative">
                  <img
                    src={course.thumbnail || 'https://via.placeholder.com/400x200/4F46E5/ffffff?text=Course'}
                    alt={course.title}
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute top-4 right-4">
                    <PlayCircle className="text-white drop-shadow-lg" size={32} />
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{course.title}</h3>
                  <p className="text-sm text-gray-600 mb-4">{course.instructor}</p>

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

                  <button
                    onClick={() => window.location.href = `/courses/${course.course_id}/learn`}
                    className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Continue Learning
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Courses */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Recommended for You</h2>
          <button className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm font-medium">
            Browse All <ChevronRight size={16} className="ml-1" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendedCourses.length > 0 ? (
            recommendedCourses.map((course) => (
              <CourseCard key={course.id} course={course} onEnrollSuccess={fetchHomeData} onUpgradeClick={onNavigateToCheckout} />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">No courses available</p>
            </div>
          )}
        </div>
      </div>

      {/* Subscription Status */}
      {subscriptionStatus && !subscriptionStatus.has_subscription && (
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">Unlock Premium Content</h3>
          <p className="text-purple-100 mb-4">
            Get access to all courses, certificates, and premium features with Coursera Plus
          </p>
          <button
            onClick={onNavigateToCheckout}
            className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Upgrade to Plus
          </button>
        </div>
      )}

      {/* Learning Progress Chart */}
      {weeklyProgress?.monthly_progress && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Progress</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyProgress.monthly_progress}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hours" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;