import React, { useState } from 'react';
import { CheckCircle2, ClipboardList, Hourglass, Inbox, MousePointerClick } from 'lucide-react';

import type { UUID } from '../../../shared/types';
import { Card } from '../../../shared/ui/Card';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { StatCard } from '../../../shared/ui/StatCard';
import AssignmentList from '../components/AssignmentList';
import GradingModal from '../components/GradingModal';
import SubmissionList from '../components/SubmissionList';
import { useAssignmentSubmissions, useInstructorAssignments } from '../hooks/useAssignments';
import { useSubmissionDownload } from '../hooks/useAttempts';
import type { AssignmentRow } from '../types';

const HEADER = (
  <PageHeader title="Assignments" description="Review what your students hand in, and grade it with feedback." />
);

/** The instructor's assignments, the hand-ins of the chosen one and the dialog to grade them. */
const InstructorAssignmentsPage = () => {
  const downloadSubmissionFile = useSubmissionDownload();
  const assignments = useInstructorAssignments();
  const [assignmentId, setAssignmentId] = useState<UUID | null>(null);
  const [submissionId, setSubmissionId] = useState<UUID | null>(null);
  const submissions = useAssignmentSubmissions(assignmentId);

  if (assignments.isPending) {
    return (
      <div className="space-y-6">
        {HEADER}
        <PageSpinner className="h-64" />
      </div>
    );
  }

  if (assignments.isError) {
    return (
      <div className="space-y-6">
        {HEADER}
        <ErrorState
          title="We could not load your assignments"
          error={assignments.error}
          onRetry={() => assignments.refetch()}
        />
      </div>
    );
  }

  const rows = assignments.data;
  const selectedAssignment = rows.find((assignment) => assignment.id === assignmentId) || null;
  // the dialog shows the stored hand-in: after a grade it refreshes to "Update Grade"
  const selectedSubmission = (submissions.data || []).find((submission) => submission.id === submissionId) || null;

  const totals = rows.reduce(
    (sum, row) => ({
      submissions: sum.submissions + row.total_submissions,
      graded: sum.graded + row.graded_submissions,
      pending: sum.pending + row.pending_submissions,
    }),
    { submissions: 0, graded: 0, pending: 0 }
  );

  const chooseAssignment = (assignment: AssignmentRow) => {
    setAssignmentId(assignment.id);
    setSubmissionId(null);
  };

  return (
    <div className="space-y-6">
      {HEADER}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Assignments" value={rows.length} hint="across your courses" icon={ClipboardList} />
        <StatCard label="Submissions" value={totals.submissions} hint="handed in so far" icon={Inbox} tone="info" />
        <StatCard
          label="Waiting for a grade"
          value={totals.pending}
          hint={totals.pending > 0 ? 'students are waiting' : 'nothing to grade'}
          icon={Hourglass}
          tone="warning"
        />
        <StatCard label="Graded" value={totals.graded} hint="with a grade and feedback" icon={CheckCircle2} tone="success" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <AssignmentList assignments={rows} selectedId={assignmentId} onSelect={chooseAssignment} />
        </div>

        <div className="lg:col-span-2">
          {selectedAssignment ? (
            <SubmissionList
              key={selectedAssignment.id}
              assignment={selectedAssignment}
              query={submissions}
              selectedId={submissionId}
              onSelect={(submission) => setSubmissionId(submission.id)}
              onDownload={downloadSubmissionFile}
            />
          ) : (
            <Card>
              <EmptyState icon={MousePointerClick} title="Select an Assignment" className="py-16">
                Choose an assignment from the list to view and grade student submissions.
              </EmptyState>
            </Card>
          )}
        </div>
      </div>

      {selectedAssignment && selectedSubmission && (
        <GradingModal
          key={selectedSubmission.id}
          assignment={selectedAssignment}
          submission={selectedSubmission}
          onClose={() => setSubmissionId(null)}
          onDownload={downloadSubmissionFile}
        />
      )}
    </div>
  );
};

export default InstructorAssignmentsPage;
