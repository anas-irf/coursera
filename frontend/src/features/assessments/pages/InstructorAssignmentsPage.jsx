import React, { useState, useEffect } from 'react';
import {
  FileText,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  Eye,
  Search,
  Calendar,
  GraduationCap,
  Star,
  AlertTriangle
} from 'lucide-react';
import { errorMessage } from '../../../shared/api/errors';
import { saveBlob } from '../../../shared/lib/download';
import { useToast } from '../../../shared/ui/Toast';
import * as assessmentsApi from '../api';

const InstructorAssignmentsPage = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [gradingData, setGradingData] = useState({ grade: '', feedback: '' });
  const [gradingSubmission, setGradingSubmission] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      setAssignments(await assessmentsApi.instructorAssignments());
    } catch (err) {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async (assignmentId) => {
    setLoadingSubmissions(true);
    try {
      setSubmissions(await assessmentsApi.assignmentSubmissions(assignmentId));
    } catch (err) {
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleAssignmentSelect = (assignment) => {
    setSelectedAssignment(assignment);
    setSelectedSubmission(null);
    fetchSubmissions(assignment.id);
  };

  const handleSubmissionSelect = (submission) => {
    setSelectedSubmission(submission);
    setGradingData({
      grade: submission.grade || '',
      feedback: submission.feedback || ''
    });
  };

  const handleGradeSubmission = async () => {
    if (!selectedSubmission || !gradingData.grade) return;

    setGradingSubmission(true);
    try {
      const data = await assessmentsApi.gradeSubmission(
        selectedSubmission.id,
        parseFloat(gradingData.grade),
        gradingData.feedback
      );

      // Update the submission in the list
      setSubmissions(prev => prev.map(sub =>
        sub.id === selectedSubmission.id
          ? { ...sub, ...data.submission }
          : sub
      ));

      setSelectedSubmission(prev => ({ ...prev, ...data.submission }));

      toast.success('Assignment graded successfully!', 'Grade Submitted');
    } catch (err) {
      toast.error(errorMessage(err, 'Error grading assignment. Please try again.'), 'Grading Failed');
    } finally {
      setGradingSubmission(false);
    }
  };

  const downloadSubmissionFile = async (submission) => {
    try {
      const blob = await assessmentsApi.downloadSubmission(submission.id);
      saveBlob(blob, submission.original_filename || 'assignment.pdf');
    } catch (err) {
      toast.error('Error downloading file', 'Download Failed');
    }
  };

  const getSubmissionStatusColor = (submission) => {
    if (submission.grade !== null) return 'text-green-600';
    if (submission.is_late) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getSubmissionStatusText = (submission) => {
    if (submission.grade !== null) return 'Graded';
    if (submission.is_late) return 'Late Submission';
    return 'Pending Review';
  };

  const filteredSubmissions = submissions.filter(submission => {
    const matchesFilter = filterStatus === 'all' ||
      (filterStatus === 'graded' && submission.grade !== null) ||
      (filterStatus === 'pending' && submission.grade === null) ||
      (filterStatus === 'late' && submission.is_late);

    const matchesSearch = !searchQuery ||
      submission.student_name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assignment Management</h1>
        <p className="text-gray-600 mt-1">Review and grade student assignment submissions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignments List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Your Assignments</h2>
              <p className="text-sm text-gray-500 mt-1">Select an assignment to view submissions</p>
            </div>

            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {assignments.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                  <p>No assignments found</p>
                  <p className="text-sm mt-1">Create assignments in your courses to see them here.</p>
                </div>
              ) : (
                assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    onClick={() => handleAssignmentSelect(assignment)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedAssignment?.id === assignment.id ? 'bg-blue-50 border-r-4 border-r-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 line-clamp-2">{assignment.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{assignment.course_title}</p>

                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center">
                            <Users size={12} className="mr-1" />
                            {assignment.total_submissions} submissions
                          </span>
                          <span className="flex items-center">
                            <CheckCircle size={12} className="mr-1" />
                            {assignment.graded_submissions} graded
                          </span>
                        </div>

                        {assignment.due_date && (
                          <div className="flex items-center mt-2 text-xs text-gray-500">
                            <Calendar size={12} className="mr-1" />
                            Due: {formatDate(assignment.due_date)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Submissions List */}
        <div className="lg:col-span-2">
          {selectedAssignment ? (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedAssignment.title}</h2>
                    <p className="text-sm text-gray-600">{selectedAssignment.course_title}</p>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="flex items-center text-blue-600">
                      <Users size={16} className="mr-1" />
                      {submissions.length} submissions
                    </span>
                    <span className="flex items-center text-green-600">
                      <CheckCircle size={16} className="mr-1" />
                      {submissions.filter(s => s.grade !== null).length} graded
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
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Submissions</option>
                    <option value="pending">Pending Review</option>
                    <option value="graded">Graded</option>
                    <option value="late">Late Submissions</option>
                  </select>
                </div>
              </div>

              {loadingSubmissions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                  <p>No submissions found</p>
                  <p className="text-sm mt-1">
                    {searchQuery ? 'Try adjusting your search' : 'No students have submitted this assignment yet.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredSubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      onClick={() => handleSubmissionSelect(submission)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedSubmission?.id === submission.id ? 'bg-blue-50 border-r-4 border-r-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                              <GraduationCap size={20} className="text-gray-600" />
                            </div>
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h3 className="font-medium text-gray-900">{submission.student_name}</h3>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                submission.grade !== null
                                  ? 'bg-green-100 text-green-800'
                                  : submission.is_late
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {getSubmissionStatusText(submission)}
                              </span>
                              {submission.is_late && <AlertTriangle size={16} className="text-red-500" />}
                            </div>

                            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                              <span className="flex items-center">
                                <Clock size={12} className="mr-1" />
                                {formatDate(submission.submitted_at)}
                              </span>
                              {submission.grade !== null && (
                                <span className="flex items-center text-green-600">
                                  <Star size={12} className="mr-1" />
                                  {submission.grade}/{selectedAssignment.max_points} pts
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {submission.has_file && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadSubmissionFile(submission);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                              title="Download submission file"
                            >
                              <Download size={16} />
                            </button>
                          )}
                          <Eye size={16} className="text-gray-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

      {/* Grading Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Grade Submission: {selectedSubmission.student_name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedAssignment.title} • Submitted {formatDate(selectedSubmission.submitted_at)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <XCircle size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Assignment Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Max Points:</span>
                    <span className="ml-2">{selectedAssignment.max_points}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Passing Score:</span>
                    <span className="ml-2">{selectedAssignment.passing_score}%</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Submission Status:</span>
                    <span className={`ml-2 ${getSubmissionStatusColor(selectedSubmission)}`}>
                      {getSubmissionStatusText(selectedSubmission)}
                    </span>
                  </div>
                  {selectedAssignment.due_date && (
                    <div>
                      <span className="font-medium text-gray-700">Due Date:</span>
                      <span className="ml-2">{formatDate(selectedAssignment.due_date)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Submission Content */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Submission Content</h4>

                {selectedSubmission.submission_text && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Text Submission:</label>
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                        {selectedSubmission.submission_text}
                      </pre>
                    </div>
                  </div>
                )}

                {selectedSubmission.has_file && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">File Submission:</label>
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border">
                      <div className="flex items-center space-x-3">
                        <FileText className="text-blue-600" size={20} />
                        <span className="text-sm font-medium text-gray-900">
                          {selectedSubmission.original_filename}
                        </span>
                      </div>
                      <button
                        onClick={() => downloadSubmissionFile(selectedSubmission)}
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Grade (out of {selectedAssignment.max_points})
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={selectedAssignment.max_points}
                      step="0.01"
                      value={gradingData.grade}
                      onChange={(e) => setGradingData(prev => ({ ...prev, grade: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter grade"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Percentage
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                      {gradingData.grade
                        ? `${Math.round((gradingData.grade / selectedAssignment.max_points) * 100)}%`
                        : '-%'
                      }
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Feedback (Optional)
                  </label>
                  <textarea
                    rows={4}
                    value={gradingData.feedback}
                    onChange={(e) => setGradingData(prev => ({ ...prev, feedback: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Provide feedback to help the student improve..."
                  />
                </div>

                <div className="flex items-center justify-between mt-6">
                  <button
                    onClick={() => setSelectedSubmission(null)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGradeSubmission}
                    disabled={!gradingData.grade || gradingSubmission}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {gradingSubmission && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    )}
                    {selectedSubmission.grade !== null ? 'Update Grade' : 'Submit Grade'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorAssignmentsPage;