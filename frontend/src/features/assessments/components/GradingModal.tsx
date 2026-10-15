import React, { useState } from 'react';
import { Download, FileText } from 'lucide-react';

import { errorMessage } from '../../../shared/api/errors';
import { formatDateTime } from '../../../shared/lib/time';
import Modal from '../../../shared/ui/Modal';
import { useToast } from '../../../shared/ui/Toast';
import { useGradeSubmission } from '../hooks/useAssignments';
import { percentOf, submissionStatus } from '../lib/submissions';
import type { SubmissionTone } from '../lib/submissions';
import type { AssignmentRow, InstructorSubmission } from '../types';

const STATUS_TEXT: Record<SubmissionTone, string> = {
  graded: 'text-green-600',
  late: 'text-red-600',
  pending: 'text-yellow-600',
};

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
    <Modal title={`Grade Submission: ${submission.student_name}`} onClose={onClose} size="lg">
      <div className="p-6 space-y-6">
        <p className="text-sm text-gray-600 -mt-2">
          {assignment.title} • Submitted {formatDateTime(submission.submitted_at)}
        </p>

        {/* Assignment Details */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Max Points:</span>
              <span className="ml-2">{assignment.max_points}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Passing Score:</span>
              <span className="ml-2">{assignment.passing_score}%</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Submission Status:</span>
              <span className={`ml-2 ${STATUS_TEXT[tone]}`}>{label}</span>
            </div>
            {assignment.due_date && (
              <div>
                <span className="font-medium text-gray-700">Due Date:</span>
                <span className="ml-2">{formatDateTime(assignment.due_date)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Submission Content */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Submission Content</h4>

          {submission.submission_text && (
            <div className="mb-4">
              <p className="block text-sm font-medium text-gray-700 mb-2">Text Submission:</p>
              <div className="bg-gray-50 rounded-lg p-4 border">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                  {submission.submission_text}
                </pre>
              </div>
            </div>
          )}

          {submission.has_file && (
            <div className="mb-4">
              <p className="block text-sm font-medium text-gray-700 mb-2">File Submission:</p>
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center space-x-3">
                  <FileText className="text-blue-600" size={20} />
                  <span className="text-sm font-medium text-gray-900">{submission.original_filename}</span>
                </div>
                <button
                  onClick={() => onDownload(submission)}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Download size={16} className="mr-2" />
                  Download
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Grading Section */}
        <div className="border-t border-gray-200 pt-6">
          <h4 className="font-medium text-gray-900 mb-4">Grading</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-2">
                Grade (out of {assignment.max_points})
              </label>
              <input
                id="grade"
                type="number"
                min="0"
                max={assignment.max_points}
                step="0.01"
                data-autofocus
                value={values.grade}
                onChange={(e) => setValues((prev) => ({ ...prev, grade: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter grade"
              />
            </div>

            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">Percentage</p>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                {percentOf(values.grade, assignment.max_points)}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
              Feedback (Optional)
            </label>
            <textarea
              id="feedback"
              rows={4}
              value={values.feedback}
              onChange={(e) => setValues((prev) => ({ ...prev, feedback: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Provide feedback to help the student improve..."
            />
          </div>

          <div className="flex items-center justify-between mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGrade}
              disabled={values.grade === '' || grade.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {grade.isPending && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              {submission.grade !== null ? 'Update Grade' : 'Submit Grade'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default GradingModal;
