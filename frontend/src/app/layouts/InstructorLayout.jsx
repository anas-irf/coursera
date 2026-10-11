import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart2, BookOpen, ChevronDown, CreditCard, FileText, Home, LogOut, Menu, MessageSquare, Search,
  Settings, Users, X,
} from 'lucide-react';

import { NotificationDropdown } from '../../features/notifications';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { useAuth } from '../../shared/auth/AuthProvider';

const NAV_ITEMS = [
  { to: '/instructor', label: 'Dashboard', icon: Home, end: true },
  { to: '/instructor/courses', label: 'My Courses', icon: BookOpen },
  { to: '/instructor/assignments', label: 'Assignments', icon: FileText },
  { to: '/instructor/students', label: 'Students', icon: Users },
  { to: '/instructor/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/instructor/earnings', label: 'Earnings', icon: CreditCard },
  { to: '/instructor/messages', label: 'Messages', icon: MessageSquare },
  { to: '/instructor/settings', label: 'Settings', icon: Settings },
];

const linkClass = ({ isActive }) =>
  `w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
    isActive ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 shadow-sm' : 'text-gray-700 hover:bg-gray-50'
  }`;

/** Sidebar and header of the instructor area; the pages render in the outlet. */
const InstructorLayout = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { confirmLogout } = useConfirm();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const profileRef = useRef(null);

  const name = user ? `${user.first_name} ${user.last_name}` : 'Instructor';
  const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`;

  useEffect(() => {
    const onClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = async () => {
    const confirmed = await confirmLogout(
      'You will need to login again to access your instructor dashboard.',
      'Logout'
    );
    if (!confirmed) return;
    setLoggingOut(true);
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between h-16 px-6 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="flex items-center">
            <svg className="h-8 w-8 text-white mr-2" viewBox="0 0 32 32" fill="currentColor">
              <rect x="0" y="0" width="14" height="14" rx="2" />
              <rect x="18" y="0" width="14" height="14" rx="2" />
              <rect x="0" y="18" width="14" height="14" rx="2" />
              <rect x="18" y="18" width="14" height="14" rx="2" />
            </svg>
            <span className="text-xl font-bold text-white">coursera</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white hover:bg-white/10 p-1 rounded">
            <X size={20} />
          </button>
        </div>

        <nav className="p-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass} onClick={() => setSidebarOpen(false)}>
              <Icon size={20} />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              loggingOut ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'
            }`}
          >
            {loggingOut ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
            ) : (
              <LogOut size={20} />
            )}
            <span className="font-medium">{loggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </div>

      <div className="lg:ml-64">
        <header className="bg-white shadow-sm border-b sticky top-0 z-40">
          <div className="flex items-center justify-between px-6 py-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-600 hover:text-gray-900">
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

              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen((open) => !open)}
                  className="flex items-center space-x-3 hover:bg-gray-50 rounded-lg p-2 transition-colors"
                >
                  <img src={avatar} alt="Profile" className="w-10 h-10 rounded-full" />
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-semibold text-gray-900">{name}</p>
                    <p className="text-xs text-gray-500">{user ? user.email : ''}</p>
                  </div>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        navigate('/instructor/settings');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Settings size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-700">Profile Settings</span>
                    </button>
                    <hr className="my-2" />
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        handleLogout();
                      }}
                      disabled={loggingOut}
                      className="w-full text-left px-4 py-2 flex items-center space-x-2 hover:bg-red-50"
                    >
                      <LogOut size={16} className="text-red-500" />
                      <span className="text-sm text-red-600">Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default InstructorLayout;
