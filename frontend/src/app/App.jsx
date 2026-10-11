import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import LoginPage from '../features/accounts/pages/LoginPage';
import AdminDashboard from '../components/AdminDashboard';
import InstructorDashboard from '../components/InstructorDashboard';
import StudentDashboard from '../components/StudentDashboard';
import CourseLearning from '../components/student/CourseLearning';
import { ConfirmProvider } from '../shared/ui/ConfirmDialog';
import { ToastProvider } from '../shared/ui/Toast';
import { AuthProvider, useAuth } from './AuthProvider';
import { HomeRedirect, RequireAuth, RequireRole, homePathFor } from './guards';

// "/login" for visitors; users that are already logged in go to their own home
function LoginRoute() {
  const { isAuthenticated, userType } = useAuth();
  return isAuthenticated ? <Navigate to={homePathFor(userType)} replace /> : <LoginPage />;
}

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />

              <Route element={<RequireAuth />}>
                <Route element={<RequireRole role="student" />}>
                  <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
                  <Route path="/student/dashboard" element={<StudentDashboard />} />
                  <Route path="/courses/:courseId/learn" element={<CourseLearning />} />
                </Route>

                <Route element={<RequireRole role="instructor" />}>
                  <Route path="/instructor" element={<Navigate to="/instructor/dashboard" replace />} />
                  <Route path="/instructor/dashboard" element={<InstructorDashboard />} />
                </Route>

                <Route element={<RequireRole role="admin" />}>
                  <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admindashboard" element={<Navigate to="/admin/dashboard" replace />} />
                </Route>
              </Route>

              <Route path="*" element={<HomeRedirect />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
