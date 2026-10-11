import React from 'react';
import { AlertCircle, Award, Bell, BookOpen, Check, Clock, FileText, MessageSquare, X } from 'lucide-react';

const ICONS = {
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

/** Icon of a notification type. */
export default function NotificationIcon({ type, size = 16 }) {
  const [Icon, color] = ICONS[type] || [Bell, 'text-blue-500'];
  return <Icon size={size} className={color} />;
}
