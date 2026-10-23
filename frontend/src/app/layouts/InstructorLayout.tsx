import React from 'react';
import { BarChart3, Bell, BookOpen, ClipboardCheck, LayoutDashboard, MessageSquare, Settings, Users, Wallet } from 'lucide-react';

import AppShell from './AppShell';
import type { NavSection } from './AppShell';

const SECTIONS: NavSection[] = [
  {
    title: 'Teach',
    items: [
      { to: '/instructor', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/instructor/courses', label: 'My Courses', icon: BookOpen },
      { to: '/instructor/assignments', label: 'Assignments', icon: ClipboardCheck },
      { to: '/instructor/students', label: 'Students', icon: Users },
    ],
  },
  {
    title: 'Insights',
    items: [
      { to: '/instructor/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/instructor/earnings', label: 'Earnings', icon: Wallet },
    ],
  },
  {
    title: 'Inbox',
    items: [
      { to: '/instructor/messages', label: 'Messages', icon: MessageSquare },
      { to: '/instructor/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    title: 'Account',
    items: [{ to: '/instructor/account', label: 'Settings', icon: Settings }],
  },
];

/** The instructor area: the shell with the teaching navigation. */
const InstructorLayout = () => (
  <AppShell
    roleLabel="Instructor"
    sections={SECTIONS}
    accountPath="/instructor/account"
    notificationsPath="/instructor/notifications"
    logoutMessage="You will need to log in again to come back to your courses."
  />
);

export default InstructorLayout;
