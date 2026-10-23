import React from 'react';
import {
  Bell, BookCheck, BookOpen, FileSpreadsheet, LayoutDashboard, MessageSquare, Settings, SlidersHorizontal, TrendingUp,
  Users,
} from 'lucide-react';

import { usePendingCount } from '../../features/admin';
import AppShell from './AppShell';
import type { NavSection } from './AppShell';

/** The admin area: the shell with the platform navigation and the approval queue's count. */
const AdminLayout = () => {
  // the approval queue's own cache entry: approving or rejecting updates the badge too
  const pending = usePendingCount();

  const sections: NavSection[] = [
    {
      title: 'Platform',
      items: [
        { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/admin/courses/approvals', label: 'Course Approvals', icon: BookCheck, badge: pending },
        { to: '/admin/courses', label: 'All Courses', icon: BookOpen, end: true },
        { to: '/admin/users', label: 'Users', icon: Users },
      ],
    },
    {
      title: 'Business',
      items: [
        { to: '/admin/revenue', label: 'Revenue', icon: TrendingUp },
        { to: '/admin/reports', label: 'Reports', icon: FileSpreadsheet },
      ],
    },
    {
      title: 'Inbox',
      items: [
        { to: '/admin/messages', label: 'Messages', icon: MessageSquare },
        { to: '/admin/notifications', label: 'Notifications', icon: Bell },
      ],
    },
    {
      title: 'Settings',
      items: [
        { to: '/admin/settings', label: 'Platform Settings', icon: SlidersHorizontal },
        { to: '/admin/account', label: 'Account', icon: Settings },
      ],
    },
  ];

  return (
    <AppShell
      roleLabel="Admin"
      sections={sections}
      accountPath="/admin/account"
      notificationsPath="/admin/notifications"
      logoutMessage="You will need to log in again to access the admin console."
    />
  );
};

export default AdminLayout;
