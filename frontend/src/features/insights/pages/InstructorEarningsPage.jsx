import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Clock, TrendingUp } from 'lucide-react';

import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useInstructorEarnings } from '../hooks/useInsights';

const money = (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const TH = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';

const InstructorEarningsPage = () => {
  const query = useInstructorEarnings();

  if (query.isPending) {
    return <PageSpinner />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Your earnings could not be loaded"
        error={query.error}
        onRetry={() => query.refetch()}
      />
    );
  }

  const { summary, monthly_chart: chart, recent_earnings: rows, earnings_model: model } = query.data;
  const hasChartData = chart.some((point) => point.earnings > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
        {model && <p className="text-sm text-gray-600 mt-1">{model.description}</p>}
      </div>

      {/* Earnings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-green-100">Total Earnings</p>
            <DollarSign size={24} className="text-green-200" />
          </div>
          <p className="text-3xl font-bold">{money(summary.total_earnings)}</p>
          <p className="text-sm text-green-100 mt-2">Paid out so far</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-yellow-100">Pending</p>
            <Clock size={24} className="text-yellow-200" />
          </div>
          <p className="text-3xl font-bold">{money(summary.pending_earnings)}</p>
          <p className="text-sm text-yellow-100 mt-2">Earned, not paid out yet</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-blue-100">This Month</p>
            <TrendingUp size={24} className="text-blue-200" />
          </div>
          <p className="text-3xl font-bold">{money(summary.monthly_earnings)}</p>
          <p className="text-sm text-blue-100 mt-2">Calculated for the current month</p>
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Earnings</h2>
        {hasChartData ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="earnings" stroke="#10B981" fillOpacity={1} fill="url(#colorEarnings)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon={TrendingUp} title="No earnings yet" className="py-8">
            Your share of the Coursera Plus revenue is calculated at the end of each month.
          </EmptyState>
        )}
      </div>

      {/* What was earned: one row per course and month */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
          <p className="text-sm text-gray-500 mt-1">Your share per course and month</p>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={DollarSign} title="No transactions yet" className="py-8">
            They appear once a month has been calculated for your Plus courses.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className={TH}>Month</th>
                  <th className={TH}>Course</th>
                  <th className={TH}>Enrollments</th>
                  <th className={TH}>Completions</th>
                  <th className={TH}>Amount</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.course}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.enrollments}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.completions}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {money(row.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          row.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructorEarningsPage;
