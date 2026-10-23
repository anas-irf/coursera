import React from 'react';
import {
  ArrowRight, Award, BarChart2, BookOpen, CheckCircle2, Clock, Compass, Crown, Flame, Sparkles, Target,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useAuth } from '../../../shared/auth/AuthProvider';
import { BRAND } from '../../../shared/brand';
import { Button, ButtonLink } from '../../../shared/ui/Button';
import { Callout } from '../../../shared/ui/Callout';
import { Card, CardBody, CardHeader } from '../../../shared/ui/Card';
import { ChartTooltip, axisProps, useChartTheme } from '../../../shared/ui/charts';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { SectionHeader } from '../../../shared/ui/PageHeader';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { StatCard } from '../../../shared/ui/StatCard';
import { useSubscription } from '../../billing';
import {
  CourseCard,
  EnrolledCourseCard,
  useMyCourses,
  useRecommendedCourses,
} from '../../learning';
import { ChartFrame } from '../components/ChartFrame';
import { useStudentStats, useWeeklyProgress } from '../hooks/useInsights';
import { NOT_LOADED, hours } from '../lib/format';
import type { StudentStats } from '../types';

const CONTINUE_COUNT = 3;

/** Cards that stand in for the courses while they load. */
const CardSkeletons = ({ count }: { count: number }) => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: count }, (_, index) => (
      <Card key={index} className="overflow-hidden">
        <Skeleton className="aspect-video w-full rounded-none" />
        <div className="space-y-3 p-5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-2 w-full" />
        </div>
      </Card>
    ))}
  </div>
);

