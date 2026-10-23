import React, { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, ArrowRight, BookOpen, CheckCircle2, GraduationCap, TrendingUp, Users } from 'lucide-react';

import { courseStatus } from '../../../shared/lib/courseStatus';
import { formatMoney } from '../../../shared/lib/money';
import { formatDate, timeAgo } from '../../../shared/lib/time';
import type { CourseStatus, UserType } from '../../../shared/types';
import Avatar from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { ButtonLink } from '../../../shared/ui/Button';
import { Card, CardBody, CardHeader } from '../../../shared/ui/Card';
import { ChartTooltip, axisProps, useChartTheme } from '../../../shared/ui/charts';
import type { ChartTheme } from '../../../shared/ui/charts';
import { EmptyState } from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { StatCard } from '../../../shared/ui/StatCard';
import { useAdminCourses, useAdminUsers, usePendingCourses, useRevenue } from '../hooks/useAdmin';

const ROLE_LABEL: Record<UserType, string> = { student: 'Students', instructor: 'Instructors', admin: 'Admins' };
const ROLE_TONE = { student: 'primary', instructor: 'success', admin: 'plus' } as const;

const STATUS_ORDER: CourseStatus[] = ['published', 'pending_review', 'draft', 'unpublished', 'rejected'];

const statusColor = (chart: ChartTheme, status: string): string => {
  switch (status) {
    case 'published': return chart.success;
    case 'pending_review': return chart.series[0];
    case 'draft': return chart.axis;
    case 'unpublished': return chart.warning;
    case 'rejected': return chart.danger;
    default: return chart.grid;
  }
};

/** A slice of one of the donuts. */
interface Slice {
  name: string;
  value: number;
  color: string;
}

interface DonutProps {
  title: string;
  description: string;
  slices: Slice[];
  total: number;
  unit: string;
}

