import React from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowRight, BarChart3, BookOpen, DollarSign, LineChart, PieChart as PieIcon, Star, Trophy, Users } from 'lucide-react';

import { formatMoney } from '../../../shared/lib/money';
import { formatDate } from '../../../shared/lib/time';
import Avatar from '../../../shared/ui/Avatar';
import { ButtonLink } from '../../../shared/ui/Button';
import { Card, CardBody, CardHeader } from '../../../shared/ui/Card';
import { ChartLegend, ChartTooltip, axisProps, useChartTheme } from '../../../shared/ui/charts';
import CourseThumbnail from '../../../shared/ui/CourseThumbnail';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { StatCard } from '../../../shared/ui/StatCard';
import { ChartFrame } from '../components/ChartFrame';
import { useInstructorDashboard, useInstructorEarnings } from '../hooks/useInsights';
import { compactMoney, rating } from '../lib/format';

const header = (
  <PageHeader
    title="Dashboard Overview"
    description="How your courses and learners are doing."
    actions={
      <>
        <ButtonLink to="/instructor/analytics" variant="secondary" icon={BarChart3}>Analytics</ButtonLink>
        <ButtonLink to="/instructor/courses" icon={BookOpen}>My courses</ButtonLink>
      </>
    }
  />
);

const InstructorOverviewPage = () => {
  const query = useInstructorDashboard();
  // earnings are calculated per month: the trend is drawn by month, not by day
  const earnings = useInstructorEarnings();
  const chart = useChartTheme();

  if (query.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <PageSpinner className="h-72" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <ErrorState
            title="Your dashboard could not be loaded"
            error={query.error}
            onRetry={() => query.refetch()}
          />
        </Card>
      </div>
    );
  }

  const { stats, recent_enrollments: enrollments, top_courses: topCourses } = query.data;
  const months = earnings.data ? earnings.data.monthly_chart : [];
  const hasEarnings = months.some((point) => point.earnings > 0);
  const periodTotal = months.reduce((total, point) => total + (Number(point.earnings) || 0), 0);

  // courses that are neither published nor drafts: in review, rejected or taken offline
  const other = Math.max(0, stats.total_courses - stats.published_courses - stats.draft_courses);
  const statuses = [
    { name: 'Published', value: stats.published_courses, color: chart.success },
    { name: 'Draft', value: stats.draft_courses, color: chart.axis },
    { name: 'In review or offline', value: other, color: chart.warning },
  ].filter((slice) => slice.value > 0);

  return (
    <div className="space-y-6">
      {header}

      {/* what each figure is about, said by the figure itself: no "+12% from last month" that nothing computed */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Courses"
          value={stats.total_courses}
          hint={`${stats.published_courses} published, ${stats.draft_courses} draft`}
          icon={BookOpen}
        />
        <StatCard
          label="Total Students"
          value={stats.total_students}
          hint="learners in your courses"
          icon={Users}
          tone="info"
        />
        <StatCard
          label="Revenue"
          value={formatMoney(stats.total_revenue)}
          hint="your share, all time"
          icon={DollarSign}
          tone="success"
        />
        <StatCard
          label="Avg Rating"
          value={rating(stats.average_rating)}
          hint={stats.average_rating > 0 ? 'across your courses' : 'no reviews yet'}
          icon={Star}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Earnings by month"
            description={hasEarnings ? `The last six months: ${formatMoney(periodTotal)}` : 'The last six months'}
            icon={LineChart}
            plain
            action={
              <ButtonLink to="/instructor/earnings" variant="ghost" size="sm" iconRight={ArrowRight}>
                Earnings
              </ButtonLink>
            }
          />
          <CardBody>
            {earnings.isPending && <PageSpinner className="h-64" />}
            {earnings.isError && (
              <ErrorState
                className="py-10"
                title="Your earnings could not be loaded"
                error={earnings.error}
                onRetry={() => earnings.refetch()}
              />
            )}
            {earnings.isSuccess && hasEarnings && (
              <ChartFrame label="Earnings of the last six months" height={260}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={months} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="month" {...axisProps(chart)} />
                    <YAxis {...axisProps(chart)} tickFormatter={compactMoney} width={56} />
                    <Tooltip cursor={{ fill: chart.grid, opacity: 0.4 }} content={<ChartTooltip format={formatMoney} />} />
                    <Bar dataKey="earnings" name="Earnings" fill={chart.primary} radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            )}
            {earnings.isSuccess && !hasEarnings && (
              <EmptyState icon={LineChart} title="No earnings yet" className="py-10">
                Plus courses earn a share of the monthly membership revenue once the month is calculated.
              </EmptyState>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Course Status" description="Where your courses are in publishing" icon={PieIcon} plain />
          <CardBody>
            {statuses.length > 0 ? (
              <>
                <div className="relative">
                  <ChartFrame label="Courses by status" height={200}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statuses}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={84}
                          paddingAngle={3}
                          stroke="none"
                        >
                          {statuses.map((slice) => (
                            <Cell key={slice.name} fill={slice.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartFrame>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold text-fg tabular-nums">{stats.total_courses}</span>
                    <span className="text-xs text-fg-subtle">courses</span>
                  </div>
                </div>
                <ChartLegend
                  className="mt-4 justify-center"
                  items={statuses.map((slice) => ({ label: slice.name, color: slice.color, value: slice.value }))}
                />
              </>
            ) : (
              <EmptyState icon={BookOpen} title="No courses yet" className="py-10">
                Create a course to see it here.
              </EmptyState>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent Enrollments"
            description="The newest learners of your courses"
            icon={Users}
            action={
              <ButtonLink to="/instructor/students" variant="ghost" size="sm" iconRight={ArrowRight}>
                All students
              </ButtonLink>
            }
          />
          {enrollments.length === 0 ? (
            <EmptyState icon={Users} title="No enrollments yet" className="py-10">
              Learners who join your courses show up here.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {enrollments.map((enrollment) => (
                <li
                  key={`${enrollment.student_email}-${enrollment.course_title}-${enrollment.enrolled_date}`}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <Avatar name={enrollment.student_name} className="h-9 w-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{enrollment.student_name}</p>
                    <p className="truncate text-xs text-fg-subtle">{enrollment.course_title}</p>
                  </div>
                  <span className="shrink-0 text-xs text-fg-subtle">{formatDate(enrollment.enrolled_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Top Performing Courses"
            description="By revenue, then by learners"
            icon={Trophy}
            action={
              <ButtonLink to="/instructor/courses" variant="ghost" size="sm" iconRight={ArrowRight}>
                All courses
              </ButtonLink>
            }
          />
          {topCourses.length === 0 ? (
            <EmptyState icon={BookOpen} title="No courses yet" className="py-10">
              Create a course to see how it performs.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {topCourses.map((course, index) => (
                <li key={course.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-4 shrink-0 text-center text-sm font-semibold text-fg-subtle tabular-nums">{index + 1}</span>
                  <CourseThumbnail course={course} className="h-11 w-16 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/instructor/courses"
                      className="block truncate text-sm font-medium text-fg hover:text-primary-fg"
                    >
                      {course.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-subtle">
                      <span>{course.total_enrolled} students</span>
                      <span className="inline-flex items-center gap-1">
                        <Star size={12} aria-hidden="true" className="text-warning-fg" />
                        {rating(course.average_rating)}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-success-fg tabular-nums">
                    {formatMoney(course.total_revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

export default InstructorOverviewPage;
