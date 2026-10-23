import React, { useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Download, FileText, Star, Users } from 'lucide-react';

import { cn } from '../../../shared/lib/cn';
import { formatDateTime } from '../../../shared/lib/time';
import type { UUID } from '../../../shared/types';
import Avatar from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import type { Tone } from '../../../shared/ui/Badge';
import { IconButton } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { SearchInput, Select } from '../../../shared/ui/Input';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { isSubmissionFilter, submissionStatus, visibleSubmissions } from '../lib/submissions';
import type { SubmissionFilter, SubmissionTone } from '../lib/submissions';
import type { AssignmentRow, InstructorSubmission } from '../types';

/** The badge tone of each state of a hand-in. */
export const SUBMISSION_TONES: Record<SubmissionTone, Tone> = {
  graded: 'success',
  late: 'danger',
  pending: 'warning',
};

interface SubmissionListProps {
  assignment: AssignmentRow;
  /** The query of the assignment's hand-ins (``useAssignmentSubmissions``). */
  query: UseQueryResult<InstructorSubmission[]>;
  /** The hand-in that is open in the grading dialog, if any. */
  selectedId: UUID | null;
  onSelect: (submission: InstructorSubmission) => void;
  /** Saves the file of a hand-in (``useSubmissionDownload``). */
  onDownload: (submission: InstructorSubmission) => void;
}

/** The hand-ins of one assignment with a search, a status filter and a way to open each. */
const SubmissionList = ({ assignment, query, selectedId, onSelect, onDownload }: SubmissionListProps) => {
  const [status, setStatus] = useState<SubmissionFilter>('all');
  const [search, setSearch] = useState('');

  const submissions = query.data || [];
  const shown = visibleSubmissions(submissions, { status, search });
  const graded = submissions.filter((submission) => submission.grade !== null).length;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-fg">{assignment.title}</h2>
            <p className="mt-0.5 text-sm text-fg-muted">{assignment.course_title}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Badge tone="primary" icon={Users}>
              {submissions.length} submissions
            </Badge>
            <Badge tone="success" icon={CheckCircle2}>
              {graded} graded
            </Badge>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <SearchInput
            label="Search students"
            placeholder="Search students..."
            value={search}
            onChange={setSearch}
            className="flex-1"
          />
          <Select
            aria-label="Show"
            value={status}
            onChange={(e) => {
              const chosen = e.target.value;
              if (isSubmissionFilter(chosen)) setStatus(chosen);
            }}
            className="sm:w-52"
          >
            <option value="all">All Submissions</option>
            <option value="pending">Pending Review</option>
            <option value="graded">Graded</option>
            <option value="late">Late Submissions</option>
          </Select>
        </div>
      </div>

      {query.isPending && <PageSpinner className="h-48" />}

      {query.isError && (
        <ErrorState title="We could not load the submissions" error={query.error} onRetry={() => query.refetch()} />
      )}

      {query.isSuccess && shown.length === 0 && (
        <EmptyState icon={FileText} title="No submissions found" className="py-12">
          {search ? 'Try adjusting your search' : 'No students have submitted this assignment yet.'}
        </EmptyState>
      )}

      {query.isSuccess && shown.length > 0 && (
        <ul className="divide-y divide-line">
          {shown.map((submission) => {
            const { label, tone } = submissionStatus(submission);
            const selected = selectedId === submission.id;
            return (
              <li
                key={submission.id}
                className={cn('flex items-center gap-2 pr-3 transition-colors', selected ? 'bg-primary-soft/60' : 'hover:bg-surface-muted/60')}
              >
                <button
                  type="button"
                  onClick={() => onSelect(submission)}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  aria-label={`Open the submission of ${submission.student_name}`}
                >
                  <Avatar name={submission.student_name} className="h-9 w-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-medium text-fg">{submission.student_name}</h3>
                      <Badge tone={SUBMISSION_TONES[tone]} dot>
                        {label}
                      </Badge>
                      {submission.is_late && tone !== 'late' && (
                        <AlertTriangle size={14} aria-label="Handed in late" role="img" className="text-danger-fg" />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
                      <span className="flex items-center gap-1">
                        <Clock size={12} aria-hidden="true" />
                        {formatDateTime(submission.submitted_at)}
                      </span>
                      {submission.grade !== null && (
                        <span className="flex items-center gap-1 font-medium text-success-fg">
                          <Star size={12} aria-hidden="true" />
                          {submission.grade}/{assignment.max_points} pts
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-fg-subtle" />
                </button>

                {submission.has_file && (
                  <IconButton
                    icon={Download}
                    size="sm"
                    label={`Download the file of ${submission.student_name}`}
                    title="Download submission file"
                    onClick={() => onDownload(submission)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

export default SubmissionList;