/** The learner's home: where they stand, what to continue and what to try next. */
const StudentHomePage = () => {
  const { user } = useAuth();
  const stats = useStudentStats();
  const enrolled = useMyCourses({ status: 'active' });
  const recommended = useRecommendedCourses();
  const subscription = useSubscription();
  const weeklyProgress = useWeeklyProgress();
  const chart = useChartTheme();

  // a figure that could not be loaded is shown as such, never as a zero
  const figure = (read: (data: StudentStats) => number) => (stats.isSuccess ? read(stats.data) : NOT_LOADED);
  const showUpgrade = !subscription.loading && !subscription.error && !subscription.isPlus;
  const monthly = weeklyProgress.data ? weeklyProgress.data.monthly_progress || [] : [];
  const hasLearningTime = monthly.some((month) => month.hours > 0);
  const firstName = (user && user.first_name ? user.first_name : '').trim();
  const streak = stats.isSuccess ? stats.data.learning_streak : null;

  return (
    <div className="space-y-8">
      {/* greeting */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-6 text-white shadow-card sm:p-8">
        <div className="bg-dots absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-400/30 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-brand-200">Your learning</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Welcome back{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-brand-100 sm:text-base">
              Pick up where you left off, or find something new to learn.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {streak !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium ring-1 ring-white/20">
                <Flame size={16} aria-hidden="true" />
                {streak > 0 ? `${streak}-day streak` : 'Start a streak today'}
              </span>
            )}
            <ButtonLink to="/student/explore" variant="secondary" size="sm" icon={Compass} className="border-transparent">
              Explore courses
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* where the learner stands */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard label="Courses Enrolled" value={figure((data) => data.courses_enrolled || 0)} icon={BookOpen}
            hint={stats.isSuccess ? `${stats.data.courses_active} in progress` : undefined} />
          <StatCard label="Completed" value={figure((data) => data.courses_completed || 0)} icon={CheckCircle2} tone="success"
            hint="courses finished" />
          <StatCard label="Certificates" value={figure((data) => data.certificates_earned || 0)} icon={Award} tone="plus"
            hint="earned so far" />
          <StatCard label="Hours Learned" value={figure((data) => hours(data.total_learning_hours))} icon={Clock} tone="info"
            hint="watching and reading" />
        </div>
        {stats.isError && (
          <Callout
            tone="danger"
            role="alert"
            action={<Button variant="secondary" size="sm" onClick={() => stats.refetch()}>Try again</Button>}
          >
            Your figures could not be loaded.
          </Callout>
        )}
      </div>

      {/* the courses running */}
      <section>
        {enrolled.isPending && (
          <>
            <SectionHeader title="Continue Learning" />
            <CardSkeletons count={CONTINUE_COUNT} />
          </>
        )}
        {enrolled.isError && (
          <Card>
            <ErrorState
              title="We could not load your courses"
              error={enrolled.error}
              onRetry={() => enrolled.refetch()}
            />
          </Card>
        )}
        {enrolled.isSuccess && enrolled.data.length > 0 && (
          <>
            <SectionHeader
              title="Continue Learning"
              description="The courses you are working through."
              action={
                <ButtonLink to="/student/my-learning" variant="ghost" size="sm" iconRight={ArrowRight}>
                  View all
                </ButtonLink>
              }
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {enrolled.data.slice(0, CONTINUE_COUNT).map((course) => (
                <EnrolledCourseCard key={course.id} course={course} compact />
              ))}
            </div>
          </>
        )}
        {enrolled.isSuccess && enrolled.data.length === 0 && (
          <Card>
            <EmptyState
              icon={Target}
              title="Start your first course"
              action={<ButtonLink to="/student/explore" icon={Compass}>Explore courses</ButtonLink>}
            >
              The courses you enrol in show up here, with your progress and the next lecture.
            </EmptyState>
          </Card>
        )}
      </section>

      {/* time spent, and the membership or the overall progress */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Learning Progress" description="Hours learned per month" icon={BarChart2} plain />
          <CardBody>
            {weeklyProgress.isPending && <Skeleton className="h-64 w-full" />}
            {weeklyProgress.isError && (
              <ErrorState
                className="py-6"
                title="We could not load your progress"
                error={weeklyProgress.error}
                onRetry={() => weeklyProgress.refetch()}
              />
            )}
            {weeklyProgress.isSuccess && !hasLearningTime && (
              <EmptyState icon={BarChart2} title="No learning time yet" className="py-8">
                The hours you spend watching lectures will show up here.
              </EmptyState>
            )}
            {weeklyProgress.isSuccess && hasLearningTime && (
              <ChartFrame label="Hours learned per month" height={260}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="month" {...axisProps(chart)} />
                    <YAxis {...axisProps(chart)} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: chart.grid, opacity: 0.5 }}
                      content={<ChartTooltip format={(value) => `${value} h`} />}
                    />
                    <Bar dataKey="hours" name="Hours" fill={chart.primary} radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            )}
          </CardBody>
        </Card>

        {showUpgrade ? (
          <section className="relative flex flex-col overflow-hidden rounded-xl bg-gradient-to-br from-plus via-brand-700 to-brand-900 p-6 text-white shadow-card">
            <div className="bg-dots absolute inset-0 opacity-40" aria-hidden="true" />
            <div className="relative flex flex-1 flex-col">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                <Crown size={20} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">Unlock Premium Content</h2>
              <p className="mt-1 text-sm text-brand-100">
                {`Every ${BRAND.plus} course, its quizzes and a certificate for each one you pass, with one membership.`}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-brand-50">
                {['The whole Plus catalogue', 'Shareable certificates', 'Cancel anytime'].map((perk) => (
                  <li key={perk} className="flex items-center gap-2">
                    <Sparkles size={14} aria-hidden="true" className="text-brand-200" />
                    {perk}
                  </li>
                ))}
              </ul>
              <ButtonLink to="/student/checkout" variant="secondary" className="mt-6 border-transparent" block>
                Upgrade to Plus
              </ButtonLink>
            </div>
          </section>
        ) : (
          <Card>
            <CardHeader title="Overall progress" description="Across every course you are enrolled in" icon={Target} plain />
            <CardBody className="space-y-5">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-semibold tracking-tight text-fg tabular-nums">
                    {stats.isSuccess ? `${Math.round(stats.data.total_progress)}%` : NOT_LOADED}
                  </span>
                  <span className="text-xs text-fg-subtle">average progress</span>
                </div>
                <ProgressBar
                  value={stats.isSuccess ? stats.data.total_progress : 0}
                  label="Average progress"
                  className="mt-3"
                />
              </div>
              <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
                <div>
                  <dt className="text-xs text-fg-subtle">In progress</dt>
                  <dd className="mt-0.5 font-semibold text-fg tabular-nums">
                    {stats.isSuccess ? stats.data.courses_active : NOT_LOADED}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">Learning streak</dt>
                  <dd className="mt-0.5 font-semibold text-fg tabular-nums">
                    {streak === null ? NOT_LOADED : `${streak} day${streak === 1 ? '' : 's'}`}
                  </dd>
                </div>
              </dl>
              {subscription.isPlus && (
                <p className="flex items-center gap-2 rounded-lg bg-plus-soft px-3 py-2 text-xs font-medium text-plus-fg">
                  <Crown size={14} aria-hidden="true" />
                  {`${BRAND.plus} member: every Plus course is open to you`}
                </p>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      {/* what to try next */}
      <section>
        <SectionHeader
          title="Recommended for You"
          description="Courses from the catalogue you might like next."
          action={
            <ButtonLink to="/student/explore" variant="ghost" size="sm" iconRight={ArrowRight}>
              Browse all
            </ButtonLink>
          }
        />
        {recommended.isPending && <CardSkeletons count={3} />}
        {recommended.isError && (
          <Card>
            <ErrorState
              title="We could not load the courses"
              error={recommended.error}
              onRetry={() => recommended.refetch()}
            />
          </Card>
        )}
        {recommended.isSuccess &&
          (recommended.data.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {recommended.data.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState icon={BookOpen} title="No courses available">
                New courses appear here as soon as they are published.
              </EmptyState>
            </Card>
          ))}
      </section>
    </div>
  );
};

export default StudentHomePage;
