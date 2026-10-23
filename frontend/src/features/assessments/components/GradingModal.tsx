import React, { useState } from 'react';
import { Download, FileText } from 'lucide-react';

import { errorMessage } from '../../../shared/api/errors';
import { formatDateTime } from '../../../shared/lib/time';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { Input, Textarea } from '../../../shared/ui/Input';
import Modal, { ModalFooter } from '../../../shared/ui/Modal';
import { Metric } from '../../../shared/ui/StatCard';
import { useToast } from '../../../shared/ui/Toast';
import { useGradeSubmission } from '../hooks/useAssignments';
import { percentOf, submissionStatus } from '../lib/submissions';
import type { AssignmentRow, InstructorSubmission } from '../types';
import { SUBMISSION_TONES } from './SubmissionList';

interface GradingModalProps {
  assignment: AssignmentRow;
  submission: InstructorSubmission;
  onClose: () => void;
  /** Saves the file of the hand-in (``useSubmissionDownload``). */
  onDownload: (submission: InstructorSubmission) => void;
}

/** The dialog in which one hand-in is read and graded. */
const GradingModal = ({ assignment, submission, onClose, onDownload }: GradingModalProps) => {
  const toast = useToast();
  const grade = useGradeSubmission(assignment.id);
  const [values, setValues] = useState({
    // a grade of 0 is a grade
    grade: submission.grade === null || submission.grade === undefined ? '' : String(submission.grade),
    feedback: submission.feedback || '',
  });
  const { label, tone } = submissionStatus(submission);

  const handleGrade = () => {
    if (values.grade === '') return;

    grade.mutate(
      { submissionId: submission.id, grade: parseFloat(values.grade), feedback: values.feedback },
      {
        onSuccess: () => toast.success('Assignment graded successfully!', 'Grade Submitted'),
        onError: (err) =>
          toast.error(errorMessage(err, 'Error grading assignment. Please try again.'), 'Grading Failed'),
      }
    );
  };

  return (
    <Modal
      title={`Grade Submission: ${submission.student_name}`}
      description={`${assignment.title} · Submitted ${formatDateTime(submission.submitted_at)}`}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-6 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface-muted/50 p-4 sm:grid-cols-4">
          <Metric label="Max Points" value={assignment.max_points} />
          <Metric label="Passing Score" value={`${assignment.passing_score}%`} />
          <div>
            <Badge tone={SUBMISSION_TONES[tone]} dot size="md">
              {label}
            </Badge>
            <p className="mt-1 text-xs text-fg-subtle">Submission Status</p>
          </div>
          {assignment.due_date && <Metric label="Due Date" value={formatDateTime(assignment.due_date)} />}
        </div>

        <section aria-labelledby="submission-content" className="space-y-3">
          <h3 id="submission-content" className="text-sm font-semibold text-fg">
            Submission Content
          </h3>

          {submission.submission_text && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Text Submission</p>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-line bg-surface-muted/50 p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-fg">{submission.submission_text}</pre>
              </div>
            </div>
          )}

          {submission.has_file && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">File Submission</p>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted/50 p-3">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-fg">
                  <FileText size={18} aria-hidden="true" className="shrink-0 text-primary-fg" />
                  <span className="truncate">{submission.original_filename}</span>
                </span>
                <Button variant="secondary" size="sm" icon={Download} onClick={() => onDownload(submission)}>
                  Download
                </Button>
              </div>
            </div>
          )}

          {!submission.submission_text && !submission.has_file && (
            <p className="rounded-lg border border-dashed border-line-strong p-4 text-center text-sm text-fg-muted">
              This hand-in has no text and no file.
            </p>
          )}
        </section>

        <section aria-labelledby="grading-title" className="space-y-4 border-t border-line pt-6">
          <h3 id="grading-title" className="text-sm font-semibold text-fg">
            Grading
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Grade (out of ${assignment.max_points})`}>
              <Input
                type="number"
                min="0"
                max={assignment.max_points}
                step="0.01"
                data-autofocus
                value={values.grade}
                onChange={(e) => setValues((prev) => ({ ...prev, grade: e.target.value }))}
                placeholder="Enter grade"
              />
            </Field>

            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">Percentage</p>
              <div className="flex h-10 items-center rounded-lg border border-line bg-surface-muted px-3 text-sm font-semibold text-fg tabular-nums">
                {percentOf(values.grade, assignment.max_points)}
              </div>
            </div>
          </div>

          <Field label="Feedback (Optional)">
            <Textarea
              rows={4}
              value={values.feedback}
              onChange={(e) => setValues((prev) => ({ ...prev, feedback: e.target.value }))}
              placeholder="Provide feedback to help the student improve..."
            />
          </Field>
        </section>
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleGrade} disabled={values.grade === ''} loading={grade.isPending}>
          {submission.grade !== null ? 'Update Grade' : 'Submit Grade'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default GradingModal;
