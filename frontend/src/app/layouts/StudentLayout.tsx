import React from 'react';
import { Award, Bell, BookOpen, Compass, Crown, GraduationCap, Home, MessageSquare, Settings, Trophy } from 'lucide-react';

import { PlusSidebarCard, PlusWelcomeDialog, useStripeReturn, useSubscription } from '../../features/billing';
import { Badge } from '../../shared/ui/Badge';
import AppShell from './AppShell';
import type { NavSection } from './AppShell';

const SECTIONS: NavSection[] = [
  {
    title: 'Learn',
    items: [
      { to: '/student', label: 'Home', icon: Home, end: true },
      { to: '/student/my-learning', label: 'My Learning', icon: BookOpen },
      { to: '/student/explore', label: 'Explore', icon: Compass },
    ],
  },
  {
    title: 'Progress',
    items: [
      { to: '/student/grades', label: 'Grades', icon: GraduationCap },
      { to: '/student/achievements', label: 'Achievements', icon: Trophy },
      { to: '/student/certificates', label: 'Certificates', icon: Award },
    ],
  },
  {
    title: 'Inbox',
    items: [
      { to: '/student/messages', label: 'Messages', icon: MessageSquare },
      { to: '/student/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/student/checkout', label: 'Coursera Plus', icon: Crown },
      { to: '/student/account', label: 'Settings', icon: Settings },
    ],
  },
];

/** The student area: the shell with the learner's navigation and the Plus membership. */
const StudentLayout = () => {
  const subscription = useSubscription();
  // back from Stripe: the membership is confirmed and celebrated once
  const { welcome, dismiss } = useStripeReturn({ onActivated: subscription.refresh });

  return (
    <>
      <AppShell
        roleLabel="Student"
        sections={SECTIONS}
        accountPath="/student/account"
        notificationsPath="/student/notifications"
        sidebarFooter={<PlusSidebarCard />}
        accountBadge={subscription.isPlus ? <Badge tone="plus" icon={Crown}>Plus member</Badge> : null}
        logoutMessage="You will need to log in again to continue learning."
      />
      {welcome && <PlusWelcomeDialog onClose={dismiss} />}
    </>
  );
};

export default StudentLayout;