const Donut = ({ title, description, slices, total, unit }: DonutProps) => (
  <Card>
    <CardHeader title={title} description={description} plain />
    <CardBody className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={2} stroke="none">
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-fg tabular-nums">{total}</span>
          <span className="text-xs text-fg-subtle">{unit}</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: slice.color }} aria-hidden="true" />
            <span className="flex-1 text-fg-muted">{slice.name}</span>
            <span className="font-semibold text-fg tabular-nums">{slice.value}</span>
            <span className="w-10 text-right text-xs text-fg-subtle tabular-nums">
              {total ? Math.round((slice.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </CardBody>
  </Card>
);

/** Revenue of the last months, in small: the full picture is on the revenue page. */
const RevenueSnapshot = () => {
  const revenue = useRevenue(6);
  const chart = useChartTheme();

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Revenue"
        description="Coursera Plus over the last six months"
        icon={TrendingUp}
        action={<ButtonLink to="/admin/revenue" variant="ghost" size="sm" iconRight={ArrowRight}>Details</ButtonLink>}
      />
      {revenue.isPending && <PageSpinner className="h-64" />}
      {revenue.isError && (
        <ErrorState className="py-10" title="Revenue could not be loaded" error={revenue.error} onRetry={() => revenue.refetch()} />
      )}
      {revenue.isSuccess && (
        <CardBody>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-fg-subtle">Gross revenue</p>
              <p className="mt-0.5 text-lg font-semibold text-fg tabular-nums">{formatMoney(revenue.data.summary.gross_revenue)}</p>
            </div>
            <div>
              <p className="text-xs text-fg-subtle">Platform share</p>
              <p className="mt-0.5 text-lg font-semibold text-fg tabular-nums">{formatMoney(revenue.data.summary.platform_share)}</p>
            </div>
            <div>
              <p className="text-xs text-fg-subtle">Plus members</p>
              <p className="mt-0.5 text-lg font-semibold text-fg tabular-nums">{revenue.data.summary.members}</p>
            </div>
          </div>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue.data.monthly} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="overview-revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart.primary} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={chart.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axisProps(chart)} />
                <YAxis {...axisProps(chart)} width={56} tickFormatter={(value: number) => `$${Math.round(value)}`} />
                <Tooltip content={<ChartTooltip format={formatMoney} />} />
                <Area type="monotone" dataKey="gross" name="Gross revenue" stroke={chart.primary} strokeWidth={2} fill="url(#overview-revenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      )}
    </Card>
  );
};

/** What the administrator has to know right now, computed from the real lists. */
const OverviewPage = () => {
  const usersQuery = useAdminUsers();
  const coursesQuery = useAdminCourses();
  const pendingQuery = usePendingCourses();
  const chart = useChartTheme();
  const users = usersQuery.data;
  const courses = coursesQuery.data;

  const summary = useMemo(() => {
    if (!users || !courses) return null;
    const byRole = (role: UserType) => users.filter((user) => user.user_type === role).length;
    const byStatus = (status: CourseStatus) => courses.filter((course) => course.status === status).length;
    return {
      totalUsers: users.length,
      students: byRole('student'),
      instructors: byRole('instructor'),
      admins: byRole('admin'),
      totalCourses: courses.length,
      published: byStatus('published'),
      pending: byStatus('pending_review'),
      // only a student row carries the figure
      enrollments: users.reduce(
        (total, user) => total + (user.user_type === 'student' ? user.courses_enrolled || 0 : 0),
        0
      ),
      newest: [...users].sort((a, b) => b.join_date.localeCompare(a.join_date)).slice(0, 5),
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
  if (!summary || !courses) {
    return <PageSpinner />;
  }

  const roleSlices: Slice[] = (['student', 'instructor', 'admin'] as UserType[]).map((role, index) => ({
    name: ROLE_LABEL[role],
    value: role === 'student' ? summary.students : role === 'instructor' ? summary.instructors : summary.admins,
    color: [chart.series[0], chart.series[1], chart.series[3]][index],
  }));
  const statusSlices: Slice[] = STATUS_ORDER.map((status) => ({
    name: courseStatus(status).label,
    value: courses.filter((course) => course.status === status).length,
    color: statusColor(chart, status),
  })).filter((slice) => slice.value > 0);

  const waiting = pendingQuery.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Who is on the platform, what is published and what needs a decision."
        actions={
          summary.pending > 0 && (
            <ButtonLink to="/admin/courses/approvals" icon={AlertCircle}>
              Review {summary.pending} course{summary.pending === 1 ? '' : 's'}
            </ButtonLink>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Users"
          value={summary.totalUsers.toLocaleString()}
          hint={`${summary.students} students · ${summary.instructors} instructors`}
          icon={Users}
        />
        <StatCard
          label="Total Courses"
          value={summary.totalCourses.toLocaleString()}
          hint={`${summary.published} published`}
          icon={BookOpen}
          tone="success"
        />
        <StatCard
          label="Enrollments"
          value={summary.enrollments.toLocaleString()}
          hint="across all students"
          icon={GraduationCap}
          tone="plus"
        />
        <StatCard
          label="Pending Approvals"
          value={summary.pending.toLocaleString()}
          hint={summary.pending > 0 ? 'requires attention' : 'nothing is waiting'}
          icon={AlertCircle}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <RevenueSnapshot />

        <Card>
          <CardHeader
            title="Waiting for review"
            description="Courses submitted by instructors"
            action={<ButtonLink to="/admin/courses/approvals" variant="ghost" size="sm" iconRight={ArrowRight}>Queue</ButtonLink>}
          />
          {pendingQuery.isPending && <PageSpinner className="h-40" />}
          {pendingQuery.isError && (
            <ErrorState className="py-8" title="The queue could not be loaded" error={pendingQuery.error} onRetry={() => pendingQuery.refetch()} />
          )}
          {pendingQuery.isSuccess && waiting.length === 0 && (
            <EmptyState icon={CheckCircle2} title="Nothing is waiting" className="py-10">
              Every submitted course has been reviewed.
            </EmptyState>
          )}
          {pendingQuery.isSuccess && waiting.length > 0 && (
            <ul className="divide-y divide-line">
              {waiting.slice(0, 4).map((course) => (
                <li key={course.id} className="px-5 py-3.5">
                  <p className="truncate text-sm font-medium text-fg">{course.title}</p>
                  <p className="mt-0.5 text-xs text-fg-subtle">
                    {course.instructor?.name || course.instructor?.email} · submitted {formatDate(course.submitted_date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Donut
          title="Courses by status"
          description="Where every course is in the publishing workflow"
          slices={statusSlices}
          total={summary.totalCourses}
          unit="courses"
        />
        <Donut
          title="Users by role"
          description="Accounts on the platform"
          slices={roleSlices}
          total={summary.totalUsers}
          unit="users"
        />
      </div>

      <Card>
        <CardHeader
          title="Newest accounts"
          description="The five most recent sign-ups"
          action={<ButtonLink to="/admin/users" variant="ghost" size="sm" iconRight={ArrowRight}>All users</ButtonLink>}
        />
        <ul className="divide-y divide-line">
          {summary.newest.map((user) => (
            <li key={user.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={user.name} className="h-9 w-9 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{user.name}</p>
                <p className="truncate text-xs text-fg-subtle">{user.email}</p>
              </div>
              <Badge tone={ROLE_TONE[user.user_type]} className="capitalize">
                {user.user_type}
              </Badge>
              <span className="hidden w-24 text-right text-xs text-fg-subtle sm:block">{timeAgo(user.join_date)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

export default OverviewPage;
