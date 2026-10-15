import React, { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { errorMessage } from '../../../shared/api/errors';
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    if (!chosen) return;

    if (chosen.size > MAX_BYTES) {
      toast.warning('File size cannot exceed 50MB', 'File Too Large');
      return;
    }

    const extension = '.' + (chosen.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_TYPES.includes(extension)) {
      toast.warning(
        `File type ${extension} not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`,
        'Invalid File Type'
      );
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
      toast.error(
        errorMessage(err, 'Failed to submit assignment. Please try again.'),
        'Submission Failed'
      );
    }
  };

  const submitting = submit.isPending;
  const isLate = !!assignment.due_date && new Date() > new Date(assignment.due_date);
  const blocked = isLate && !assignment.allow_late_submission;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="submissionText" className="block text-sm font-medium text-gray-700 mb-2">
          Text Submission (Optional)
        </label>
        <textarea
          id="submissionText"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Enter your submission text here..."
        />
      </div>

      <div>
        <label htmlFor="submissionFile" className="block text-sm font-medium text-gray-700 mb-2">
          File Upload (Optional)
        </label>
        <div className="flex items-center justify-center w-full">
          <label
            htmlFor="submissionFile"
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-8 h-8 mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="mb-2 text-sm text-gray-500">{file ? file.name : 'Click to upload file'}</p>
              <p className="text-xs text-gray-500">PDF, DOC, DOCX, TXT, JPG, PNG, ZIP (Max 50MB)</p>
            </div>
            <input
              id="submissionFile"
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept={ALLOWED_TYPES.join(',')}
            />
          </label>
        </div>
      </div>

      {isLate && assignment.allow_late_submission && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ This assignment is past the due date. Late submissions may be penalized.
          </p>
        </div>
      )}

      <div className="text-center">
        <button
          type="submit"
          disabled={submitting || blocked}
          className={`px-6 py-3 rounded-lg font-medium ${
            submitting || blocked
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {submitting ? 'Submitting...' : 'Submit Assignment'}
        </button>
        {blocked && <p className="mt-2 text-sm text-red-600">Late submissions not allowed for this assignment</p>}
      </div>
    </form>
  );
};

export default AssignmentSubmissionForm;
