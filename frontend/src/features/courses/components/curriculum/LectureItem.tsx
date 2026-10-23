import React from 'react';
import { BookOpen, ClipboardList, GripVertical, HelpCircle, Pencil, PlayCircle, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { cn } from '../../../../shared/lib/cn';
import type { ContentType } from '../../../../shared/types';
import { Badge, TONE_SOFT } from '../../../../shared/ui/Badge';
import type { Tone } from '../../../../shared/ui/Badge';
import { IconButton } from '../../../../shared/ui/Button';
import type { CurriculumLecture } from '../../types';

interface LectureItemProps {
  lecture: CurriculumLecture;
  onEdit: () => void;
  onDelete: () => void;
}

/** How each kind of lecture is drawn and called. */
export const LECTURE_KINDS: Record<ContentType, { label: string; icon: LucideIcon; tone: Tone }> = {
  video: { label: 'Video Lecture', icon: PlayCircle, tone: 'primary' },
  reading: { label: 'Reading', icon: BookOpen, tone: 'success' },
  quiz: { label: 'Quiz', icon: HelpCircle, tone: 'warning' },
  assignment: { label: 'Assignment', icon: ClipboardList, tone: 'plus' },
};

/** "15%" for graded work, "Ungraded" for practice, nothing for a video or a reading. */
const weightOf = (lecture: CurriculumLecture): string | null => {
  const settings =
    lecture.content_type === 'quiz'
      ? lecture.quiz_settings
      : lecture.content_type === 'assignment'
        ? lecture.assignment_settings
        : null;
  if (!settings || settings.weight === undefined || settings.weight === null) return null;
  return Number(settings.weight) > 0 ? `${settings.weight}%` : 'Ungraded';
};

/** One lecture of a section: drag it by its handle to move it. */
const LectureItem = ({ lecture, onEdit, onDelete }: LectureItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lecture.id,
    data: {
      type: 'lecture',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const kind = LECTURE_KINDS[lecture.content_type] || LECTURE_KINDS.reading;
  const Icon = kind.icon;
  const weight = weightOf(lecture);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2.5 transition-colors hover:border-line-strong sm:gap-3 sm:px-3',
        isDragging && 'relative z-10 opacity-80 shadow-pop'
      )}
    >
      <button
        type="button"
        aria-label={`Move ${lecture.title || 'lecture'}`}
        className="mt-1.5 shrink-0 cursor-grab touch-none rounded text-fg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', TONE_SOFT[kind.tone])}>
        <Icon size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 min-w-0 truncate text-sm font-medium text-fg">{lecture.title}</span>
          <Badge>{kind.label}</Badge>
          {weight && <Badge tone={weight === 'Ungraded' ? 'neutral' : 'success'}>{weight}</Badge>}
          {lecture.is_preview && <Badge tone="info">Preview</Badge>}
        </div>
        {lecture.description && <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{lecture.description}</p>}
      </div>
      <div className="flex shrink-0 items-center">
        <IconButton icon={Pencil} label="Edit Lecture" size="sm" onClick={onEdit} />
        <IconButton icon={Trash2} label="Delete Lecture" size="sm" onClick={onDelete} />
      </div>
    </div>
  );
};

export default LectureItem;
