import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock, Crown, DollarSign, Landmark, Receipt, Repeat, TrendingUp, Wallet } from 'lucide-react';

import { cn } from '../../../shared/lib/cn';
import { formatMoney } from '../../../shared/lib/money';
import { formatDate } from '../../../shared/lib/time';
import Avatar from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import type { Tone } from '../../../shared/ui/Badge';
import { Callout } from '../../../shared/ui/Callout';
import { Card, CardBody, CardHeader } from '../../../shared/ui/Card';
import { ChartLegend, ChartTooltip, axisProps, useChartTheme } from '../../../shared/ui/charts';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { StatCard } from '../../../shared/ui/StatCard';
import { Table, TBody, TD, TH, THead, TR } from '../../../shared/ui/Table';
import { useRevenue } from '../hooks/useAdmin';
import type { PaymentStatus, RevenueMonths } from '../types';

const PERIODS = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
];

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  completed: 'success',
  pending: 'warning',
  failed: 'danger',
  refunded: 'neutral',
};

const PLAN_LABEL = { monthly: 'Monthly', yearly: 'Annual' } as const;

/** Whole dollars on an axis: "$1.2k" from a thousand up. */
const axisMoney = (value: number): string => (value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${Math.round(value)}`);

const RevenuePage = () => {
  const [months, setMonths] = useState<RevenueMonths>(6);
  const query = useRevenue(months);
  const chart = useChartTheme();

  const header = (
    <PageHeader
      title="Revenue"
      description="Coursera Plus memberships, what they bring in and what they pay the instructors."
      actions={
        <SegmentedControl
          label="Period"
          options={PERIODS}
          value={String(months)}
          onChange={(value) => setMonths(value === '12' ? 12 : 6)}
        />
      }
    />
  );

  if (query.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <PageSpinner />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState title="Revenue could not be loaded" error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }

  const { summary, monthly, subscriptions, plans, top_courses: topCourses, recent_payments: payments } = query.data;
  const share = query.data.revenue_share_percent;
  // the month that is still running is not over: it says so
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const chartRows = monthly.map((row) => ({
    ...row,
    label: row.month === current && row.source === 'live' ? `${row.label} (so far)` : row.label,
  }));
  const membershipTotal = subscriptions.active + subscriptions.cancelled + subscriptions.lapsed;
  const memberships: Array<{ label: string; value: number; tone: 'success' | 'warning' | 'danger'; hint: string }> = [
    { label: 'Active', value: subscriptions.active, tone: 'success', hint: 'renewing' },
    { label: 'Cancelled', value: subscriptions.cancelled, tone: 'warning', hint: 'paid until the period ends' },
    { label: 'Lapsed', value: subscriptions.lapsed, tone: 'danger', hint: 'expired or payment failed' },
  ];

  return (
    <div className={cn('space-y-6 transition-opacity', query.isPlaceholderData && 'opacity-60')}>
      {header}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Gross revenue"
          value={formatMoney(summary.gross_revenue)}
          hint={`The last ${months} months`}
          icon={DollarSign}
        />
        <StatCard
          label="Platform share"
          value={formatMoney(summary.platform_share)}
          hint={`${100 - share}% kept by the platform`}
          icon={Landmark}
          tone="success"
        />
        <StatCard
          label="Instructor share"
          value={formatMoney(summary.instructor_share)}
          hint={`${share}% shared among Plus courses`}
          icon={Wallet}
          tone="plus"
        />
        <StatCard
          label="Monthly recurring revenue"
          value={formatMoney(summary.mrr)}
          hint={`${summary.renewing_members} renewing member${summary.renewing_members === 1 ? '' : 's'}`}
          icon={Repeat}
          tone="info"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue by month"
            description="What each month brought in, split between the platform and the instructors"
            icon={TrendingUp}
            plain
          />
          <CardBody>
            {monthly.some((row) => row.gross > 0) ? (
              <>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartRows} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" {...axisProps(chart)} interval={0} tick={{ fill: chart.axis, fontSize: 11 }} />
                      <YAxis {...axisProps(chart)} width={56} tickFormatter={axisMoney} />
                      <Tooltip cursor={{ fill: chart.grid, opacity: 0.4 }} content={<ChartTooltip format={formatMoney} />} />
                      <Bar dataKey="platform_share" name="Platform" stackId="revenue" fill={chart.series[0]} maxBarSize={44} />
                      <Bar dataKey="instructor_share" name="Instructors" stackId="revenue" fill={chart.series[3]} radius={[6, 6, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ChartLegend
                  className="mt-4"
                  items={[
                    { label: 'Platform', color: chart.series[0], value: formatMoney(summary.platform_share) },
                    { label: 'Instructors', color: chart.series[3], value: formatMoney(summary.instructor_share) },
                  ]}
                />
              </>
            ) : (
              <EmptyState icon={TrendingUp} title="No revenue in this period">
                Plus payments show up here once members pay.
              </EmptyState>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Memberships" description={`${summary.members} student${summary.members === 1 ? '' : 's'} with Plus right now`} icon={Crown} />
          <CardBody className="space-y-5">
            <ul className="space-y-4">
              {memberships.map((row) => (
                <li key={row.label}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-fg">{row.label}</span>
                    <span className="text-fg-muted tabular-nums">
                      <span className="font-semibold text-fg">{row.value}</span> · {row.hint}
                    </span>
                  </div>
                  <ProgressBar value={row.value} max={Math.max(membershipTotal, 1)} tone={row.tone} size="sm" label={`${row.label} memberships`} />
                </li>
              ))}
            </ul>
            <div className="space-y-2 border-t border-line pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Plans</p>
              {plans.map((plan) => (
                <div key={plan.cycle} className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{PLAN_LABEL[plan.cycle]}</p>
                    <p className="text-xs text-fg-subtle">
                      {formatMoney(plan.price)} / {plan.cycle === 'monthly' ? 'month' : 'year'}
                    </p>
                  </div>
                  <Badge tone="primary">
                    {plan.members} member{plan.members === 1 ? '' : 's'}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <div>
                <p className="text-xs text-fg-subtle">Payments this month</p>
                <p className="mt-0.5 font-semibold text-fg tabular-nums">{formatMoney(summary.this_month)}</p>
              </div>
              <div>
                <p className="text-xs text-fg-subtle">Failed payments</p>
                <p className={cn('mt-0.5 font-semibold tabular-nums', summary.failed_payments ? 'text-danger-fg' : 'text-fg')}>
                  {summary.failed_payments}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Top earning courses" description={`Instructor earnings over the last ${months} months`} icon={Wallet} />
          {topCourses.length > 0 ? (
            <Table label="Top earning courses">
              <THead>
                <tr>
                  <TH>Course</TH>
                  <TH align="right">Learners</TH>
                  <TH align="right">Earnings</TH>
                </tr>
              </THead>
              <TBody>
                {topCourses.map((course) => (
                  <TR key={course.id}>
                    <TD>
                      <p className="max-w-[18rem] truncate font-medium text-fg">{course.title}</p>
                      <p className="text-xs text-fg-subtle">{course.instructor}</p>
                    </TD>
                    <TD align="right">{course.enrollments}</TD>
                    <TD align="right">
                      <span className="font-semibold text-fg">{formatMoney(course.earnings)}</span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState icon={Wallet} title="No earnings yet" className="py-10">
              Earnings are calculated on the first day of every month for the Plus courses.
            </EmptyState>
          )}
          <div className="grid grid-cols-2 gap-4 border-t border-line px-5 py-4 text-sm">
            <div>
              <p className="text-xs text-fg-subtle">Paid to instructors</p>
              <p className="mt-0.5 font-semibold text-fg tabular-nums">{formatMoney(summary.earnings_paid)}</p>
            </div>
            <div>
              <p className="text-xs text-fg-subtle">Pending payout</p>
              <p className="mt-0.5 font-semibold text-fg tabular-nums">{formatMoney(summary.earnings_pending)}</p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Recent payments" description="The newest Plus charges, successful or not" icon={Receipt} />
          {payments.length > 0 ? (
            <ul className="divide-y divide-line">
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={payment.student} className="h-9 w-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{payment.student}</p>
                    <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
                      <CalendarClock size={12} aria-hidden="true" />
                      {formatDate(payment.date)} · {PLAN_LABEL[payment.plan]}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-fg tabular-nums">{formatMoney(payment.amount)}</p>
                    <Badge tone={PAYMENT_TONE[payment.status]} className="mt-0.5 capitalize">
                      {payment.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Receipt} title="No payments yet" className="py-10">
              Payments appear once students subscribe to Plus.
            </EmptyState>
          )}
        </Card>
      </div>

      <Callout tone="neutral">
        A month's figures come from the revenue ledger, written when the instructors' earnings are calculated. A month
        without a ledger entry yet shows the Plus payments received in it.
      </Callout>
    </div>
  );
};

export default RevenuePage;
