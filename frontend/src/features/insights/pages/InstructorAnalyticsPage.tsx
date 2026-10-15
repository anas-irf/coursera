import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Star } from 'lucide-react';

const InstructorAnalyticsPage = () => {
  const monthlyData = [
    { month: 'Jan', students: 450, revenue: 12500, completion: 78 },
    { month: 'Feb', students: 520, revenue: 14200, completion: 82 },
    { month: 'Mar', students: 480, revenue: 13800, completion: 75 },
    { month: 'Apr', students: 590, revenue: 16500, completion: 85 },
    { month: 'May', students: 650, revenue: 18200, completion: 88 },
    { month: 'Jun', students: 720, revenue: 19800, completion: 90 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <select className="px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option>Last 6 Months</option>
          <option>Last Year</option>
          <option>All Time</option>
        </select>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        These charts show sample data. Course analytics are not connected to your real figures yet; the
        per-course numbers are available in the course list.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students Growth */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Growth</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="students" stroke="#4F46E5" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Trend */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Course Performance Table */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Course Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 text-sm font-medium text-gray-700">Course</th>
                <th className="text-left py-3 text-sm font-medium text-gray-700">Enrollments</th>
                <th className="text-left py-3 text-sm font-medium text-gray-700">Completion Rate</th>
                <th className="text-left py-3 text-sm font-medium text-gray-700">Avg. Rating</th>
                <th className="text-left py-3 text-sm font-medium text-gray-700">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { name: 'React Mastery', enrollments: 890, completion: 85, rating: 4.8, revenue: 15600 },
                { name: 'Python Complete', enrollments: 670, completion: 78, rating: 4.6, revenue: 12300 },
                { name: 'Django REST API', enrollments: 450, completion: 82, rating: 4.9, revenue: 8900 },
              ].map((course, index) => (
                <tr key={index}>
                  <td className="py-3 text-sm text-gray-900">{course.name}</td>
                  <td className="py-3 text-sm text-gray-600">{course.enrollments}</td>
                  <td className="py-3 text-sm text-gray-600">{course.completion}%</td>
                  <td className="py-3 text-sm text-yellow-600 flex items-center">
                    <Star size={14} className="mr-1" />
                    {course.rating}
                  </td>
                  <td className="py-3 text-sm text-green-600 font-semibold">${course.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InstructorAnalyticsPage;
