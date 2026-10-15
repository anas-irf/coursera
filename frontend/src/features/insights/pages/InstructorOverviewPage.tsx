import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BookOpen, Users, DollarSign, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { formatMoney } from '../../../shared/lib/money';
import { formatDate } from '../../../shared/lib/time';
import CourseThumbnail from '../../../shared/ui/CourseThumbnail';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useInstructorDashboard } from '../hooks/useInsights';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899'];
const NO_RATING = '-';

/** "4.6", or "-" while no course has been rated (reviews do not exist yet, so it is 0). */
const rating = (value: number) => (value > 0 ? value.toFixed(1) : NO_RATING);

/** One of the four figures at the top of the page. */
interface Tile {
  title: string;
  value: string | number;
  note: string;
  icon: LucideIcon;
  color: string;
}

const InstructorOverviewPage = () => {
  const query = useInstructorDashboard();

  if (query.isPending) {
    return <PageSpinner />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Your dashboard could not be loaded"
        error={query.error}
        onRetry={() => query.refetch()}
      />
    );
  }

  const { stats, recent_enrollments: enrollments, revenue_chart: revenue, top_courses: topCourses } = query.data;

  // what each figure is about, said by the figure itself: no "+12% from last month" that nothing computed
  const tiles: Tile[] = [
    {
      title: 'Total Courses',
      value: stats.total_courses,
      note: `${stats.published_courses} published, ${stats.draft_courses} draft`,
      icon: BookOpen,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Total Students',
      value: stats.total_students,
      note: 'learners in your courses',
      icon: Users,
      color: 'from-green-500 to-green-600',
    },
    {
      title: 'Revenue',
      value: formatMoney(stats.total_revenue),
      note: 'your share, all time',
      icon: DollarSign,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Avg Rating',
      value: rating(stats.average_rating),
      note: stats.average_rating > 0 ? 'across your courses' : 'no reviews yet',
      icon: Star,
      color: 'from-yellow-500 to-yellow-600',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiles.map(({ title, value, note, icon: Icon, color }) => (
          <div key={title} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
                <p className="text-xs text-gray-500 mt-2">{note}</p>
              </div>
              <div className={`p-3 bg-gradient-to-br ${color} rounded-lg text-white`}>
                <Icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h2>
          <p className="text-sm text-gray-500 -mt-3 mb-4">The last 30 days</p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenue || []}>
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
                  { name: 'Published', value: stats.published_courses },
                  { name: 'Draft', value: stats.draft_courses },
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {[0, 1].map((entry) => (
                  <Cell key={entry} fill={COLORS[entry % COLORS.length]} />
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
          {enrollments.length === 0 ? (
            <EmptyState icon={Users} title="No enrollments yet" className="py-6">
              Learners who join your courses show up here.
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {enrollments.map((enrollment) => (
                <div
                  key={`${enrollment.student_email}-${enrollment.course_title}-${enrollment.enrolled_date}`}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                      <Users size={16} className="text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{enrollment.student_name}</p>
                      <p className="text-sm text-gray-500">{enrollment.course_title}</p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">{formatDate(enrollment.enrolled_date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Courses */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Courses</h2>
          {topCourses.length === 0 ? (
            <EmptyState icon={BookOpen} title="No courses yet" className="py-6">
              Create a course to see how it performs.
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {topCourses.map((course) => (
                <div key={course.id} className="flex items-center space-x-4">
                  <CourseThumbnail course={course} className="w-16 h-12 object-cover rounded-lg" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{course.title}</p>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-sm text-gray-500">{course.total_enrolled} students</span>
                      <span className="flex items-center text-sm text-yellow-600">
                        <Star size={14} className="mr-1" />
                        {rating(course.average_rating)}
                      </span>
                      <span className="text-sm font-semibold text-green-600">{formatMoney(course.total_revenue)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstructorOverviewPage;
