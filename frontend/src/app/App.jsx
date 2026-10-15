import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { InstructorSettingsPage, LoginPage } from '../features/accounts';
import {
  ApprovalsPage, CoursesPage as AdminCoursesPage, OverviewPage as AdminOverviewPage, ReportsPage,
  RevenuePage, SettingsPage as AdminSettingsPage, UsersPage,
} from '../features/admin';
import { GradesPage, InstructorAssignmentsPage } from '../features/assessments';
import { CheckoutPage } from '../features/billing';
import { CertificatesPage } from '../features/certificates';
import { CoursesPage } from '../features/courses';
import {
  AchievementsPage, InstructorAnalyticsPage, InstructorEarningsPage, InstructorOverviewPage, StudentHomePage,
} from '../features/insights';
import {
  CoursePlayerPage, ExplorePage, InstructorStudentsPage, MyLearningPage,
} from '../features/learning';
import { MessagesPage } from '../features/messaging';
import { NotificationsPage } from '../features/notifications';
import { ConfirmProvider } from '../shared/ui/ConfirmDialog';
import { ToastProvider } from '../shared/ui/Toast';
import { AuthProvider, useAuth } from '../shared/auth/AuthProvider';
import { homePathFor } from '../shared/auth/paths';
import { HomeRedirect, RedirectKeepingSearch, RequireAuth, RequireRole, SessionGate } from './guards';
import AdminLayout from './layouts/AdminLayout';
import InstructorLayout from './layouts/InstructorLayout';
import StudentLayout from './layouts/StudentLayout';

// "/login" for visitors; users that are already logged in go to their own home (the page waits
// until the server has said who is signed in, so a returning user does not see the form flash)
function LoginRoute() {
  const { isAuthenticated, userType } = useAuth();
  return (
    <SessionGate>
      {isAuthenticated ? <Navigate to={homePathFor(userType)} replace /> : <LoginPage />}
    </SessionGate>
  );
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
                  <Route path="/instructor" element={<InstructorLayout />}>
                    <Route index element={<InstructorOverviewPage />} />
                    <Route path="courses" element={<CoursesPage />} />
                    <Route path="assignments" element={<InstructorAssignmentsPage />} />
                    <Route path="students" element={<InstructorStudentsPage />} />
                    <Route path="analytics" element={<InstructorAnalyticsPage />} />
                    <Route path="earnings" element={<InstructorEarningsPage />} />
                    <Route path="messages" element={<MessagesPage />} />
                    <Route path="settings" element={<InstructorSettingsPage />} />
                  </Route>
                  <Route path="/instructor/dashboard" element={<Navigate to="/instructor" replace />} />
                </Route>

                <Route element={<RequireRole role="admin" />}>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<AdminOverviewPage />} />
                    <Route path="courses" element={<AdminCoursesPage />} />
                    <Route path="courses/approvals" element={<ApprovalsPage />} />
                    <Route path="users" element={<UsersPage />} />
                    <Route path="revenue" element={<RevenuePage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="settings" element={<AdminSettingsPage />} />
                  </Route>
                  {/* the old names */}
                  <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
                  <Route path="/admindashboard" element={<Navigate to="/admin" replace />} />
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
