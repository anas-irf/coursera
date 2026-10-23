import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Clock, ListChecks, PlayCircle, RotateCcw } from 'lucide-react';

import { timeAgo } from '../../../shared/lib/time';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import CourseThumbnail from '../../../shared/ui/CourseThumbnail';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import type { EnrolledCourse } from '../types';

interface EnrolledCourseCardProps {
  course: EnrolledCourse;
  /** Leaves out the next lesson and the last visit. */
  compact?: boolean;
}

/**
 * A course the student is enrolled in, with its progress and the button that opens the player.
 * ``compact`` leaves out the next lesson and the last visit (the home page lists three of them).
 */
const EnrolledCourseCard = ({ course, compact = false }: EnrolledCourseCardProps) => {
  const navigate = useNavigate();
  const completed = course.status === 'completed';
  const progress = Math.round(course.progress || 0);
  // the server words it ("3 hours", "2 days"); less than an hour reads "0 hours" and is left out
  const remaining = course.estimated_completion;
  const left = !completed && remaining && !remaining.startsWith('0 ') ? ` · about ${remaining} left` : '';

  return (
    <Card className="group flex flex-col overflow-hidden" interactive>
      <div className="relative">
        <CourseThumbnail course={course} className="aspect-video w-full" />
        {completed && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
            <Award size={12} aria-hidden="true" />
            Completed
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug text-fg">{course.title}</h3>
        <p className="mt-1 truncate text-sm text-fg-muted">{course.instructor}</p>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-fg-muted">
              {course.completed_lessons || 0} of {course.total_lessons || 0} lessons
            </span>
            <span className="font-semibold text-fg tabular-nums">{progress}%</span>
          </div>
          <ProgressBar
            value={progress}
            size="sm"
            tone={completed ? 'success' : 'primary'}
            label={`Progress in ${course.title}`}
          />
        </div>

        {!compact && (
          <ul className="mt-4 space-y-1.5 text-xs text-fg-muted">
            {!completed && course.next_lesson && (
              <li className="flex items-center gap-1.5">
                <ListChecks size={14} aria-hidden="true" className="shrink-0 text-fg-subtle" />
                <span className="truncate">Next: {course.next_lesson}</span>
              </li>
            )}
            {(course.last_accessed || left) && (
              <li className="flex items-center gap-1.5">
                <Clock size={14} aria-hidden="true" className="shrink-0 text-fg-subtle" />
                <span className="truncate">
                  {course.last_accessed ? `Last visited ${timeAgo(course.last_accessed)}` : 'Not visited yet'}
                  {left}
                </span>
              </li>
            )}
          </ul>
        )}

        <div className="mt-auto pt-4">
          <Button
            block
            variant={completed ? 'secondary' : 'primary'}
            icon={completed ? RotateCcw : PlayCircle}
            onClick={() => navigate(`/courses/${course.course_id}/learn`)}
          >
            {completed ? 'Review Course' : 'Continue Learning'}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default EnrolledCourseCard;
