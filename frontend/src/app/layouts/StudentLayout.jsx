import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Award, Bell, BookOpen, Crown, GraduationCap, Home, LogOut, Menu, MessageSquare, Search, Settings,
  Trophy, User, X, Zap,
} from 'lucide-react';

import { PlusWelcomeDialog, useStripeReturn, useSubscription } from '../../features/billing';
import { NotificationDropdown } from '../../features/notifications';
import { useConfirm } from '../../shared/ui/ConfirmDialog';
import { useAuth } from '../../shared/auth/AuthProvider';

const NAV_ITEMS = [
  { to: '/student', label: 'Home', icon: Home, end: true },
  { to: '/student/my-learning', label: 'My Learning', icon: BookOpen },
  { to: '/student/explore', label: 'Explore', icon: Search },
  { to: '/student/grades', label: 'Grades', icon: GraduationCap },
  { to: '/student/notifications', label: 'Notifications', icon: Bell },
  { to: '/student/messages', label: 'Messages', icon: MessageSquare },
  { to: '/student/achievements', label: 'Achievements', icon: Trophy },
  { to: '/student/certificates', label: 'Certificates', icon: Award },
];

const linkClass = ({ isActive }) =>
  `px-2 xl:px-3 py-2 rounded-lg text-xs xl:text-sm font-medium transition-all duration-200 flex items-center space-x-1 xl:space-x-2 flex-shrink-0 ${
    isActive ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-50'
  }`;

const mobileLinkClass = ({ isActive }) =>
  `w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-3 ${
    isActive
      ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 border border-indigo-200'
      : 'text-gray-700 hover:bg-gray-50'
  }`;

/** Header and navigation of the student area; the pages render in the outlet. */
const StudentLayout = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { confirmLogout } = useConfirm();
  const subscription = useSubscription();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const headerRef = useRef(null);

  const { welcome, dismiss } = useStripeReturn({ onActivated: subscription.refresh });

  const name = user ? `${user.first_name} ${user.last_name}` : 'Student';
  const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`;

  // close the mobile menu on outside clicks and when the viewport grows
  useEffect(() => {
    const onClickOutside = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) setMenuOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const handleLogout = async () => {
    const confirmed = await confirmLogout('You will need to login again to access your account.', 'Logout');
    if (!confirmed) return;
    setLoggingOut(true);
    await logout();
  };

  const upgrade = () => navigate('/student/checkout');

  return (
    <div className="min-h-screen bg-gray-50">
      <header ref={headerRef} className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center min-w-0 flex-1">
              <div className="flex items-center mr-4 sm:mr-6 lg:mr-8 flex-shrink-0">
                <svg
                  className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-blue-600 mr-1.5 sm:mr-2"
                  viewBox="0 0 32 32"
                  fill="currentColor"
                >
                  <rect x="0" y="0" width="14" height="14" rx="2" />
                  <rect x="18" y="0" width="14" height="14" rx="2" />
                  <rect x="0" y="18" width="14" height="14" rx="2" />
                  <rect x="18" y="18" width="14" height="14" rx="2" />
                </svg>
                <span className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">coursera</span>
              </div>

              <nav className="hidden lg:flex space-x-1 overflow-x-auto">
                {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                  <NavLink key={to} to={to} end={end} className={linkClass}>
                    <Icon size={16} />
                    <span className="whitespace-nowrap hidden xl:block">{label}</span>
                    <span className="whitespace-nowrap xl:hidden text-xs">
                      {label.length > 8 ? `${label.substring(0, 8)}...` : label}
                    </span>
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              {subscription.loading ? (
                <div className="hidden md:flex items-center px-2 py-1 rounded-full bg-gray-100">
                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-gray-400"></div>
                </div>
              ) : subscription.isPlus ? (
                <span className="hidden md:inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-yellow-400 to-orange-400 text-white">
                  <Zap size={12} className="mr-1" />
                  <span className="hidden lg:inline">Plus Member</span>
                  <span className="lg:hidden">Plus</span>
                </span>
              ) : (
                <button
                  onClick={upgrade}
                  className="hidden md:inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
                >
                  <Crown size={12} className="mr-1" />
                  <span className="hidden lg:inline">Upgrade to Plus</span>
                  <span className="lg:hidden">Upgrade</span>
                </button>
              )}

              <div className="hidden sm:block">
                <NotificationDropdown viewAllPath="/student/notifications" />
              </div>

              <div className="relative group">
                <button className="flex items-center space-x-2 sm:space-x-3 p-1 sm:p-2 rounded-lg hover:bg-gray-50">
                  <img src={avatar} alt="Profile" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full" />
                  <div className="hidden md:block text-left">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-24">{name}</p>
                    <p className="text-xs text-gray-500">Student</p>
                  </div>
                </button>

                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="px-4 py-2 text-sm text-gray-700">
                    <User size={16} className="inline mr-2" />
                    {user ? user.email : 'Profile'}
                  </div>
                  <div className="px-4 py-2 text-sm text-gray-400">
                    <Settings size={16} className="inline mr-2" />
                    Settings (soon)
                  </div>
                  <hr className="my-1" />
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center ${
                      loggingOut ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {loggingOut ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 inline mr-2"></div>
                    ) : (
                      <LogOut size={16} className="inline mr-2" />
                    )}
                    {loggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="lg:hidden p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Menu"
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <nav className="lg:hidden border-t bg-white shadow-lg">
            <div className="px-3 sm:px-4 py-3 space-y-1 max-h-80 overflow-y-auto">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
                  <Icon size={18} className="flex-shrink-0" />
                  <span className="text-left">{label}</span>
                </NavLink>
              ))}

              {!subscription.isPlus && (
                <div className="pt-3 border-t md:hidden">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      upgrade();
                    }}
                    className="w-full px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                  >
                    <Crown size={18} className="flex-shrink-0" />
                    <span className="text-left">Upgrade to Plus</span>
                  </button>
                </div>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        <Outlet context={{ subscription }} />
      </main>

      {welcome && <PlusWelcomeDialog onClose={dismiss} />}
    </div>
  );
};

export default StudentLayout;
