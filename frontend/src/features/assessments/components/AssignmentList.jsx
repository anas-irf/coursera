import React from 'react';
import { Calendar, CheckCircle, FileText, Users } from 'lucide-react';

import { formatDateTime } from '../../../shared/lib/time';

/** The assignments of the instructor's courses; choosing one shows its hand-ins. */
const AssignmentList = ({ assignments, selectedId, onSelect }) => (
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
          <button
            key={assignment.id}
            onClick={() => onSelect(assignment)}
            aria-pressed={selectedId === assignment.id}
            className={`block w-full text-left p-4 hover:bg-gray-50 transition-colors ${
              selectedId === assignment.id ? 'bg-blue-50 border-r-4 border-r-blue-500' : ''
            }`}
          >
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
                Due: {formatDateTime(assignment.due_date)}
              </div>
            )}
          </button>
        ))
      )}
    </div>
  </div>
);

export default AssignmentList;
