import React from 'react';
import { Calendar, CheckCircle2, ClipboardList, Users } from 'lucide-react';

import { cn } from '../../../shared/lib/cn';
import { formatDateTime } from '../../../shared/lib/time';
import type { UUID } from '../../../shared/types';
import { Badge } from '../../../shared/ui/Badge';
import { Card, CardHeader } from '../../../shared/ui/Card';
import EmptyState from '../../../shared/ui/EmptyState';
import type { AssignmentRow } from '../types';

interface AssignmentListProps {
  assignments: AssignmentRow[];
  /** The assignment whose hand-ins are shown, if one was chosen. */
  selectedId: UUID | null;
  onSelect: (assignment: AssignmentRow) => void;
}

/** The assignments of the instructor's courses; choosing one shows its hand-ins. */
const AssignmentList = ({ assignments, selectedId, onSelect }: AssignmentListProps) => (
  <Card className="overflow-hidden">
    <CardHeader title="Your Assignments" description="Select an assignment to view submissions" />

    {assignments.length === 0 ? (
      <EmptyState icon={ClipboardList} title="No assignments found" className="py-10">
        Create assignments in your courses to see them here.
      </EmptyState>
    ) : (
      <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto">
        {assignments.map((assignment) => {
          const selected = selectedId === assignment.id;
          return (
            <li key={assignment.id}>
              <button
                type="button"
                onClick={() => onSelect(assignment)}
                aria-pressed={selected}
                className={cn(
                  'relative block w-full px-5 py-4 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  selected ? 'bg-primary-soft/60' : 'hover:bg-surface-muted/60'
                )}
              >
                {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary" />}
                <div className="flex items-start justify-between gap-3">
                  <h3 className={cn('line-clamp-2 font-medium', selected ? 'text-primary-fg' : 'text-fg')}>
                    {assignment.title}
                  </h3>
                  {assignment.pending_submissions > 0 && (
                    <Badge tone="warning">{assignment.pending_submissions} to grade</Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-fg-muted">{assignment.course_title}</p>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
                  <span className="flex items-center gap-1">
                    <Users size={12} aria-hidden="true" />
                    {assignment.total_submissions} submissions
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={12} aria-hidden="true" />
                    {assignment.graded_submissions} graded
                  </span>
                  {assignment.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} aria-hidden="true" />
                      Due: {formatDateTime(assignment.due_date)}
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </Card>
);

export default AssignmentList;
