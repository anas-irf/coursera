import React, { useState } from 'react';
import { Search, Users } from 'lucide-react';

import { initials } from '../../../shared/lib/names';
import { timeAgo } from '../../../shared/lib/time';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useInstructorStudents } from '../hooks/useLearning';

const InstructorStudentsPage = () => {
  const query = useInstructorStudents();
  const [searchTerm, setSearchTerm] = useState('');

  const heading = <h1 className="text-2xl font-bold text-gray-900">My Students</h1>;

  if (query.isPending) {
    return (
      <div className="space-y-6">
        {heading}
        <PageSpinner className="h-64" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-6">
        {heading}
        <ErrorState
          title="We could not load your students"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      </div>
    );
  }

  const students = query.data;
  const term = searchTerm.trim().toLowerCase();
  const shown = students.filter(
    (student) =>
      !term ||
      (student.name || '').toLowerCase().includes(term) ||
      (student.email || '').toLowerCase().includes(term)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {heading}
        {students.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search students..."
              aria-label="Search students"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {students.length === 0 ? (
          <EmptyState icon={Users} title="No Students Yet" className="p-8">
            You don't have any students enrolled in your courses yet. Once students enroll, they'll appear here.
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState icon={Search} title="No students found" className="p-8">
            No student matches your search.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Courses Enrolled
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Active
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shown.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-indigo-600">
                            {initials(student.name)}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{student.name}</div>
                          <div className="text-sm text-gray-500">{student.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{student.courses_enrolled}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                          <div
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, student.progress))}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">
                          {Math.round(student.progress)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.last_active ? timeAgo(student.last_active) : 'Never'}
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

export default InstructorStudentsPage;
