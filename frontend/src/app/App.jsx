import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import AdminDashboard from '../components/AdminDashboard';
import InstructorDashboard from '../components/InstructorDashboard';
import { LoginPage } from '../features/accounts';
import { GradesPage } from '../features/assessments';
import { CheckoutPage } from '../features/billing';
import { CertificatesPage } from '../features/certificates';
import { AchievementsPage, StudentHomePage } from '../features/insights';
import { CoursePlayerPage, ExplorePage, MyLearningPage } from '../features/learning';
import { MessagesPage } from '../features/messaging';
import { NotificationsPage } from '../features/notifications';
import { ConfirmProvider } from '../shared/ui/ConfirmDialog';
import { ToastProvider } from '../shared/ui/Toast';
import { AuthProvider, useAuth } from './AuthProvider';
import { HomeRedirect, RedirectKeepingSearch, RequireAuth, RequireRole, homePathFor } from './guards';
import StudentLayout from './layouts/StudentLayout';

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
                  <Route path="/student" element={<StudentLayout />}>
                    <Route index element={<StudentHomePage />} />
                    <Route path="my-learning" element={<MyLearningPage />} />
                    <Route path="explore" element={<ExplorePage />} />
                    <Route path="grades" element={<GradesPage />} />
                    <Route path="notifications" element={<NotificationsPage />} />
                    <Route path="messages" element={<MessagesPage />} />
                    <Route path="achievements" element={<AchievementsPage />} />
                    <Route path="certificates" element={<CertificatesPage />} />
                    <Route path="checkout" element={<CheckoutPage />} />
                  </Route>
                  {/* the old name, also the page Stripe returns to */}
                  <Route path="/student/dashboard" element={<RedirectKeepingSearch to="/student" />} />
                  <Route path="/courses/:courseId/learn" element={<CoursePlayerPage />} />
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
