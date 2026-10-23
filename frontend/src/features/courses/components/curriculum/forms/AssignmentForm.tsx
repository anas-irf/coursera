import React, { useState } from 'react';
import { Award, Dumbbell, Paperclip } from 'lucide-react';

import { mediaUrl } from '../../../../../shared/lib/media';
import { Callout } from '../../../../../shared/ui/Callout';
import { Checkbox } from '../../../../../shared/ui/Checkbox';
import { Field } from '../../../../../shared/ui/Field';
import { Input, Textarea } from '../../../../../shared/ui/Input';
import { SegmentedControl } from '../../../../../shared/ui/SegmentedControl';
import type { AssignmentSettings, LectureFormData } from '../../../types';
import FileDrop from '../../../../../shared/ui/FileDrop';

interface AssignmentFormProps {
  formData: LectureFormData;
  setFormData: (formData: LectureFormData) => void;
  /** The attachment chosen in this dialog, kept apart from the settings (it is its own part of the request). */
  assignmentAttachment: File | null;
  setAssignmentAttachment: (file: File | null) => void;
}

/** An assignment is practice (ungraded, weight 0) or graded (it carries a share of the final grade). */
type AssignmentType = 'practice' | 'graded';

// the earliest due date the form accepts: an hour from now, as a datetime-local value
const minDateTime = (): string => {
  const now = new Date();
  now.setHours(now.getHours() + 1);
  return now.toISOString().slice(0, 16);
};

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

  const updateAssignmentSettings = <K extends keyof AssignmentSettings>(field: K, value: AssignmentSettings[K]) => {
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

  const existing = formData.assignment_settings?.existing_attachment;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-sm font-medium text-fg">Assignment type</p>
        <SegmentedControl
          label="Assignment type"
          variant="cards"
          value={assignmentType}
          onChange={handleAssignmentTypeChange}
          options={[
            {
              value: 'practice',
              label: 'Practice Assignment (Ungraded)',
              icon: Dumbbell,
              description: 'Feedback only; it does not count towards the grade.',
            },
            {
              value: 'graded',
              label: 'Graded Assignment',
              icon: Award,
              description: 'Graded by you; it counts towards the final grade with its weight.',
            },
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Max points">
          <Input
            type="number"
            min="1"
            max="100"
            value={formData.assignment_settings?.max_points || ''}
            onChange={(e) => updateAssignmentSettings('max_points', parseInt(e.target.value) || 100)}
            placeholder="100"
          />
        </Field>
        <Field label="Due date (optional)" hint="At least one hour from now.">
          <Input
            type="datetime-local"
            min={minDateTime()}
            value={formData.assignment_settings?.due_date || ''}
            onChange={(e) => updateAssignmentSettings('due_date', e.target.value)}
          />
        </Field>
        {assignmentType === 'graded' && (
          <>
            <Field label="Passing score (%)">
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.assignment_settings?.passing_score || ''}
                onChange={(e) => updateAssignmentSettings('passing_score', parseInt(e.target.value) || 60)}
                placeholder="60"
              />
            </Field>
            <Field label="Weight in grade (%)" hint="From 0.01 to 40.">
              <Input
                type="number"
                min="0.01"
                max="40"
                step="0.01"
                value={formData.assignment_settings?.weight || ''}
                onChange={(e) => updateAssignmentSettings('weight', parseFloat(e.target.value) || 0)}
                placeholder="15.00"
              />
            </Field>
          </>
        )}
      </div>

      {/* late hand-ins only mean something when there is a due date */}
      {formData.assignment_settings?.due_date && (
        <Checkbox
          checked={formData.assignment_settings?.allow_late_submission !== false}
          onChange={(e) => updateAssignmentSettings('allow_late_submission', e.target.checked)}
          label="Allow late submissions"
          description="Students can still hand in after the due date; the hand-in is marked late."
        />
      )}

      <Field label="Assignment Instructions" required>
        <Textarea
          rows={6}
          value={formData.assignment_settings?.instructions || ''}
          onChange={(e) => updateAssignmentSettings('instructions', e.target.value)}
          placeholder="Describe the requirements, the deliverables and how it will be graded..."
        />
      </Field>

      <Field label="Attachment (optional)" hint="Resources or a template for the students: PDF, DOC or ZIP up to 50 MB.">
        <FileDrop
          accept=".pdf,.doc,.docx,.zip"
          icon={Paperclip}
          title={existing ? 'Drop a file to replace the current attachment' : 'Drop the assignment resources here'}
          buttonLabel={existing ? 'Replace File' : 'Choose File'}
          file={assignmentAttachment}
          onRemove={() => setAssignmentAttachment(null)}
          current={existing ? { name: existing.split('/').pop() || existing, url: mediaUrl(existing) } : null}
          onFile={(file) => setAssignmentAttachment(file)}
        />
      </Field>

      <Callout tone="neutral" title="Submission">
        Students hand in text, a file, or both. You review and grade the submissions in Assignments.
      </Callout>
    </div>
  );
};

export default AssignmentForm;
