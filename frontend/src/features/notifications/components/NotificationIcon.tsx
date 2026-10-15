import React from 'react';
import { AlertCircle, Award, Bell, BookOpen, Check, Clock, FileText, MessageSquare, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { NotificationType } from '../types';

type IconAndColor = [icon: LucideIcon, color: string];

// not every type has an icon of its own: the others get the bell
const ICONS: Partial<Record<NotificationType, IconAndColor>> = {
  enrollment: [BookOpen, 'text-blue-500'],
  course_approved: [Check, 'text-green-500'],
  course_published: [Check, 'text-green-500'],
  course_rejected: [X, 'text-red-500'],
  course_submission: [FileText, 'text-blue-500'],
  assignment_due: [Clock, 'text-orange-500'],
  assignment_graded: [FileText, 'text-indigo-500'],
  certificate_earned: [Award, 'text-yellow-500'],
  announcement: [MessageSquare, 'text-purple-500'],
  message: [MessageSquare, 'text-purple-500'],
  system: [AlertCircle, 'text-gray-500'],
};

const FALLBACK: IconAndColor = [Bell, 'text-blue-500'];

interface NotificationIconProps {
  type: NotificationType;
  size?: number;
}

/** Icon of a notification type. */
export default function NotificationIcon({ type, size = 16 }: NotificationIconProps) {
  const [Icon, color] = ICONS[type] || FALLBACK;
  return <Icon size={size} className={color} />;
}
