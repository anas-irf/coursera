import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, ChevronDown, Settings, LogOut, Home, BarChart2, CreditCard, MessageSquare, BookOpen, Users, Search, FileText } from 'lucide-react';
import authService from '../services/authService';
import { useConfirm } from '../shared/ui/ConfirmDialog';

// Import extracted components
import DashboardOverview from './instructor/DashboardOverview';
import CoursesManagement from './instructor/CoursesManagement';
import StudentsView from './instructor/StudentsView';
import AnalyticsView from './instructor/AnalyticsView';
import EarningsView from './instructor/EarningsView';
import { NotificationDropdown } from '../features/notifications';
import MessagesView from './instructor/MessagesView';
import SettingsView from './instructor/SettingsView';
import AssignmentsView from './instructor/AssignmentsView';

const InstructorDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    // Get saved tab from localStorage, default to 'dashboard'
    return localStorage.getItem('instructor_active_tab') || 'dashboard';
  });
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const profileDropdownRef = useRef(null);
  const { confirmLogout } = useConfirm();
  const [user, setUser] = useState({
    name: 'John Instructor',
    email: 'instructor@example.com',
    avatar: 'https://ui-avatars.com/api/?name=John+Instructor&background=4F46E5&color=fff'
  });

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('instructor_active_tab', activeTab);
  }, [activeTab]);

  // Get actual user data
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser({
        name: `${currentUser.first_name} ${currentUser.last_name}`,
        email: currentUser.email,
        avatar: `https://ui-avatars.com/api/?name=${currentUser.first_name}+${currentUser.last_name}&background=4F46E5&color=fff`
      });
    }
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Logout functionality
  const handleLogout = async () => {
    const confirmed = await confirmLogout(
      "You will need to login again to access your instructor dashboard.",
      "Logout"
    );

    if (confirmed) {
      setIsLoggingOut(true);
      try {
        await authService.logout();
        // Redirect to login page
        window.location.href = '/login';
      } catch (error) {
        console.error('Error during logout:', error);
        // Even if logout API fails, clear local storage and redirect
        localStorage.clear();
        window.location.href = '/login';
      }
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'courses', label: 'My Courses', icon: BookOpen },
    { id: 'assignments', label: 'Assignments', icon: FileText },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'earnings', label: 'Earnings', icon: CreditCard },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview />;
      case 'courses':
        return <CoursesManagement />;
      case 'assignments':
        return <AssignmentsView />;
      case 'students':
        return <StudentsView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'earnings':
        return <EarningsView />;
      case 'messages':
        return <MessagesView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-6 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="flex items-center">
            <svg
              className="h-8 w-8 text-white mr-2"
              viewBox="0 0 32 32"
              fill="currentColor"
            >
              <rect x="0" y="0" width="14" height="14" rx="2" />
              <rect x="18" y="0" width="14" height="14" rx="2" />
              <rect x="0" y="18" width="14" height="14" rx="2" />
              <rect x="18" y="18" width="14" height="14" rx="2" />
            </svg>
            <span className="text-xl font-bold text-white">
              coursera
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white hover:bg-white/10 p-1 rounded"
          >
            <X size={20} />
          </button>
        </div>
        
        <nav className="p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 shadow-sm'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
                {item.id === 'messages' && (
                  <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">3</span>
                )}
              </button>
            );
          })}
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              isLoggingOut 
                ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
                : 'text-red-600 hover:bg-red-50'
            }`}
          >
            {isLoggingOut ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
            ) : (
              <LogOut size={20} />
            )}
            <span className="font-medium">
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-40">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-600 hover:text-gray-900"
            >
              <Menu size={24} />
            </button>
            
            <div className="flex-1 max-w-xl mx-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search courses, students..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <NotificationDropdown />
              
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center space-x-3 hover:bg-gray-50 rounded-lg p-2 transition-colors"
                >
                  <img src={user.avatar} alt="Profile" className="w-10 h-10 rounded-full" />
                  <div className="hidden md:block">
                    <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Profile Dropdown */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <button
                      onClick={() => {
                        setActiveTab('settings');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Settings size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-700">Profile Settings</span>
                    </button>
                    <hr className="my-2" />
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      disabled={isLoggingOut}
                      className={`w-full text-left px-4 py-2 flex items-center space-x-2 ${
                        isLoggingOut 
                          ? 'bg-gray-100 cursor-not-allowed' 
                          : 'hover:bg-red-50'
                      }`}
                    >
                      {isLoggingOut ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                      ) : (
                        <LogOut size={16} className="text-red-500" />
                      )}
                      <span className={`text-sm ${isLoggingOut ? 'text-gray-400' : 'text-red-600'}`}>
                        {isLoggingOut ? 'Logging out...' : 'Logout'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default InstructorDashboard;