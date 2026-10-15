import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Search,
  Star,
  Users,
} from 'lucide-react';

import { formatDateTime } from '../../../shared/lib/time';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { submissionStatus, visibleSubmissions } from '../lib/submissions';

const TONES = {
  graded: 'bg-green-100 text-green-800',
  late: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

/** The hand-ins of one assignment with a search, a status filter and a way to open each. */
const SubmissionList = ({ assignment, query, selectedId, onSelect, onDownload }) => {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const submissions = query.data || [];
  const shown = visibleSubmissions(submissions, { status, search });

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{assignment.title}</h2>
            <p className="text-sm text-gray-600">{assignment.course_title}</p>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <span className="flex items-center text-blue-600">
              <Users size={16} className="mr-1" />
              {submissions.length} submissions
            </span>
            <span className="flex items-center text-green-600">
              <CheckCircle size={16} className="mr-1" />
              {submissions.filter((submission) => submission.grade !== null).length} graded
            </span>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="flex-1">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                aria-label="Search students"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            aria-label="Show"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Submissions</option>
            <option value="pending">Pending Review</option>
            <option value="graded">Graded</option>
            <option value="late">Late Submissions</option>
          </select>
        </div>
      </div>

      {query.isPending && <PageSpinner className="py-12" color="border-blue-600" />}

      {query.isError && (
        <ErrorState
          title="We could not load the submissions"
          error={query.error}
          onRetry={() => query.refetch()}
        />
      )}

      {query.isSuccess && shown.length === 0 && (
        <div className="p-12 text-center text-gray-500">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <p>No submissions found</p>
          <p className="text-sm mt-1">
            {search ? 'Try adjusting your search' : 'No students have submitted this assignment yet.'}
          </p>
        </div>
      )}

      {query.isSuccess && shown.length > 0 && (
        <div className="divide-y divide-gray-200">
          {shown.map((submission) => {
            const { label, tone } = submissionStatus(submission);
            return (
              <div
                key={submission.id}
                className={`flex items-center justify-between hover:bg-gray-50 transition-colors ${
                  selectedId === submission.id ? 'bg-blue-50 border-r-4 border-r-blue-500' : ''
                }`}
              >
                <button
                  onClick={() => onSelect(submission)}
                  className="flex-1 flex items-center space-x-4 p-4 text-left"
                  aria-label={`Open the submission of ${submission.student_name}`}
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <GraduationCap size={20} className="text-gray-600" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-gray-900">{submission.student_name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${TONES[tone]}`}>{label}</span>
                      {submission.is_late && <AlertTriangle size={16} className="text-red-500" />}
                    </div>

                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                      <span className="flex items-center">
                        <Clock size={12} className="mr-1" />
                        {formatDateTime(submission.submitted_at)}
                      </span>
                      {submission.grade !== null && (
                        <span className="flex items-center text-green-600">
                          <Star size={12} className="mr-1" />
                          {submission.grade}/{assignment.max_points} pts
                        </span>
                      )}
                    </div>
                  </div>
                  <Eye size={16} className="text-gray-400" />
                </button>

                {submission.has_file && (
                  <button
                    onClick={() => onDownload(submission)}
                    className="p-2 mr-4 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                    title="Download submission file"
                    aria-label={`Download the file of ${submission.student_name}`}
                  >
                    <Download size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SubmissionList;
