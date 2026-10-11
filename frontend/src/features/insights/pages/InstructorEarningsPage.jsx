import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Clock, TrendingUp } from 'lucide-react';

import { PageSpinner } from '../../../shared/ui/Spinner';
import * as insightsApi from '../api';

const EMPTY_EARNINGS = {
  summary: {
    total_earnings: 0,
    pending_earnings: 0,
    monthly_earnings: 0,
    platform_fee_rate: 30,
  },
  recent_transactions: [],
  monthly_chart: [],
};

const InstructorEarningsPage = () => {
  const [earningsData, setEarningsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    insightsApi
      .fetchInstructorEarnings()
      .then((data) => !cancelled && setEarningsData(data))
      .catch(() => !cancelled && setEarningsData(EMPTY_EARNINGS))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <PageSpinner />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
      
      {/* Earnings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-green-100">Total Earnings</p>
            <DollarSign size={24} className="text-green-200" />
          </div>
          <p className="text-3xl font-bold">${earningsData?.summary?.total_earnings || 0}</p>
          <p className="text-sm text-green-100 mt-2">Lifetime earnings</p>
        </div>
        
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-yellow-100">Pending</p>
            <Clock size={24} className="text-yellow-200" />
          </div>
          <p className="text-3xl font-bold">${earningsData?.summary?.pending_earnings || 0}</p>
          <p className="text-sm text-yellow-100 mt-2">Being processed</p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-blue-100">This Month</p>
            <TrendingUp size={24} className="text-blue-200" />
          </div>
          <p className="text-3xl font-bold">${earningsData?.summary?.monthly_earnings || 0}</p>
          <p className="text-sm text-blue-100 mt-2">Current month earnings</p>
        </div>
      </div>
      
      {/* Monthly Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Earnings</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={earningsData?.monthly_chart || []}>
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
      </div>
      
      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Course
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(earningsData?.recent_transactions || []).map((transaction, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.course}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.student_email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${transaction.amount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      transaction.status === 'Paid'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {transaction.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InstructorEarningsPage;