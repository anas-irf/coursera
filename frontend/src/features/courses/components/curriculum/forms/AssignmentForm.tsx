import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { mediaUrl } from '../../../../../shared/lib/media';
import type { AssignmentSettings, LectureFormData } from '../../../types';

interface AssignmentFormProps {
  formData: LectureFormData;
  setFormData: (formData: LectureFormData) => void;
  /** The attachment chosen in this dialog, kept apart from the settings (it is its own part of the request). */
  assignmentAttachment: File | null;
  setAssignmentAttachment: (file: File | null) => void;
}

/** An assignment is practice (ungraded, weight 0) or graded (it carries a share of the final grade). */
type AssignmentType = 'practice' | 'graded';

const AssignmentForm = ({
  formData,
  setFormData,
  assignmentAttachment,
  setAssignmentAttachment,
}: AssignmentFormProps) => {
  // Determine assignment type based on weight (0 = practice, > 0 = graded)
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(
    formData.assignment_settings?.weight && formData.assignment_settings.weight > 0 ? 'graded' : 'practice'
  );

  const updateAssignmentSettings = <Field extends keyof AssignmentSettings>(
    field: Field,
    value: AssignmentSettings[Field]
  ) => {
    setFormData({
      ...formData,
      assignment_settings: {
        ...formData.assignment_settings,
        [field]: value
      }
    });
  };

  // Update assignment type when radio buttons change
  const handleAssignmentTypeChange = (type: AssignmentType) => {
    setAssignmentType(type);
    // If switching to practice, set weight to 0
    if (type === 'practice') {
      updateAssignmentSettings('weight', 0);
    }
    // If switching to graded and weight is 0, set a default weight
    else if (type === 'graded' && (!formData.assignment_settings?.weight || formData.assignment_settings.weight === 0)) {
      updateAssignmentSettings('weight', 10);
    }
  };

  // Get minimum datetime (1 hour from now)
  const getMinDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16); // Format for datetime-local input
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Assignment Type
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="practice"
              checked={assignmentType === 'practice'}
              onChange={() => handleAssignmentTypeChange('practice')}
              className="text-indigo-600"
            />
            <span className="text-sm">Practice Assignment (Ungraded)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="graded"
              checked={assignmentType === 'graded'}
              onChange={() => handleAssignmentTypeChange('graded')}
              className="text-indigo-600"
            />
            <span className="text-sm">Graded Assignment</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Points
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={formData.assignment_settings?.max_points || ''}
            onChange={(e) => updateAssignmentSettings('max_points', parseInt(e.target.value) || 100)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Due Date (Optional)
          </label>
          <input
            type="datetime-local"
            min={getMinDateTime()}
            value={formData.assignment_settings?.due_date || ''}
            onChange={(e) => updateAssignmentSettings('due_date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Must be at least 1 hour from now
          </p>
        </div>
      </div>

      {/* Allow Late Submissions checkbox - only show when due date is specified */}
      {formData.assignment_settings?.due_date && (
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.assignment_settings?.allow_late_submission !== false}
              onChange={(e) => updateAssignmentSettings('allow_late_submission', e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-gray-700">Allow late submissions</span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            Students can submit assignments after the due date
          </p>
        </div>
      )}

      {assignmentType === 'graded' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Passing Score (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.assignment_settings?.passing_score || ''}
              onChange={(e) => updateAssignmentSettings('passing_score', parseInt(e.target.value) || 60)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Weight in Grade
            </label>
            <input
              type="number"
              min="0.01"
              max="40"
              step="0.01"
              value={formData.assignment_settings?.weight || ''}
              onChange={(e) => updateAssignmentSettings('weight', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="15.00"
            />
            <p className="text-xs text-gray-500 mt-1">
              Range: 0.01% - 40%
            </p>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Assignment Instructions
        </label>
        <textarea
          rows={6}
          value={formData.assignment_settings?.instructions || ''}
          onChange={(e) => updateAssignmentSettings('instructions', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Describe the assignment requirements, deliverables, and grading criteria..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Attachment (Optional)
        </label>

        {/* Show existing file if available */}
        {formData.assignment_settings?.existing_attachment && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 mb-2">Current file:</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-900">
                {formData.assignment_settings.existing_attachment.split('/').pop()}
              </span>
              <a
                href={mediaUrl(formData.assignment_settings.existing_attachment) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                View
              </a>
            </div>
          </div>
        )}

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">
            {formData.assignment_settings?.existing_attachment
              ? 'Upload new file to replace current attachment'
              : 'Upload assignment resources or templates'}
          </p>
          <p className="text-sm text-gray-500">PDF, DOC, ZIP files up to 50MB</p>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.zip"
            onChange={(e) => {
              // (a cancelled dialog leaves the list empty: the first file is then ``undefined``)
              const file = e.target.files && e.target.files[0];
              setAssignmentAttachment(file);
            }}
            className="hidden"
            id="assignment-upload"
          />
          <label
            htmlFor="assignment-upload"
            className="mt-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
          >
            {formData.assignment_settings?.existing_attachment ? 'Replace File' : 'Choose File'}
          </label>

          {/* Show selected file name */}
          {assignmentAttachment && (
            <p className="mt-2 text-sm text-green-600">
              Selected: {assignmentAttachment.name}
            </p>
          )}
        </div>
      </div>

      <div className="bg-orange-50 p-4 rounded-lg">
        <p className="text-sm text-orange-800">
          <strong>Submission:</strong> Students will upload PDF files for submission.
          You'll review and grade submissions manually through the grading interface.
        </p>
      </div>
    </div>
  );
};

export default AssignmentForm;
