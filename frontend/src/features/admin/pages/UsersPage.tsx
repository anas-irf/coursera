import React, { useState } from 'react';
import { Users, Search, Shield, User, GraduationCap } from 'lucide-react';

import { formatDate } from '../../../shared/lib/time';
import type { UserType } from '../../../shared/types';
import Avatar from '../../../shared/ui/Avatar';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useAdminUsers } from '../hooks/useAdmin';

type RoleFilter = 'all' | UserType;

const UsersPage = () => {
  const query = useAdminUsers();
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const getUserTypeIcon = (userType: UserType) => {
    switch (userType) {
      case 'student': return <User className="text-blue-600" size={20} />;
      case 'instructor': return <GraduationCap className="text-green-600" size={20} />;
      case 'admin': return <Shield className="text-purple-600" size={20} />;
      default: return <User className="text-gray-600" size={20} />;
    }
  };

  // the status is whatever the server sent, so it is read as a plain string
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (query.isPending) {
    return <PageSpinner />;
  }

  if (query.isError) {
    return <ErrorState title="We could not load the users" error={query.error} onRetry={() => query.refetch()} />;
  }

  const users = query.data;
  const filteredUsers = users.filter(user => {
    const matchesType = filter === 'all' || user.user_type === filter;
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-600 mt-1">
            {users.length} total users
            ({users.filter(u => u.user_type === 'student').length} students, {users.filter(u => u.user_type === 'instructor').length} instructors, {users.filter(u => u.user_type === 'admin').length} admins)
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              aria-label="Search users"
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            aria-label="Role"
            value={filter}
            // the options below are the only values the select can report
            onChange={(e) => setFilter(e.target.value as RoleFilter)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Users</option>
            <option value="student">Students</option>
            <option value="instructor">Instructors</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Avatar name={user.name} className="h-10 w-10 text-sm mr-4" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500 flex items-center">
                          {user.email}
                          {user.email_verified && (
                            <span className="ml-2 px-1 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getUserTypeIcon(user.user_type)}
                      <span className="ml-2 text-sm text-gray-900 capitalize">{user.user_type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.user_type === 'student' ? (
                      <div>
                        <p>{user.courses_enrolled || 0} courses enrolled</p>
                        <p className="text-xs text-gray-400">
                          {user.completed_courses || 0} completed, {user.active_courses || 0} active
                        </p>
                      </div>
                    ) : user.user_type === 'instructor' ? (
                      <div>
                        <p>{user.courses_created || 0} courses created</p>
                        <p className="text-xs text-gray-400">
                          {user.published_courses || 0} published, {user.students_taught || 0} students taught
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p>Administrator</p>
                        <p className="text-xs text-gray-400">
                          {user.is_superuser ? 'Superuser' : 'Admin'}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      <p>{formatDate(user.join_date)}</p>
                      {user.last_login && (
                        <p className="text-xs text-gray-400">
                          Last login: {formatDate(user.last_login)}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-500">
              {searchQuery || filter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'No users have been registered yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage;
