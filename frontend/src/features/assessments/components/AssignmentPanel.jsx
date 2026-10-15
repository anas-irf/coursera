import React from 'react';
import { Download, FileText } from 'lucide-react';

import { downloadFromUrl } from '../../../shared/lib/download';
import { mediaUrl } from '../../../shared/lib/media';
import { formatDateTime } from '../../../shared/lib/time';
import { useToast } from '../../../shared/ui/Toast';
import { useSubmissionDownload } from '../hooks/useAttempts';
import AssignmentSubmissionForm from './AssignmentSubmissionForm';

/** An assignment lecture: instructions, materials, the student's submission or the form. */
const AssignmentPanel = ({ lecture, onSubmitted }) => {
  const toast = useToast();
  const downloadFile = useSubmissionDownload();
  const { submission } = lecture;

  const downloadMaterial = async () => {
    try {
      await downloadFromUrl(mediaUrl(lecture.attachment), lecture.attachment_name || 'assignment-file');
    } catch (err) {
      toast.error(
        'Failed to download file. The file might not exist or there might be a server issue.',
        'Download Failed'
      );
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {lecture.title && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">{lecture.title}</h2>
          {lecture.description && <p className="text-gray-700 mb-4">{lecture.description}</p>}
        </div>
      )}

      {lecture.instructions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-900 mb-2">Instructions</h3>
          <div className="text-blue-800 whitespace-pre-wrap">{lecture.instructions}</div>
        </div>
      )}

      {lecture.attachment && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-gray-900 mb-2">Assignment Materials</h3>
          <div className="flex items-center space-x-3">
            <FileText className="text-red-500" size={20} />
            <div className="flex-1">
              <button onClick={downloadMaterial} className="text-indigo-600 hover:text-indigo-800 font-medium">
                {lecture.attachment_name || 'Download Assignment File'}
              </button>
              <p className="text-sm text-gray-500">Click to download assignment materials</p>
            </div>
            <button
              onClick={downloadMaterial}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
              title="Download file"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-purple-900 mb-2">Assignment Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-purple-700">Due Date:</span>{' '}
            {lecture.due_date ? formatDateTime(lecture.due_date) : 'No due date'}
          </div>
          <div>
            <span className="text-purple-700">Max Points:</span> {lecture.max_points || 'Not set'}
          </div>
          <div>
            <span className="text-purple-700">Passing Score:</span> {lecture.passing_score || 'Not set'}%
          </div>
          <div>
            <span className="text-purple-700">Status:</span>
            <span className={`ml-1 ${submission && submission.submitted ? 'text-green-600' : 'text-orange-600'}`}>
              {submission && submission.submitted ? 'Submitted' : 'Not Submitted'}
            </span>
          </div>
        </div>
      </div>

      {submission && submission.submitted ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">Your Submission</h4>
          <p className="text-sm text-green-700">
            Submitted on:{' '}
            {submission.submission_date ? formatDateTime(submission.submission_date) : 'Date not available'}
            {submission.is_late && <span className="text-red-600 ml-2">(Late)</span>}
          </p>

          {submission.submission_text && (
            <div className="mt-3">
              <p className="text-sm font-medium text-green-700 mb-1">Text Submission:</p>
              <div className="bg-white p-3 rounded border text-sm text-gray-700">{submission.submission_text}</div>
            </div>
          )}

          {submission.has_file && submission.original_filename && (
            <div className="mt-3">
              <p className="text-sm font-medium text-green-700 mb-1">Uploaded File:</p>
              <div className="flex items-center justify-between bg-white p-3 rounded border">
                <div className="flex items-center">
                  <FileText className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">{submission.original_filename}</span>
                </div>
                <button
                  onClick={() => downloadFile(submission)}
                  className="flex items-center px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </button>
              </div>
            </div>
          )}

          {submission.graded && (
            <div className="mt-3">
              <p className="text-sm">
                <span className="text-green-700">Grade:</span> {submission.grade}/{lecture.max_points}
              </p>
              {submission.feedback && (
                <div className="mt-2">
                  <p className="text-sm text-green-700">Feedback:</p>
                  <p className="text-sm text-gray-700 italic">{submission.feedback}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <AssignmentSubmissionForm
          key={lecture.assignment_id}
          assignment={lecture}
          onSubmitted={onSubmitted}
        />
      )}
    </div>
  );
};

export default AssignmentPanel;
