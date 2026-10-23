import React from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, MessageSquareText, Paperclip } from 'lucide-react';

import { downloadFromUrl } from '../../../shared/lib/download';
import { mediaUrl } from '../../../shared/lib/media';
import { formatDateTime } from '../../../shared/lib/time';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Callout } from '../../../shared/ui/Callout';
import { Card, CardBody, CardHeader } from '../../../shared/ui/Card';
import { Metric } from '../../../shared/ui/StatCard';
import { useToast } from '../../../shared/ui/Toast';
import { useSubmissionDownload } from '../hooks/useAttempts';
import type { AssignmentLecture } from '../types';
import AssignmentSubmissionForm from './AssignmentSubmissionForm';

interface AssignmentPanelProps {
  /** The assignment block of a player lecture (a lecture with more fields is fine). */
  lecture: AssignmentLecture;
  /** Called after the student handed the assignment in. */
  onSubmitted?: () => void;
}

/**
 * An assignment lecture: its details, instructions and materials, then the student's submission
 * (with the grade and the feedback once it is graded) or the form to hand it in.  The title and
 * the description are the lecture header's.
 */
const AssignmentPanel = ({ lecture, onSubmitted }: AssignmentPanelProps) => {
  const toast = useToast();
  const downloadFile = useSubmissionDownload();
  const { submission } = lecture;
  const submitted = Boolean(submission && submission.submitted);

  const downloadMaterial = async () => {
    try {
      // the button is shown only when ``attachment`` is set, and mediaUrl() answers null only for
      // an empty path
      await downloadFromUrl(mediaUrl(lecture.attachment)!, lecture.attachment_name || 'assignment-file');
    } catch (err) {
      toast.error(
        'Failed to download file. The file might not exist or there might be a server issue.',
        'Download Failed'
      );
    }
  };

  return (
    <div className="space-y-5">
      <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Metric label="Due Date" value={lecture.due_date ? formatDateTime(lecture.due_date) : 'No due date'} className="col-span-2 sm:col-span-1" />
        <Metric label="Max Points" value={lecture.max_points || 'Not set'} />
        <Metric label="Passing Score" value={lecture.passing_score ? `${lecture.passing_score}%` : 'Not set'} />
        <div>
          <Badge tone={submitted ? 'success' : 'warning'} dot size="md">
            {submitted ? 'Submitted' : 'Not Submitted'}
          </Badge>
          <p className="mt-1 text-xs text-fg-subtle">Status</p>
        </div>
      </Card>

      {lecture.instructions && (
        <Card>
          <CardHeader as="h3" title="Instructions" icon={FileText} />
          <CardBody>
            <div className="whitespace-pre-wrap text-sm leading-6 text-fg">{lecture.instructions}</div>
          </CardBody>
        </Card>
      )}

      {lecture.attachment && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger-fg">
            <Paperclip size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{lecture.attachment_name || 'Assignment materials'}</p>
            <p className="text-xs text-fg-subtle">Materials from your instructor</p>
          </div>
          <Button variant="secondary" size="sm" icon={Download} onClick={downloadMaterial}>
            Download
          </Button>
        </Card>
      )}

      {submitted && submission ? (
        <Card>
          <CardHeader
            as="h3"
            title="Your Submission"
            icon={CheckCircle2}
            description={`Submitted on ${submission.submission_date ? formatDateTime(submission.submission_date) : 'a date that is not available'}`}
            action={submission.is_late ? <Badge tone="danger" icon={AlertTriangle}>Late</Badge> : undefined}
          />
          <CardBody className="space-y-4">
            {submission.submission_text && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Text Submission</p>
                <div className="whitespace-pre-wrap rounded-lg border border-line bg-surface-muted/60 p-3 text-sm text-fg">
                  {submission.submission_text}
                </div>
              </div>
            )}

            {submission.has_file && submission.original_filename && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Uploaded File</p>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-muted/60 p-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-fg">
                    <FileText size={16} aria-hidden="true" className="shrink-0 text-fg-subtle" />
                    <span className="truncate">{submission.original_filename}</span>
                  </span>
                  <Button variant="ghost" size="xs" icon={Download} onClick={() => downloadFile(submission)}>
                    Download
                  </Button>
                </div>
              </div>
            )}

            {submission.graded ? (
              <div className="rounded-xl border border-line p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-fg-muted">Grade</p>
                  <p className="text-xl font-semibold text-fg tabular-nums">
                    {submission.grade}/{lecture.max_points}
                  </p>
                </div>
                {submission.feedback && (
                  <Callout tone="info" icon={MessageSquareText} title="Feedback from your instructor" className="mt-3">
                    <span className="italic">{submission.feedback}</span>
                  </Callout>
                )}
              </div>
            ) : (
              <Callout tone="neutral">Your instructor has not graded this hand-in yet.</Callout>
            )}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader as="h3" title="Hand in your work" description="Write your answer, attach a file, or both." />
          <CardBody>
            <AssignmentSubmissionForm key={lecture.assignment_id} assignment={lecture} onSubmitted={onSubmitted} />
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default AssignmentPanel;
