import React, { useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  BarChart3, BookOpen, CheckCircle2, ClipboardCheck, DollarSign, Gauge, GraduationCap, Plus, Star, Table2, Target,
  TrendingUp, Users,
} from 'lucide-react';

import { cn } from '../../../shared/lib/cn';
import { formatMoney } from '../../../shared/lib/money';
import { ButtonLink } from '../../../shared/ui/Button';
import { Card, CardBody, CardHeader } from '../../../shared/ui/Card';
import { ChartLegend, ChartTooltip, axisProps, useChartTheme } from '../../../shared/ui/charts';
import CourseThumbnail from '../../../shared/ui/CourseThumbnail';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl';
import type { SegmentOption } from '../../../shared/ui/SegmentedControl';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { StatCard } from '../../../shared/ui/StatCard';
import StatusBadge from '../../../shared/ui/StatusBadge';
import { Table, TBody, TD, TH, THead, TR } from '../../../shared/ui/Table';
import { ChartFrame, useGradientId } from '../components/ChartFrame';
import { useInstructorAnalytics } from '../hooks/useInsights';
import { NOT_LOADED, compactMoney, percent, rating, shareOf } from '../lib/format';
import type { AnalyticsMonths, InstructorAnalytics, ProgressBucketKey } from '../types';

type Period = '3' | '6' | '12';

const PERIODS: SegmentOption<Period>[] = [
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
];

const MONTHS: Record<Period, AnalyticsMonths> = { '3': 3, '6': 6, '12': 12 };

const BUCKET_TONES: Record<ProgressBucketKey, 'warning' | 'primary' | 'plus' | 'success'> = {
  not_started: 'warning',
  under_half: 'primary',
  over_half: 'plus',
  completed: 'success',
};

interface ChartsProps {
  data: InstructorAnalytics;
}

