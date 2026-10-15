import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookCheck, BookOpen, DollarSign, FileText, Home, LogOut, Menu, Settings, Users, X } from 'lucide-react';

import { NotificationDropdown } from '../../features/notifications';
import { pendingCourses } from '../../features/admin';
import { fullName } from '../../shared/lib/names';
import Avatar from '../../shared/ui/Avatar';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { useAuth } from '../../shared/auth/AuthProvider';

const NAV_ITEMS = [
  { to: '/admin', label: 'Overview', icon: Home, end: true },
  { to: '/admin/courses/approvals', label: 'Course Approvals', icon: BookCheck, badge: true },
  { to: '/admin/users', label: 'User Management', icon: Users },
  { to: '/admin/courses', label: 'All Courses', icon: BookOpen, end: true },
  { to: '/admin/revenue', label: 'Revenue Analytics', icon: DollarSign },
  { to: '/admin/reports', label: 'Reports', icon: FileText },
  { to: '/admin/settings', label: 'Platform Settings', icon: Settings },
];

const linkClass = ({ isActive }) =>
  `w-full flex items-center justify-between px-4 py-3 mb-2 text-left rounded-lg transition-colors ${
    isActive
      ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-700'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }`;

/** Sidebar and header of the admin area; the pages render in the outlet. */
const AdminLayout = () => {
  const { user, logout } = useAuth();
  const { confirmLogout } = useConfirm();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pending, setPending] = useState(0);

  // the badge follows the moderation queue: refreshed whenever the admin moves around
  useEffect(() => {
    let cancelled = false;
    pendingCourses()
      .then((rows) => !cancelled && setPending(rows.length))
      .catch(() => !cancelled && setPending(0));
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const name = fullName(user, 'Admin');

  const handleLogout = async () => {
    const confirmed = await confirmLogout('You will need to login again to access the admin panel.', 'Logout');
    if (confirmed) await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between h-16 px-6 bg-gradient-to-r from-indigo-600 to-purple-600">
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        <nav className="mt-6 px-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} className={linkClass} onClick={() => setSidebarOpen(false)}>
              <div className="flex items-center space-x-3">
                <Icon size={20} />
                <span className="font-medium">{label}</span>
              </div>
              {badge && pending > 0 && (
                <span className="px-2 py-1 text-xs bg-red-500 text-white rounded-full">{pending}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center space-x-3 mb-4">
            <Avatar name={name} className="w-10 h-10 text-sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
              <p className="text-xs text-gray-500">Administrator</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>

      <div className="lg:ml-64">
        <header className="bg-white shadow-sm border-b sticky top-0 z-40">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-600 hover:text-gray-900">
                <Menu size={24} />
              </button>
              <h1 className="text-xl font-semibold text-gray-800 ml-4 lg:ml-0">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationDropdown />
            </div>
          </div>
        </header>

        <main className="p-6">
          <Outlet />
        </main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
};

export default AdminLayout;
