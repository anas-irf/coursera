import React, { Suspense } from 'react';
import type { ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { LoginPage } from '../features/accounts';
import { ConfirmProvider } from '../shared/ui/ConfirmDialog';
import { ErrorBoundary } from '../shared/ui/ErrorBoundary';
import { PageSpinner } from '../shared/ui/Spinner';
import { ToastProvider } from '../shared/ui/Toast';
import { AuthProvider, useAuth } from '../shared/auth/AuthProvider';
import { homePathFor } from '../shared/auth/paths';
import { QueryProvider } from '../shared/query/QueryProvider';
import { HomeRedirect, RedirectKeepingSearch, RequireAuth, RequireRole, SessionGate } from './guards';
import AdminLayout from './layouts/AdminLayout';
import InstructorLayout from './layouts/InstructorLayout';
import StudentLayout from './layouts/StudentLayout';

// Every page is its own chunk, loaded when its route is first visited.  A feature is reached
// through its index (the module boundary), so what loads together is a feature's pages.  ``name``
// is the page's export in that index; the types make a misspelt name a compile error.
const page = <K extends string, M extends Record<K, ComponentType>>(loader: () => Promise<M>, name: K) =>
  React.lazy(() => loader().then((module) => ({ default: module[name] })));

const InstructorSettingsPage = page(() => import('../features/accounts'), 'InstructorSettingsPage');
const ApprovalsPage = page(() => import('../features/admin'), 'ApprovalsPage');
const AdminCoursesPage = page(() => import('../features/admin'), 'CoursesPage');
const AdminOverviewPage = page(() => import('../features/admin'), 'OverviewPage');
const AdminSettingsPage = page(() => import('../features/admin'), 'SettingsPage');
const ReportsPage = page(() => import('../features/admin'), 'ReportsPage');
const RevenuePage = page(() => import('../features/admin'), 'RevenuePage');
const UsersPage = page(() => import('../features/admin'), 'UsersPage');
const GradesPage = page(() => import('../features/assessments'), 'GradesPage');
const InstructorAssignmentsPage = page(() => import('../features/assessments'), 'InstructorAssignmentsPage');
const CheckoutPage = page(() => import('../features/billing'), 'CheckoutPage');
const CertificatesPage = page(() => import('../features/certificates'), 'CertificatesPage');
const CoursesPage = page(() => import('../features/courses'), 'CoursesPage');
const AchievementsPage = page(() => import('../features/insights'), 'AchievementsPage');
const InstructorAnalyticsPage = page(() => import('../features/insights'), 'InstructorAnalyticsPage');
const InstructorEarningsPage = page(() => import('../features/insights'), 'InstructorEarningsPage');
const InstructorOverviewPage = page(() => import('../features/insights'), 'InstructorOverviewPage');
const StudentHomePage = page(() => import('../features/insights'), 'StudentHomePage');
const CoursePlayerPage = page(() => import('../features/learning'), 'CoursePlayerPage');
const ExplorePage = page(() => import('../features/learning'), 'ExplorePage');
const InstructorStudentsPage = page(() => import('../features/learning'), 'InstructorStudentsPage');
const MyLearningPage = page(() => import('../features/learning'), 'MyLearningPage');
const MessagesPage = page(() => import('../features/messaging'), 'MessagesPage');
const NotificationsPage = page(() => import('../features/notifications'), 'NotificationsPage');

/** A route's page: loaded on demand, and a page that breaks does not take the layout with it. */
function Lazy({ page: Page }: { page: ComponentType }) {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageSpinner className="min-h-[50vh]" />}>
        <Page />
      </Suspense>
    </ErrorBoundary>
  );
}

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
    <QueryProvider>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginRoute />} />

                <Route element={<RequireAuth />}>
                  <Route element={<RequireRole role="student" />}>
                    <Route path="/student" element={<StudentLayout />}>
                      <Route index element={<Lazy page={StudentHomePage} />} />
                      <Route path="my-learning" element={<Lazy page={MyLearningPage} />} />
                      <Route path="explore" element={<Lazy page={ExplorePage} />} />
                      <Route path="grades" element={<Lazy page={GradesPage} />} />
                      <Route path="notifications" element={<Lazy page={NotificationsPage} />} />
                      <Route path="messages" element={<Lazy page={MessagesPage} />} />
                      <Route path="achievements" element={<Lazy page={AchievementsPage} />} />
                      <Route path="certificates" element={<Lazy page={CertificatesPage} />} />
                      <Route path="checkout" element={<Lazy page={CheckoutPage} />} />
                    </Route>
                    {/* the old name, also the page Stripe returns to */}
                    <Route path="/student/dashboard" element={<RedirectKeepingSearch to="/student" />} />
                    <Route path="/courses/:courseId/learn" element={<Lazy page={CoursePlayerPage} />} />
                  </Route>

                  <Route element={<RequireRole role="instructor" />}>
                    <Route path="/instructor" element={<InstructorLayout />}>
                      <Route index element={<Lazy page={InstructorOverviewPage} />} />
                      <Route path="courses" element={<Lazy page={CoursesPage} />} />
                      <Route path="assignments" element={<Lazy page={InstructorAssignmentsPage} />} />
                      <Route path="students" element={<Lazy page={InstructorStudentsPage} />} />
                      <Route path="analytics" element={<Lazy page={InstructorAnalyticsPage} />} />
                      <Route path="earnings" element={<Lazy page={InstructorEarningsPage} />} />
                      <Route path="messages" element={<Lazy page={MessagesPage} />} />
                      <Route path="settings" element={<Lazy page={InstructorSettingsPage} />} />
                    </Route>
                    <Route path="/instructor/dashboard" element={<Navigate to="/instructor" replace />} />
                  </Route>

                  <Route element={<RequireRole role="admin" />}>
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<Lazy page={AdminOverviewPage} />} />
                      <Route path="courses" element={<Lazy page={AdminCoursesPage} />} />
                      <Route path="courses/approvals" element={<Lazy page={ApprovalsPage} />} />
                      <Route path="users" element={<Lazy page={UsersPage} />} />
                      <Route path="revenue" element={<Lazy page={RevenuePage} />} />
                      <Route path="reports" element={<Lazy page={ReportsPage} />} />
                      <Route path="settings" element={<Lazy page={AdminSettingsPage} />} />
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
    </QueryProvider>
  );
}

export default App;
