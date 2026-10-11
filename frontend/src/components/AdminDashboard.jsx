import React, { useState, useEffect } from 'react';
import { Users, BookOpen, DollarSign, FileText, Settings, LogOut, Home, BookCheck, Menu, X } from 'lucide-react';
import authService from '../services/authService';
import apiService from '../services/api';

// Import separate admin components
import OverviewDashboard from './admin/OverviewDashboard';
import CourseApprovals from './admin/CourseApprovals';
import CourseManagement from './admin/CourseManagement';
import UserManagement from './admin/UserManagement';
import { NotificationDropdown } from '../features/notifications';
import RevenueAnalytics from './admin/RevenueAnalytics';
import Reports from './admin/Reports';
import PlatformSettings from './admin/PlatformSettings';

const AdminDashboard = () => {
  // Valid view IDs for validation
  const validViews = ['overview', 'approvals', 'users', 'courses', 'revenue', 'reports', 'settings'];

  // Initialize activeView from localStorage or default to 'overview'
  const [activeView, setActiveView] = useState(() => {
    const storedView = localStorage.getItem('adminDashboardActiveView');
    return validViews.includes(storedView) ? storedView : 'overview';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [user] = useState({
    name: 'Admin User',
    email: 'admin@coursera.com',
    avatar: 'https://ui-avatars.com/api/?name=Admin&background=6366F1&color=fff',
    role: 'Super Admin'
  });

  // Fetch pending count on component mount
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const response = await apiService.get('/courses/admin/pending/');
        setPendingCount(response.data.length);
      } catch (error) {
        console.error('Error fetching pending count:', error);
        setPendingCount(0);
      }
    };
    fetchPendingCount();
  }, []);

  const handleLogout = React.useCallback(async () => {
    try {
      // Clear the stored active view on logout
      localStorage.removeItem('adminDashboardActiveView');
      await authService.logout();
      // authService.logout() already handles redirection to login
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      window.location.href = '/login';
    }
  }, []);

  const handleViewChange = (viewId) => {
    // Only change view if it's a valid view ID
    if (validViews.includes(viewId)) {
      setActiveView(viewId);
      // Store the active view in localStorage for persistence across reloads
      localStorage.setItem('adminDashboardActiveView', viewId);
    }
    setSidebarOpen(false);
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'approvals', label: 'Course Approvals', icon: BookCheck, badge: pendingCount > 0 ? pendingCount : null },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'courses', label: 'All Courses', icon: BookOpen },
    { id: 'revenue', label: 'Revenue Analytics', icon: DollarSign },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Platform Settings', icon: Settings },
  ];

  const renderContent = () => {
    switch(activeView) {
      case 'overview':
        return <OverviewDashboard />;
      case 'approvals':
        return <CourseApprovals />;
      case 'users':
        return <UserManagement />;
      case 'courses':
        return <CourseManagement />;
      case 'revenue':
        return <RevenueAnalytics />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <PlatformSettings />;
      default:
        return <OverviewDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-6 bg-gradient-to-r from-indigo-600 to-purple-600">
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="mt-6 px-4">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleViewChange(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 mb-2 text-left rounded-lg transition-colors ${
                  activeView === item.id
                    ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <IconComponent size={20} />
                  <span className="font-medium">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center space-x-3 mb-4">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-10 h-10 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
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

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-40">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-600 hover:text-gray-900"
              >
                <Menu size={24} />
              </button>
              <h1 className="text-xl font-semibold text-gray-800 ml-4 lg:ml-0">
                Admin Dashboard
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <NotificationDropdown />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {renderContent()}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;