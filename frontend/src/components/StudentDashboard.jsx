import React, { useState, useEffect, useRef } from "react";
import { BookOpen, Award, Search, Bell, User, Settings, LogOut, Home, Zap, Menu, X, MessageSquare, Trophy, GraduationCap, Crown, Plus } from "lucide-react";
import authService from "../services/authService";
import api from "../services/api";
import { useConfirm } from './shared/ConfirmDialog';

// Import extracted components
import HomeView from './student/HomeView';
import MyLearning from './student/MyLearning';
import Explore from './student/Explore';
import AchievementsView from './student/AchievementsView';
import CertificatesView from './student/CertificatesView';
import StudentMessagesView from './student/StudentMessagesView';
import NotificationDropdown from './student/NotificationDropdown';
import NotificationsView from './student/NotificationsView';
import GradesView from './student/GradesView';
import CheckoutView from './student/CheckoutView';

const StudentDashboard = () => {
  const [activeTab, setActiveTab] = useState(() => {
    // Get saved tab from localStorage, default to 'home'
    return localStorage.getItem('student_active_tab') || 'home';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState({
    name: "John Student",
    email: "student@example.com",
    avatar: "https://ui-avatars.com/api/?name=John+Student&background=4F46E5&color=fff",
    subscription: null, // Will be loaded from API
  });
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [showCongratulations, setShowCongratulations] = useState(false);
  const mobileMenuRef = useRef(null);
  const { confirmLogout } = useConfirm();

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('student_active_tab', activeTab);
  }, [activeTab]);

  // Get actual user data and subscription status
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser({
        name: `${currentUser.first_name} ${currentUser.last_name}`,
        email: currentUser.email,
        avatar: `https://ui-avatars.com/api/?name=${currentUser.first_name}+${currentUser.last_name}&background=4F46E5&color=fff`,
        subscription: null, // Will be loaded from API
      });

      // Fetch subscription status
      fetchSubscriptionStatus();
    }
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      setSubscriptionLoading(true);
      const response = await api.get('/auth/student/subscription-status/');

      setUser(prevUser => ({
        ...prevUser,
        subscription: response.data.can_access_plus_courses ? "coursera_plus" : "free"
      }));
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      // If API fails, assume free user
      setUser(prevUser => ({
        ...prevUser,
        subscription: "free"
      }));
    } finally {
      setSubscriptionLoading(false);
    }
  };

  // Close mobile menu when clicking outside or when resizing to larger screen
  useEffect(() => {
    function handleClickOutside(event) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    }

    function handleResize() {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Check for payment success in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const plan = urlParams.get('plan');
    const sessionId = urlParams.get('session_id');

    if (success === 'true' && plan) {
      // Clean the URL first
      window.history.replaceState({}, document.title, window.location.pathname);

      // Verify session and create subscription if needed
      if (sessionId) {
        verifyStripeSession(sessionId);
      } else {
        // Fallback: show congratulations and refresh status
        setShowCongratulations(true);
        fetchSubscriptionStatus();
      }

      // Auto close popup after 5 seconds
      const timer = setTimeout(() => {
        setShowCongratulations(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, []);

  const verifyStripeSession = async (sessionId) => {
    try {
      console.log('Verifying Stripe session:', sessionId);
      const response = await api.post('/payments/verify-session/', {
        session_id: sessionId
      });

      if (response.data.has_subscription) {
        setShowCongratulations(true);
        fetchSubscriptionStatus();
        console.log('✅ Subscription verified and created');
      } else {
        console.log('⚠️ Session not paid yet:', response.data.payment_status);
        // Maybe show a different message or retry
      }
    } catch (error) {
      console.error('Error verifying session:', error);
      // Fallback: show congratulations anyway
      setShowCongratulations(true);
      fetchSubscriptionStatus();
    }
  };

  // Logout functionality
  const handleLogout = async () => {
    const confirmed = await confirmLogout(
      "You will need to login again to access your account.",
      "Logout"
    );

    if (confirmed) {
      setIsLoggingOut(true);
      try {
        await authService.logout();
        // Redirect to login page
        window.location.href = "/login";
      } catch (error) {
        console.error("Error during logout:", error);
        // Even if logout API fails, clear local storage and redirect
        localStorage.clear();
        window.location.href = "/login";
      }
    }
  };

  // Navigate to checkout page
  const handleUpgradeToPlus = () => {
    setActiveTab('checkout');
  };

  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "my-learning", label: "My Learning", icon: BookOpen },
    { id: "explore", label: "Explore", icon: Search },
    { id: "grades", label: "Grades", icon: GraduationCap },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "achievements", label: "Achievements", icon: Trophy },
    { id: "certificates", label: "Certificates", icon: Award },
  ];

  const handleCheckoutSuccess = () => {
    // Refresh subscription status and redirect to home
    fetchSubscriptionStatus();
    setActiveTab('home');
  };

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return <HomeView onNavigateToCheckout={handleUpgradeToPlus} />;
      case "my-learning":
        return <MyLearning />;
      case "explore":
        return <Explore onNavigateToCheckout={handleUpgradeToPlus} />;
      case "grades":
        return <GradesView />;
      case "notifications":
        return <NotificationsView />;
      case "messages":
        return <StudentMessagesView />;
      case "achievements":
        return <AchievementsView />;
      case "certificates":
        return <CertificatesView />;
      case "checkout":
        return <CheckoutView onSuccess={handleCheckoutSuccess} />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header ref={mobileMenuRef} className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Logo and Desktop Nav */}
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
                <span className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">
                  coursera
                </span>
              </div>

              {/* Desktop Navigation */}
              <nav className="hidden lg:flex space-x-1 overflow-x-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`px-2 xl:px-3 py-2 rounded-lg text-xs xl:text-sm font-medium transition-all duration-200 flex items-center space-x-1 xl:space-x-2 flex-shrink-0 ${
                        activeTab === item.id
                          ? "bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Icon size={14} className="xl:hidden" />
                      <Icon size={16} className="hidden xl:block" />
                      <span className="whitespace-nowrap hidden xl:block">{item.label}</span>
                      <span className="whitespace-nowrap xl:hidden text-xs">{item.label.length > 8 ? item.label.substring(0, 8) + '...' : item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Right side - User menu */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Subscription Badge */}
              {subscriptionLoading ? (
                <div className="hidden md:flex items-center px-2 py-1 rounded-full bg-gray-100">
                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-gray-400"></div>
                </div>
              ) : user.subscription === "coursera_plus" ? (
                <span className="hidden md:inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-yellow-400 to-orange-400 text-white">
                  <Zap size={12} className="mr-1 sm:mr-1" />
                  <span className="hidden lg:inline">Plus Member</span>
                  <span className="lg:hidden">Plus</span>
                </span>
              ) : (
                <button
                  onClick={handleUpgradeToPlus}
                  className="hidden md:inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
                >
                  <Crown size={12} className="mr-1" />
                  <span className="hidden lg:inline">Upgrade to Plus</span>
                  <span className="lg:hidden">Upgrade</span>
                </button>
              )}

              {/* Notifications */}
              <div className="hidden sm:block">
                <NotificationDropdown onNavigateToNotifications={() => setActiveTab('notifications')} />
              </div>

              {/* User Menu */}
              <div className="relative group">
                <button className="flex items-center space-x-2 sm:space-x-3 p-1 sm:p-2 rounded-lg hover:bg-gray-50">
                  <img
                    src={user.avatar}
                    alt="Profile"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full"
                  />
                  <div className="hidden md:block text-left">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-24">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500">Student</p>
                  </div>
                </button>

                {/* Dropdown Menu */}
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <a
                    href="#"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <User size={16} className="inline mr-2" />
                    Profile
                  </a>
                  <a
                    href="#"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Settings size={16} className="inline mr-2" />
                    Settings
                  </a>
                  <hr className="my-1" />
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center ${
                      isLoggingOut
                        ? "text-gray-400 bg-gray-100 cursor-not-allowed"
                        : "text-red-600 hover:bg-red-50"
                    }`}
                  >
                    {isLoggingOut ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 inline mr-2"></div>
                    ) : (
                      <LogOut size={16} className="inline mr-2" />
                    )}
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </button>
                </div>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {mobileMenuOpen ? <X size={20} className="sm:w-6 sm:h-6" /> : <Menu size={20} className="sm:w-6 sm:h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="lg:hidden border-t bg-white shadow-lg">
            <div className="px-3 sm:px-4 py-3 space-y-1 max-h-80 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-3 ${
                      activeTab === item.id
                        ? "bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600 border border-indigo-200"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="text-left">{item.label}</span>
                  </button>
                );
              })}

              {/* Mobile-only navigation items */}
              <div className="pt-3 border-t">
                {/* Mobile Notifications */}
                <button
                  onClick={() => {
                    setActiveTab('notifications');
                    setMobileMenuOpen(false);
                  }}
                  className="sm:hidden w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-3 text-gray-700 hover:bg-gray-50"
                >
                  <Bell size={18} className="flex-shrink-0" />
                  <span className="text-left">Notifications</span>
                </button>

                {/* Mobile Plus Upgrade */}
                {user.subscription !== "coursera_plus" && (
                  <button
                    onClick={() => {
                      handleUpgradeToPlus();
                      setMobileMenuOpen(false);
                    }}
                    className="md:hidden w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                  >
                    <Crown size={18} className="flex-shrink-0" />
                    <span className="text-left">Upgrade to Plus</span>
                  </button>
                )}
              </div>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        {renderContent()}
      </main>

      {/* Congratulations Popup */}
      {showCongratulations && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm sm:max-w-md w-full text-center animate-pulse">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Crown className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">🎉 Congratulations!</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
              Welcome to Coursera Plus! You now have unlimited access to all Plus courses.
            </p>
            <div className="flex items-center justify-center space-x-2 text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
              <Trophy className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Your subscription is now active</span>
            </div>
            <button
              onClick={() => setShowCongratulations(false)}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 sm:py-3 px-6 sm:px-8 rounded-xl text-sm sm:text-base font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
            >
              Get Started!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;