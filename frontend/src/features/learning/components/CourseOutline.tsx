import React from 'react';
import { CheckCircle2, ChevronDown, X } from 'lucide-react';

import { cn } from '../../../shared/lib/cn';
import type { UUID } from '../../../shared/types';
import { IconButton } from '../../../shared/ui/Button';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import type { PlayerLecture, PlayerProgress, PlayerSection } from '../types';
import { LECTURE_KINDS, LectureIcon } from './LectureIcon';

interface CourseOutlineProps {
  sections: PlayerSection[];
  progress: PlayerProgress;
  /** The lecture on screen. */
  selectedId: UUID | null;
  /** The sections the student folded away. */
  collapsed: Record<UUID, boolean>;
  onToggleSection: (sectionId: UUID) => void;
  onSelect: (lecture: PlayerLecture) => void;
  /** Shown in the drawer of a small screen: adds the close button. */
  onClose?: () => void;
}

/** The course's sections and lectures, what is done, and the lecture on screen. */
const CourseOutline = ({ sections, progress, selectedId, collapsed, onToggleSection, onSelect, onClose }: CourseOutlineProps) => (
  <div className="flex min-h-0 flex-1 flex-col">
    <div className="border-b border-line p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">Course Content</h2>
          <p className="mt-0.5 text-xs text-fg-muted">
            {progress.completed_lectures} of {progress.total_lectures} lectures completed
          </p>
        </div>
        {onClose && <IconButton icon={X} label="Close course content" size="sm" onClick={onClose} className="-mr-1 -mt-1" />}
      </div>
      <ProgressBar
        value={progress.progress_percentage}
        size="sm"
        tone={progress.progress_percentage >= 100 ? 'success' : 'primary'}
        label="Course progress"
        className="mt-3"
      />
    </div>

    <nav aria-label="Course outline" className="min-h-0 flex-1 overflow-y-auto pb-4">
      {sections.map((section, index) => {
        const open = !collapsed[section.id];
        return (
          <div key={section.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() => onToggleSection(section.id)}
              aria-expanded={open}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={cn('mt-0.5 shrink-0 text-fg-subtle transition-transform', !open && '-rotate-90')}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                  Section {index + 1}
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-fg">{section.title}</span>
              </span>
              <span className="shrink-0 text-xs text-fg-subtle tabular-nums">
                {section.completed_lectures}/{section.total_lectures}
              </span>
            </button>

            {open && (
              <ul className="pb-2">
                {section.lectures.map((lecture) => {
                  const selected = lecture.id === selectedId;
                  return (
                    <li key={lecture.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(lecture)}
                        aria-current={selected ? 'true' : undefined}
                        className={cn(
                          'relative flex w-full items-center gap-3 py-2.5 pl-11 pr-4 text-left text-sm transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                          selected ? 'bg-primary-soft' : 'hover:bg-surface-muted'
                        )}
                      >
                        {selected && <span aria-hidden="true" className="absolute inset-y-1 left-0 w-1 rounded-r bg-primary" />}
                        <LectureIcon type={lecture.content_type} />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate font-medium', selected ? 'text-primary-fg' : 'text-fg')}>
                            {lecture.title}
                          </span>
                          <span className="block text-xs text-fg-subtle">{LECTURE_KINDS[lecture.content_type]?.label}</span>
                        </span>
                        {lecture.is_completed && (
                          <CheckCircle2 size={16} role="img" aria-label="Completed" className="shrink-0 text-success-fg" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  </div>
);

export default CourseOutline;
