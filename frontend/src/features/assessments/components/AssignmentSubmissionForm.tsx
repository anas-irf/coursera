import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { FileUp, Send } from 'lucide-react';

import { errorMessage } from '../../../shared/api/errors';
import { Button } from '../../../shared/ui/Button';
import { Callout } from '../../../shared/ui/Callout';
import { Field } from '../../../shared/ui/Field';
import FileDrop from '../../../shared/ui/FileDrop';
import { Textarea } from '../../../shared/ui/Input';
import { useToast } from '../../../shared/ui/Toast';
import { useSubmitAssignment } from '../hooks/useAttempts';
import type { AssignmentLecture } from '../types';

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.zip'];

interface AssignmentSubmissionFormProps {
  /** What the form reads of the assignment lecture. */
  assignment: Pick<AssignmentLecture, 'assignment_id' | 'due_date' | 'allow_late_submission'>;
  onSubmitted?: () => void;
}

/** Hand in an assignment as text, a file, or both. */
const AssignmentSubmissionForm = ({ assignment, onSubmitted }: AssignmentSubmissionFormProps) => {
  const submit = useSubmitAssignment();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const toast = useToast();

  // a file that is refused leaves the box empty again, so the same file can be chosen after fixing it
  const pick = (chosen: File, reset: () => void) => {

    if (chosen.size > MAX_BYTES) {
      toast.warning('File size cannot exceed 50MB', 'File Too Large');
      reset();
      return;
    }

    const extension = '.' + (chosen.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_TYPES.includes(extension)) {
      toast.warning(
        `File type ${extension} not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`,
        'Invalid File Type'
      );
      reset();
      return;
    }

    setFile(chosen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!text.trim() && !file) {
      toast.warning('Please provide either text submission or upload a file', 'Missing Submission');
      return;
    }

    const formData = new FormData();
    formData.append('submission_text', text);
    if (file) formData.append('submission_file', file);

    try {
      await submit.mutateAsync({ assignmentId: assignment.assignment_id, formData });
      toast.success('Assignment submitted successfully!', 'Submission Complete');
      if (onSubmitted) onSubmitted();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to submit assignment. Please try again.'), 'Submission Failed');
    }
  };

  const submitting = submit.isPending;
  const isLate = !!assignment.due_date && new Date() > new Date(assignment.due_date);
  const blocked = isLate && !assignment.allow_late_submission;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Text Submission (Optional)">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Enter your submission text here..."
        />
      </Field>

      <Field label="File Upload (Optional)">
        <FileDrop
          accept={ALLOWED_TYPES.join(',')}
          title="Click to upload file, or drop it here"
          hint="PDF, DOC, DOCX, TXT, JPG, PNG, ZIP (Max 50MB)"
          icon={FileUp}
          buttonLabel="Choose file"
          onFile={pick}
          file={file}
          onRemove={() => setFile(null)}
        />
      </Field>

      {isLate && assignment.allow_late_submission && (
        <Callout tone="warning">This assignment is past the due date. Late submissions may be penalized.</Callout>
      )}

      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-end">
        {blocked && <p className="text-sm font-medium text-danger-fg">Late submissions not allowed for this assignment</p>}
        <Button type="submit" icon={Send} loading={submitting} disabled={blocked}>
          {submitting ? 'Submitting...' : 'Submit Assignment'}
        </Button>
      </div>
    </form>
  );
};

export default AssignmentSubmissionForm;