/** New enrollments and completions per month, and the earnings of the same months. */
const MonthlyCharts = ({ data }: ChartsProps) => {
  const chart = useChartTheme();
  const gradient = useGradientId('analytics-earnings');
  const hasActivity = data.monthly.some((month) => month.enrollments > 0 || month.completions > 0);
  const hasEarnings = data.monthly.some((month) => month.earnings > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Enrollments and completions" description="Per month" icon={BarChart3} plain />
        <CardBody>
          {hasActivity ? (
            <>
              <ChartFrame label="New enrollments and completions per month" height={240}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="label" {...axisProps(chart)} />
                    <YAxis {...axisProps(chart)} allowDecimals={false} />
                    <Tooltip cursor={{ fill: chart.grid, opacity: 0.5 }} content={<ChartTooltip />} />
                    <Bar dataKey="enrollments" name="Enrollments" fill={chart.series[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="completions" name="Completions" fill={chart.series[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
              <ChartLegend
                className="mt-3"
                items={[
                  { label: 'Enrollments', color: chart.series[0] },
                  { label: 'Completions', color: chart.series[1] },
                ]}
              />
            </>
          ) : (
            <EmptyState icon={Users} title="No enrollments in this period" className="py-10">
              New learners and finished courses of these months show up here.
            </EmptyState>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Earnings" description="Your share per month" icon={TrendingUp} plain />
        <CardBody>
          {hasEarnings ? (
            <ChartFrame label="Earnings per month" height={268}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chart.success} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={chart.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="label" {...axisProps(chart)} />
                  <YAxis {...axisProps(chart)} tickFormatter={compactMoney} width={56} />
                  <Tooltip cursor={{ stroke: chart.grid }} content={<ChartTooltip format={formatMoney} />} />
                  <Area
                    type="monotone"
                    dataKey="earnings"
                    name="Earnings"
                    stroke={chart.success}
                    strokeWidth={2}
                    fill={`url(#${gradient})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartFrame>
          ) : (
            <EmptyState icon={DollarSign} title="No earnings in this period" className="py-10">
              Plus courses earn a share of the membership revenue, calculated after each month.
            </EmptyState>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

/** How many learners have not started, are under or over half way, or finished. */
const ProgressDistribution = ({ data }: ChartsProps) => {
  const total = data.progress_distribution.reduce((sum, bucket) => sum + bucket.count, 0);
  return (
    <Card>
      <CardHeader title="Where your learners are" description={`${total} enrollment${total === 1 ? '' : 's'}`} icon={Target} plain />
      <CardBody>
        {total === 0 ? (
          <p className="py-6 text-center text-sm text-fg-muted">Nobody is enrolled yet.</p>
        ) : (
          <ul className="space-y-4">
            {data.progress_distribution.map((bucket) => (
              <li key={bucket.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-fg">{bucket.label}</span>
                  <span className="text-fg-muted tabular-nums">
                    <span className="font-semibold text-fg">{bucket.count}</span> ({shareOf(bucket.count, total)}%)
                  </span>
                </div>
                <ProgressBar
                  value={shareOf(bucket.count, total)}
                  tone={BUCKET_TONES[bucket.key]}
                  size="sm"
                  label={`${bucket.label}: share of the enrollments`}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-sm">
          <span className="text-fg-muted">Average progress</span>
          <span className="font-semibold text-fg tabular-nums">{percent(data.totals.average_progress)}</span>
        </div>
      </CardBody>
    </Card>
  );
};

/** One row per course: learners, completion, quizzes, rating and revenue. */
const CourseTable = ({ data }: ChartsProps) => (
  <Card className="lg:col-span-2">
    <CardHeader title="Course performance" description="Every course you teach, most learners first" icon={Table2} />
    <Table label="Course performance">
      <THead>
        <tr>
          <TH>Course</TH>
          <TH align="right">Learners</TH>
          <TH align="right">Active</TH>
          <TH align="right">Completion</TH>
          <TH>Avg progress</TH>
          <TH align="right">Quiz avg</TH>
          <TH align="right">Rating</TH>
          <TH align="right">Revenue</TH>
        </tr>
      </THead>
      <TBody>
        {data.courses.map((course) => (
          <TR key={course.id}>
            <TD className="min-w-[15rem]">
              <div className="flex items-center gap-3">
                <CourseThumbnail course={course} className="h-10 w-14 shrink-0 rounded-md" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{course.title}</p>
                  <StatusBadge status={course.status} className="mt-1" />
                </div>
              </div>
            </TD>
            <TD align="right" className="text-fg">{course.enrollments}</TD>
            <TD align="right">{course.active_learners}</TD>
            <TD align="right">{percent(course.completion_rate)}</TD>
            <TD className="min-w-[9rem]">
              {course.average_progress === null ? (
                NOT_LOADED
              ) : (
                <div className="flex items-center gap-2">
                  <ProgressBar value={course.average_progress} size="sm" label={`Average progress in ${course.title}`} />
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums">{percent(course.average_progress)}</span>
                </div>
              )}
            </TD>
            <TD align="right">{percent(course.average_quiz_score)}</TD>
            <TD align="right">
              <span className="inline-flex items-center gap-1">
                {course.average_rating ? <Star size={12} aria-hidden="true" className="text-warning-fg" /> : null}
                {rating(course.average_rating)}
              </span>
            </TD>
            <TD align="right" className="whitespace-nowrap font-semibold text-fg">{formatMoney(course.revenue)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  </Card>
);

/** The instructor's analytics: real figures of their courses over a chosen period. */
const InstructorAnalyticsPage = () => {
  const [period, setPeriod] = useState<Period>('6');
  const query = useInstructorAnalytics(MONTHS[period]);

  const header = (
    <PageHeader
      title="Analytics"
      description="How learners move through your courses, and what the courses earn."
      actions={<SegmentedControl label="Period" options={PERIODS} value={period} onChange={setPeriod} />}
    />
  );

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
            title="Your analytics could not be loaded"
            error={query.error}
            onRetry={() => query.refetch()}
          />
        </Card>
      </div>
    );
  }

  const data = query.data;
  const { totals } = data;

  if (totals.courses === 0) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            action={<ButtonLink to="/instructor/courses" icon={Plus}>Create a course</ButtonLink>}
          >
            Analytics start with your first course: learners, completions, quiz scores and earnings.
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <div className={cn('space-y-6 transition-opacity', query.isPlaceholderData && 'opacity-60')} aria-busy={query.isPlaceholderData}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            label="Students"
            value={totals.students}
            hint={`${totals.active_learners} active in the last 7 days`}
            icon={Users}
          />
          <StatCard
            label="Completion rate"
            value={percent(totals.completion_rate)}
            hint={`${totals.completions} of ${totals.enrollments} enrollments completed`}
            icon={GraduationCap}
            tone="success"
          />
          <StatCard
            label="Average quiz score"
            value={percent(totals.average_quiz_score)}
            hint={
              totals.quiz_attempts > 0
                ? `${totals.quiz_attempts} attempts, ${percent(totals.quiz_pass_rate)} passed`
                : 'no quiz attempts yet'
            }
            icon={CheckCircle2}
            tone="info"
          />
          <StatCard label="Earnings" value={formatMoney(totals.earnings)} hint="your share, all time" icon={DollarSign} tone="plus" />
          <StatCard
            label="Average progress"
            value={percent(totals.average_progress)}
            hint="over every enrollment"
            icon={Gauge}
            tone="neutral"
          />
          <StatCard
            label="Hand-ins to grade"
            value={totals.pending_submissions}
            hint={`${totals.submissions} hand-in${totals.submissions === 1 ? '' : 's'} in all`}
            icon={ClipboardCheck}
            tone={totals.pending_submissions > 0 ? 'warning' : 'neutral'}
          />
          <StatCard
            label="Average rating"
            value={rating(totals.average_rating)}
            hint={totals.average_rating ? 'over your rated courses' : 'no reviews yet'}
            icon={Star}
            tone="warning"
          />
          <StatCard
            label="Published courses"
            value={`${totals.published_courses} of ${totals.courses}`}
            hint="the others are drafts, in review or offline"
            icon={BookOpen}
            tone="neutral"
          />
        </div>

        <MonthlyCharts data={data} />

        <div className="grid gap-6 lg:grid-cols-3">
          <ProgressDistribution data={data} />
          <CourseTable data={data} />
        </div>
      </div>
    </div>
  );
};

export default InstructorAnalyticsPage;
