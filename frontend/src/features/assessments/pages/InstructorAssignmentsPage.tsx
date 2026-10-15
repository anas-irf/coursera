import React, { useState } from 'react';
import { FileText } from 'lucide-react';

import type { UUID } from '../../../shared/types';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import AssignmentList from '../components/AssignmentList';
import GradingModal from '../components/GradingModal';
import SubmissionList from '../components/SubmissionList';
import { useAssignmentSubmissions, useInstructorAssignments } from '../hooks/useAssignments';
import { useSubmissionDownload } from '../hooks/useAttempts';
import type { AssignmentRow } from '../types';

/** The instructor's assignments, the hand-ins of the chosen one and the dialog to grade them. */
const InstructorAssignmentsPage = () => {
  const downloadSubmissionFile = useSubmissionDownload();
  const assignments = useInstructorAssignments();
  const [assignmentId, setAssignmentId] = useState<UUID | null>(null);
  const [submissionId, setSubmissionId] = useState<UUID | null>(null);
  const submissions = useAssignmentSubmissions(assignmentId);

  if (assignments.isPending) {
    return <PageSpinner color="border-blue-600" />;
  }

  if (assignments.isError) {
    return (
      <ErrorState
        title="We could not load your assignments"
        error={assignments.error}
        onRetry={() => assignments.refetch()}
      />
    );
  }

  const selectedAssignment = assignments.data.find((assignment) => assignment.id === assignmentId) || null;
  // the dialog shows the stored hand-in: after a grade it refreshes to "Update Grade"
  const selectedSubmission = (submissions.data || []).find((submission) => submission.id === submissionId) || null;

  const chooseAssignment = (assignment: AssignmentRow) => {
    setAssignmentId(assignment.id);
    setSubmissionId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assignment Management</h1>
        <p className="text-gray-600 mt-1">Review and grade student assignment submissions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <AssignmentList
            assignments={assignments.data}
            selectedId={assignmentId}
            onSelect={chooseAssignment}
          />
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
            <div className="bg-white rounded-lg shadow p-12">
              <div className="text-center text-gray-500">
                <FileText size={64} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Assignment</h3>
                <p>Choose an assignment from the left panel to view and grade student submissions.</p>
              </div>
            </div>
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
