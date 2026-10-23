import React from 'react';
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Clock, ExternalLink } from 'lucide-react';

import { safeHtml } from '../../../shared/lib/html';
import { mediaUrl } from '../../../shared/lib/media';
import type { UUID } from '../../../shared/types';
import { Badge } from '../../../shared/ui/Badge';
import { Button, ButtonAnchor } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import EmptyState from '../../../shared/ui/EmptyState';
import { AssignmentPanel, QuizRunner } from '../../assessments';
import type { PlayerLecture } from '../types';
import { LECTURE_KINDS, LectureIcon } from './LectureIcon';
import VideoLecture from './VideoLecture';

// the icon is exported here too: the player used to take it from this module
export { LectureIcon } from './LectureIcon';

interface LectureContentProps {
  courseId: UUID;
  /** The selected lecture; ``null`` shows the "no lecture selected" message. */
  lecture: PlayerLecture | null;
  onComplete: (lectureId: UUID) => void;
  completing?: boolean;
  /** Called after a quiz was handed in or an assignment submitted, to reload the progress. */
  onReload?: () => unknown;
  /** Called with ``true`` while a quiz attempt is open and with ``false`` when it is not. */
  onQuizActiveChange?: (active: boolean) => void;
  /** The lectures before and after this one in the outline, and the way to open them. */
  previous?: PlayerLecture | null;
  next?: PlayerLecture | null;
  onNavigate?: (lecture: PlayerLecture) => void;
}

/** The selected lecture: its header with the completion state and the content of its kind. */
const LectureContent = ({
  courseId,
  lecture,
  onComplete,
  completing = false,
  onReload,
  onQuizActiveChange,
  previous = null,
  next = null,
  onNavigate,
}: LectureContentProps) => {
  if (!lecture) {
    return (
      <EmptyState icon={BookOpen} title="No lecture selected" className="h-full min-h-[50vh] py-16">
        Select a lecture from the course content to start learning.
      </EmptyState>
    );
  }

  const canComplete =
    !lecture.is_completed && (lecture.content_type === 'video' || lecture.content_type === 'reading');
  const kind = LECTURE_KINDS[lecture.content_type];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
            <LectureIcon type={lecture.content_type} size={14} />
            {kind ? kind.label : 'Lecture'}
          </p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-fg sm:text-2xl">{lecture.title}</h2>
          {lecture.description && <p className="mt-1.5 text-sm text-fg-muted">{lecture.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canComplete && (
            <Button variant="success" icon={CheckCircle2} onClick={() => onComplete(lecture.id)} loading={completing}>
              Mark Complete
            </Button>
          )}
          {lecture.is_completed && (
            <Badge tone="success" icon={CheckCircle2} size="md">
              Completed
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-6">
        {lecture.content_type === 'video' && <VideoLecture courseId={courseId} lecture={lecture} />}

        {lecture.content_type === 'reading' && (
          <Card className="p-5 sm:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <p className="flex items-center gap-1.5 text-sm text-fg-muted">
                <Clock size={14} aria-hidden="true" />
                Estimated reading time: {lecture.estimated_reading_time} minutes
              </p>
              {lecture.file_url && (
                <ButtonAnchor
                  href={mediaUrl(lecture.file_url) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  size="sm"
                  icon={ExternalLink}
                >
                  Open the document
                </ButtonAnchor>
              )}
            </div>
            <article
              key={lecture.id}
              className="reading-content"
              dangerouslySetInnerHTML={{ __html: safeHtml(lecture.content) || '<p>Reading content not available</p>' }}
            />
          </Card>
        )}

        {lecture.content_type === 'quiz' && (
          <QuizRunner key={lecture.id} lecture={lecture} onFinished={onReload} onActiveChange={onQuizActiveChange} />
        )}

        {lecture.content_type === 'assignment' && (
          <AssignmentPanel key={lecture.id} lecture={lecture} onSubmitted={onReload} />
        )}
      </div>

      {onNavigate && (previous || next) && (
        <nav aria-label="Lecture navigation" className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-6">
          {previous ? (
            <Button variant="secondary" icon={ChevronLeft} onClick={() => onNavigate(previous)}>
              Previous lecture
            </Button>
          ) : (
            <span />
          )}
          {next && (
            <Button iconRight={ChevronRight} onClick={() => onNavigate(next)}>
              Next lecture
            </Button>
          )}
        </nav>
      )}
    </div>
  );
};

export default LectureContent;
