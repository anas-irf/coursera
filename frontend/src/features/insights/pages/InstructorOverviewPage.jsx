import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BookOpen, Users, DollarSign, TrendingUp, Star, Calendar, Download } from 'lucide-react';

import { mediaUrl } from '../../../shared/lib/media';
import { PageSpinner } from '../../../shared/ui/Spinner';
import * as insightsApi from '../api';

const EMPTY_DASHBOARD = {
  stats: {
    total_courses: 0,
    total_students: 0,
    total_revenue: 0,
    average_rating: 0,
    published_courses: 0,
    draft_courses: 0,
  },
  recent_enrollments: [],
  revenue_chart: [],
  top_courses: [],
};

const InstructorOverviewPage = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    insightsApi
      .fetchInstructorDashboard()
      .then((data) => !cancelled && setDashboardData(data))
      .catch(() => !cancelled && setDashboardData(EMPTY_DASHBOARD))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <PageSpinner />;
  }

  const stats = [
    { title: 'Total Courses', value: dashboardData?.stats?.total_courses || 0, icon: BookOpen, color: 'from-blue-500 to-blue-600', change: '+12%' },
    { title: 'Total Students', value: dashboardData?.stats?.total_students || 0, icon: Users, color: 'from-green-500 to-green-600', change: '+23%' },
    { title: 'Revenue', value: `$${(dashboardData?.stats?.total_revenue || 0).toLocaleString()}`, icon: DollarSign, color: 'from-purple-500 to-purple-600', change: '+18%' },
    { title: 'Avg Rating', value: ((dashboardData?.stats?.average_rating || 0)).toFixed(1), icon: Star, color: 'from-yellow-500 to-yellow-600', change: '+0.2' },
  ];

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Calendar className="inline-block w-4 h-4 mr-2" />
            Last 30 Days
          </button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
            <Download className="inline-block w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  <p className="text-xs text-green-600 mt-2 flex items-center">
                    <TrendingUp size={12} className="mr-1" />
                    {stat.change} from last month
                  </p>
                </div>
                <div className={`p-3 bg-gradient-to-br ${stat.color} rounded-lg text-white`}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dashboardData?.revenue_chart || []}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke="#4F46E5" fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Course Distribution */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Course Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Published', value: dashboardData?.stats?.published_courses || 0 },
                  { name: 'Draft', value: dashboardData?.stats?.draft_courses || 0 },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {[0, 1].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Enrollments */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Enrollments</h2>
          <div className="space-y-4">
            {(dashboardData?.recent_enrollments || []).map((enrollment, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b last:border-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                    <Users size={16} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{enrollment.student_name}</p>
                    <p className="text-sm text-gray-500">{enrollment.course_title}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(enrollment.enrolled_date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Courses */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Courses</h2>
          <div className="space-y-4">
            {(dashboardData?.top_courses || []).map((course, index) => (
              <div key={index} className="flex items-center space-x-4">
                <img
                  src={mediaUrl(course.thumbnail) || 'https://via.placeholder.com/300x200/4F46E5/ffffff?text=Course'}
                  alt={course.title || 'Course'}
                  className="w-16 h-12 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{course.title}</p>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-sm text-gray-500">{course.total_enrolled} students</span>
                    <span className="flex items-center text-sm text-yellow-600">
                      <Star size={14} className="mr-1" />
                      {course.average_rating}
                    </span>
                    <span className="text-sm font-semibold text-green-600">${course.total_revenue}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstructorOverviewPage;