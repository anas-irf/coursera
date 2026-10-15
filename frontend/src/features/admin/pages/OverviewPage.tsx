import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertCircle, BookCheck, BookOpen, CheckCircle, Clock, GraduationCap, Users } from 'lucide-react';

import { courseStatus } from '../../../shared/lib/courseStatus';
import type { CourseStatus, UserType } from '../../../shared/types';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useAdminCourses, useAdminUsers } from '../hooks/useAdmin';

const COURSE_STATUS_COLORS: Record<CourseStatus, string> = {
  published: '#10B981',
  draft: '#6B7280',
  pending_review: '#F59E0B',
  rejected: '#EF4444',
  unpublished: '#3B82F6',
};

const ROLE_COLORS: Record<UserType, string> = { student: '#4F46E5', instructor: '#10B981', admin: '#8B5CF6' };

const FALLBACK_COLOR = '#9CA3AF';

// the keys come from the data (whatever the server sent), so the lookup is by plain string
const colorOf = (colors: Partial<Record<string, string>>, key: string): string => colors[key] || FALLBACK_COLOR;

const count = <K extends string, Row extends Record<K, string>>(rows: Row[], key: K): Record<string, number> =>
  rows.reduce<Record<string, number>>(
    (totals, row) => ({ ...totals, [row[key]]: (totals[row[key]] || 0) + 1 }),
    {}
  );

/** A slice of one of the pie charts. */
interface Slice {
  name: string;
  value: number;
  color: string;
}

interface Summary {
  totalUsers: number;
  students: number;
  instructors: number;
  totalCourses: number;
  published: number;
  pending: number;
  enrollments: number;
  roles: Slice[];
  statuses: Slice[];
}

/** What the administrator has to know right now, computed from the real lists. */
const OverviewPage = () => {
  const usersQuery = useAdminUsers();
  const coursesQuery = useAdminCourses();
  const users = usersQuery.data;
  const courses = coursesQuery.data;

  const summary = useMemo<Summary | null>(() => {
    if (!users || !courses) return null;
    const byRole = count(users, 'user_type');
    const byStatus = count(courses, 'status');
    return {
      totalUsers: users.length,
      students: byRole.student || 0,
      instructors: byRole.instructor || 0,
      totalCourses: courses.length,
      published: byStatus.published || 0,
      pending: byStatus.pending_review || 0,
      // only a student row carries the figure
      enrollments: users.reduce(
        (total, user) => total + (user.user_type === 'student' ? user.courses_enrolled || 0 : 0),
        0
      ),
      roles: Object.entries(byRole).map(([role, value]) => ({
        name: role,
        value,
        color: colorOf(ROLE_COLORS, role),
      })),
      statuses: Object.entries(byStatus).map(([status, value]) => ({
        name: courseStatus(status).label,
        value,
        color: colorOf(COURSE_STATUS_COLORS, status),
      })),
    };
  }, [users, courses]);

  if (usersQuery.isPending || coursesQuery.isPending) {
    return <PageSpinner />;
  }

  if (usersQuery.isError || coursesQuery.isError) {
    return (
      <ErrorState
        title="The overview could not be loaded"
        error={usersQuery.error || coursesQuery.error}
        onRetry={() => {
          usersQuery.refetch();
          coursesQuery.refetch();
        }}
      />
    );
  }

  // both lists are loaded here, so the summary exists: this only narrows its type
  if (!summary) {
    return <PageSpinner />;
  }

  const tiles = [
    { label: 'Total Users', value: summary.totalUsers, note: `${summary.students} students · ${summary.instructors} instructors`, icon: Users, tint: 'bg-blue-50 text-blue-600' },
    { label: 'Total Courses', value: summary.totalCourses, note: `${summary.published} published`, icon: BookOpen, tint: 'bg-green-50 text-green-600' },
    { label: 'Enrollments', value: summary.enrollments, note: 'across all students', icon: GraduationCap, tint: 'bg-purple-50 text-purple-600' },
    { label: 'Pending Approvals', value: summary.pending, note: 'requires attention', icon: AlertCircle, tint: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiles.map(({ label, value, note, icon: Icon, tint }) => (
          <div key={label} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{label}</p>
                <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-2">{note}</p>
              </div>
              <div className={`p-3 rounded-lg ${tint}`}>
                <Icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Courses by status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={summary.statuses} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={4}>
                {summary.statuses.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Users by role</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={summary.roles} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={4}>
                {summary.roles.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/admin/courses/approvals"
          className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-xl border border-amber-100 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center mb-3">
            <BookCheck className="text-amber-600 mr-3" size={24} />
            <h3 className="text-lg font-semibold text-gray-900">Course approvals</h3>
          </div>
          <p className="text-gray-600 flex items-center">
            {summary.pending > 0 ? (
              <>
                <Clock size={16} className="mr-2 text-amber-600" />
                {summary.pending} course{summary.pending === 1 ? '' : 's'} waiting for review
              </>
            ) : (
              <>
                <CheckCircle size={16} className="mr-2 text-green-600" />
                Nothing is waiting
              </>
            )}
          </p>
        </Link>

        <Link
          to="/admin/users"
          className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center mb-3">
            <Users className="text-blue-600 mr-3" size={24} />
            <h3 className="text-lg font-semibold text-gray-900">User management</h3>
          </div>
          <p className="text-gray-600">{summary.totalUsers} registered users</p>
        </Link>

        <Link
          to="/admin/courses"
          className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-100 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center mb-3">
            <BookOpen className="text-green-600 mr-3" size={24} />
            <h3 className="text-lg font-semibold text-gray-900">All courses</h3>
          </div>
          <p className="text-gray-600">{summary.totalCourses} courses on the platform</p>
        </Link>
      </div>
    </div>
  );
};

export default OverviewPage;
