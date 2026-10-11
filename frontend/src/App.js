// frontend/src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CourseraAuth from './components/CourseraAuth';
import InstructorDashboard from './components/InstructorDashboard'; // ← Correct path
import authService from './services/authService';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';
import CourseLearning from './components/student/CourseLearning';
import { ToastProvider } from './components/shared/Toast';
import { ConfirmProvider } from './components/shared/ConfirmDialog';

// Protected route component for admin access
const AdminProtectedRoute = ({ children }) => {
  const user = authService.getCurrentUser();
  const isAuthenticated = authService.isAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (user?.user_type !== 'admin') {
    console.warn('Non-admin user attempted to access admin dashboard');
    return <Navigate to={user?.user_type === 'instructor' ? '/instructor/dashboard' : '/student/dashboard'} />;
  }

  return children;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const isAuth = authService.isAuthenticated();
    setIsAuthenticated(isAuth);

    if (isAuth) {
      const user = authService.getCurrentUser();
      setUserType(user?.user_type);

      // Additional security: if user is not admin but trying to access admin routes
      const currentPath = window.location.pathname;
      if ((currentPath.includes('/admin') || currentPath.includes('/admindashboard')) &&
          user?.user_type !== 'admin') {
        console.warn('Unauthorized access attempt to admin routes');
        window.location.href = user?.user_type === 'instructor' ? '/instructor/dashboard' : '/student/dashboard';
        return;
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <ConfirmProvider>
        <Router>
          <Routes>
            <Route
              path="/login"
              element={
                isAuthenticated ?
                  <Navigate to = {
                    userType === 'instructor' ? '/instructor/dashboard' :
                    userType === 'admin' ? '/admin/dashboard' :
                    '/student/dashboard'
                  } /> :
                  <CourseraAuth />
              }
            />

            <Route
              path="/admin/dashboard"
              element={
                <AdminProtectedRoute>
                  <AdminDashboard />
                </AdminProtectedRoute>
              }
            />

            {/* Legacy route compatibility - with proper auth check */}
            <Route
              path="/admindashboard"
              element={
                <AdminProtectedRoute>
                  <Navigate to="/admin/dashboard" />
                </AdminProtectedRoute>
              }
            />

            <Route
              path="/instructor/dashboard"
              element={
                isAuthenticated && userType === 'instructor' ?
                  <InstructorDashboard /> :
                  <Navigate to="/login" />
              }
            />

            <Route
              path="/student/dashboard"
              element={
                isAuthenticated && userType === 'student' ?
                  <StudentDashboard /> :
                  <Navigate to="/login" />
              }
            />

            <Route
              path="/courses/:courseId/learn"
              element={
                isAuthenticated && userType === 'student' ?
                  <CourseLearning /> :
                  <Navigate to="/login" />
              }
            />

            <Route
              path="/"
              element={
                <Navigate to={
                  isAuthenticated ?
                    (userType === 'instructor' ? '/instructor/dashboard' :
                     userType === 'admin' ? '/admin/dashboard' :
                     '/student/dashboard') :
                    '/login'
                } />
              }
            />
          </Routes>
        </Router>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;