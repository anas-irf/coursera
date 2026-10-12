import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { DollarSign, TrendingUp, CreditCard, Users } from 'lucide-react';

import { SAMPLE_NOTICE, SAMPLE_REVENUE } from '../sampleData';

const RevenuePage = () => {
  const { stats, revenue_chart, top_courses } = SAMPLE_REVENUE;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Revenue Analytics</h2>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        {SAMPLE_NOTICE}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900">${(stats.total_revenue / 1000).toFixed(0)}K</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="text-green-500 mr-1" size={16} />
                <span className="text-sm text-green-600 font-medium">+{stats.monthly_growth}%</span>
              </div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Subscriptions</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total_subscriptions.toLocaleString()}</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="text-blue-500 mr-1" size={16} />
                <span className="text-sm text-blue-600 font-medium">+8.2%</span>
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Revenue/User</p>
              <p className="text-3xl font-bold text-gray-900">${stats.avg_revenue_per_user}</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="text-purple-500 mr-1" size={16} />
                <span className="text-sm text-purple-600 font-medium">+3.1%</span>
              </div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <CreditCard className="text-purple-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Growth Rate</p>
              <p className="text-3xl font-bold text-gray-900">{stats.monthly_growth}%</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="text-emerald-500 mr-1" size={16} />
                <span className="text-sm text-emerald-600 font-medium">Month over month</span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg">
              <TrendingUp className="text-emerald-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Over Time</h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={revenue_chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.1}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscriptions Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Subscription Growth</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenue_chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="subscriptions"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Courses */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Revenue Courses</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top_courses} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis dataKey="name" type="category" stroke="#6b7280" width={120} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Course Revenue Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Course Revenue Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Course
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Enrollments
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg. Price
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {top_courses.map((course, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{course.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">${course.revenue.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{course.enrollments.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">${(course.revenue / course.enrollments).toFixed(2)}</div>
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

export default RevenuePage;