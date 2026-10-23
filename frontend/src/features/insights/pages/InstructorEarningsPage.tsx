import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  BadgePercent, CalendarClock, CheckCircle2, Clock, DollarSign, GraduationCap, Info, Percent, TrendingUp, Users,
  Wallet,
} from 'lucide-react';

import { formatMoney } from '../../../shared/lib/money';
import { Badge } from '../../../shared/ui/Badge';
import { Card, CardBody, CardHeader } from '../../../shared/ui/Card';
import { ChartTooltip, axisProps, useChartTheme } from '../../../shared/ui/charts';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { StatCard } from '../../../shared/ui/StatCard';
import { Table, TBody, TD, TH, THead, TR } from '../../../shared/ui/Table';
import { ChartFrame, useGradientId } from '../components/ChartFrame';
import { useInstructorEarnings } from '../hooks/useInsights';
import { compactMoney } from '../lib/format';

const InstructorEarningsPage = () => {
  const query = useInstructorEarnings();
  const chart = useChartTheme();
  const gradient = useGradientId('earnings');

  const model = query.data && query.data.earnings_model;
  const header = (
    <PageHeader
      title="Earnings"
      description={model ? model.description : 'Your share of the Plus revenue, per course and month.'}
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
            title="Your earnings could not be loaded"
            error={query.error}
            onRetry={() => query.refetch()}
          />
        </Card>
      </div>
    );
  }

  const { summary, monthly_chart: chartData, recent_earnings: rows, performance } = query.data;
  const hasChartData = chartData.some((point) => point.earnings > 0);
  const factors = (model && model.factors) || [];

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total Earnings" value={formatMoney(summary.total_earnings)} hint="Paid out so far" icon={Wallet} tone="success" />
        <StatCard label="Pending" value={formatMoney(summary.pending_earnings)} hint="Earned, not paid out yet" icon={Clock} tone="warning" />
        <StatCard label="This Month" value={formatMoney(summary.monthly_earnings)} hint="Calculated for the current month" icon={TrendingUp} />
        <StatCard
          label="Platform fee"
          value={`${summary.platform_fee_rate}%`}
          hint="of the Plus revenue the platform keeps"
          icon={Percent}
          tone="neutral"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Monthly Earnings" description="The last six months" icon={TrendingUp} plain />
          <CardBody>
            {hasChartData ? (
              <ChartFrame label="Earnings per month" height={260}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chart.success} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={chart.success} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="month" {...axisProps(chart)} />
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
              <EmptyState icon={TrendingUp} title="No earnings yet" className="py-10">
                Your share of the Coursera Plus revenue is calculated at the end of each month.
              </EmptyState>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="This month" description="Across your Plus courses" icon={CalendarClock} plain />
            <CardBody>
              <ul className="space-y-2">
                {[
                  { label: 'Enrollments', value: performance.monthly_enrollments, icon: Users },
                  { label: 'Completions', value: performance.monthly_completions, icon: GraduationCap },
                  { label: 'Engagement score', value: Math.round(performance.engagement_score), icon: BadgePercent },
                ].map(({ label, value, icon: Icon }) => (
                  <li key={label} className="flex items-center gap-3 rounded-lg bg-surface-muted/60 px-3 py-2.5">
                    <Icon size={16} aria-hidden="true" className="shrink-0 text-fg-subtle" />
                    <span className="flex-1 text-sm text-fg-muted">{label}</span>
                    <span className="text-base font-semibold text-fg tabular-nums">{value}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {factors.length > 0 && (
            <Card>
              <CardHeader title="How earnings are calculated" icon={Info} plain />
              <CardBody>
                <ul className="space-y-2 text-sm text-fg-muted">
                  {factors.map((factor) => (
                    <li key={factor} className="flex gap-2">
                      <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-success-fg" />
                      {factor}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* what was earned: one row per course and month */}
      <Card>
        <CardHeader title="Recent Transactions" description="Your share per course and month" icon={DollarSign} />
        {rows.length === 0 ? (
          <EmptyState icon={DollarSign} title="No transactions yet" className="py-10">
            They appear once a month has been calculated for your Plus courses.
          </EmptyState>
        ) : (
          <Table label="Earnings per course and month">
            <THead>
              <tr>
                <TH>Month</TH>
                <TH>Course</TH>
                <TH align="right">Enrollments</TH>
                <TH align="right">Completions</TH>
                <TH align="right">Amount</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id}>
                  <TD className="whitespace-nowrap text-fg">{row.month}</TD>
                  <TD className="min-w-[12rem] text-fg">{row.course}</TD>
                  <TD align="right">{row.enrollments}</TD>
                  <TD align="right">{row.completions}</TD>
                  <TD align="right" className="whitespace-nowrap font-semibold text-fg">{formatMoney(row.amount)}</TD>
                  <TD>
                    <Badge tone={row.status === 'Paid' ? 'success' : 'warning'} dot>
                      {row.status}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default InstructorEarningsPage;
