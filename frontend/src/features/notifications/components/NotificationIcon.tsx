import React from 'react';
import {
  AlertCircle, Award, Bell, BookOpen, Check, Clock, CreditCard, FileText, Megaphone, MessageSquare, Star, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../../../shared/lib/cn';
import { TONE_SOFT } from '../../../shared/ui/Badge';
import type { Tone } from '../../../shared/ui/Badge';
import type { NotificationType } from '../types';

type IconAndTone = [icon: LucideIcon, tone: Tone];

// not every type has an icon of its own: the others get the bell
const ICONS: Partial<Record<NotificationType, IconAndTone>> = {
  enrollment: [BookOpen, 'primary'],
  course_approved: [Check, 'success'],
  course_published: [Check, 'success'],
  course_rejected: [X, 'danger'],
  course_submission: [FileText, 'info'],
  course_update: [BookOpen, 'info'],
  assignment_due: [Clock, 'warning'],
  assignment_graded: [FileText, 'primary'],
  quiz_available: [FileText, 'info'],
  certificate_earned: [Award, 'warning'],
  payment_success: [CreditCard, 'success'],
  payment_failed: [CreditCard, 'danger'],
  announcement: [Megaphone, 'plus'],
  message: [MessageSquare, 'plus'],
  review: [Star, 'warning'],
  system: [AlertCircle, 'neutral'],
};

const FALLBACK: IconAndTone = [Bell, 'primary'];

interface NotificationIconProps {
  type: NotificationType;
  size?: 'sm' | 'md';
}

/** The icon of a notification type, on a tile in the colour of what it is about. */
export default function NotificationIcon({ type, size = 'md' }: NotificationIconProps) {
  const [Icon, tone] = ICONS[type] || FALLBACK;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg',
        size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
        TONE_SOFT[tone]
      )}
    >
      <Icon size={size === 'sm' ? 15 : 17} aria-hidden="true" />
    </span>
  );
}
