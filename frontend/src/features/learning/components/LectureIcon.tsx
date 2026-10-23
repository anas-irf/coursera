import React from 'react';
import { BookOpen, ClipboardList, FileQuestion, PlayCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../../../shared/lib/cn';
import type { ContentType } from '../../../shared/types';

/** How each kind of lecture is drawn and called, in one place (outline, header, labels). */
export const LECTURE_KINDS: Record<ContentType, { icon: LucideIcon; label: string; color: string }> = {
  video: { icon: PlayCircle, label: 'Video', color: 'text-primary-fg' },
  reading: { icon: BookOpen, label: 'Reading', color: 'text-success-fg' },
  quiz: { icon: FileQuestion, label: 'Quiz', color: 'text-warning-fg' },
  assignment: { icon: ClipboardList, label: 'Assignment', color: 'text-plus-fg' },
};

interface LectureIconProps {
  type: ContentType;
  size?: number;
  className?: string;
}

/** The icon of a lecture's kind, in the kind's colour. */
export const LectureIcon = ({ type, size = 16, className }: LectureIconProps) => {
  const kind = LECTURE_KINDS[type] || LECTURE_KINDS.reading;
  const Icon = kind.icon;
  return <Icon size={size} aria-hidden="true" className={cn('shrink-0', kind.color, className)} />;
};

export default LectureIcon;
