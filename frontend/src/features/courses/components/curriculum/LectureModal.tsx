import React, { useState, useEffect } from 'react';
import type { FormEvent } from 'react';

import type { ContentType } from '../../../../shared/types';
import { Button } from '../../../../shared/ui/Button';
import { Checkbox } from '../../../../shared/ui/Checkbox';
import { Field } from '../../../../shared/ui/Field';
import { Input, Textarea } from '../../../../shared/ui/Input';
import Modal, { ModalFooter } from '../../../../shared/ui/Modal';
import { SegmentedControl } from '../../../../shared/ui/SegmentedControl';
import type { SegmentOption } from '../../../../shared/ui/SegmentedControl';
import { useToast } from '../../../../shared/ui/Toast';
import type { CurriculumLecture, LectureFormData, LecturePayload } from '../../types';
import { LECTURE_KINDS } from './LectureItem';
import VideoLectureForm from './forms/VideoLectureForm';
import QuizForm from './forms/QuizForm';
import AssignmentForm from './forms/AssignmentForm';
import ReadingForm from './forms/ReadingForm';

interface LectureModalProps {
  /** The lecture being edited; none when one is being added. */
  lecture?: CurriculumLecture;
  onClose: () => void;
  /** May reject (the caller reports why): the dialog then stays open with what was typed. */
  onSave: (data: LecturePayload) => Promise<void>;
  title: string;
}

// the four kinds of lecture, in the order the dialog offers them
const CONTENT_TYPES: SegmentOption<ContentType>[] = (['video', 'reading', 'quiz', 'assignment'] as const).map(
  (value) => ({
    value,
    label: value === 'video' ? 'Video' : LECTURE_KINDS[value].label,
    icon: LECTURE_KINDS[value].icon,
  })
);

const LectureModal = ({ lecture, onClose, onSave, title }: LectureModalProps) => {
  const { error } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [assignmentAttachment, setAssignmentAttachment] = useState<File | null>(null); // Store file separately
  const [readingFile, setReadingFile] = useState<File | null>(null); // Store reading file separately
  const [formData, setFormData] = useState<LectureFormData>({
    title: lecture?.title || '',
    description: lecture?.description || '',
    content_type: lecture?.content_type || 'video',
    video_url: lecture?.video_content?.video_url || '',
    video_file: lecture?.video_content?.video_file || null,
    subtitle_file: null, // New subtitle file
    article_content: lecture?.article_content || '',
    // a lecture of the API has no files of these names (its reading is ``reading_document``), so
    // there is nothing to start from
    markdown_file: null,
    pdf_file: null,
    questions: lecture?.questions || [],
    quiz_settings: lecture?.quiz_settings || {
      passing_score: 60,
      time_limit: null,
      max_attempts: 3,
      weight: 0,
      randomize_questions: false,
      show_answers: true
    },
    assignment_settings: lecture?.assignment_settings || {
      max_points: 100,
      due_date: '',
      passing_score: 60,
      weight: 0,
      instructions: ''
      // Note: attachment is not set to null by default to avoid overriding uploaded files
    },
    reading_document: lecture?.reading_document || null,
    is_preview: lecture?.is_preview || false,
    is_downloadable: lecture?.is_downloadable || false,
    existing_video_name: lecture?.video_content?.existing_video_name || null,
    existing_subtitle_name: lecture?.existing_subtitle_name || null
  });

  const [activeTab, setActiveTab] = useState<ContentType>(formData.content_type);

  useEffect(() => {
    setFormData(prev => ({ ...prev, content_type: activeTab }));
  }, [activeTab]);

  const validateForm = () => {
    if (!formData.title.trim()) {
      error('Please enter a lecture title', 'Validation Error');
      return false;
    }

    if (activeTab === 'video') {
      if (!formData.video_url && !formData.video_file) {
        error('Please provide a video URL or upload a video file', 'Video Content Required');
        return false;
      }
    }

    if (activeTab === 'reading') {
      if (!formData.article_content && !formData.markdown_file && !formData.pdf_file && !readingFile && !formData.reading_document?.existing_file) {
        error('Please provide reading content: write rich text, upload a markdown file, or upload a PDF file', 'Reading Content Required');
        return false;
      }
    }

    if (activeTab === 'quiz') {
      if (!formData.questions || formData.questions.length === 0) {
        error('Please add at least one quiz question', 'Quiz Content Required');
        return false;
      }

      // Validate weight for graded quizzes
      if (formData.quiz_settings?.weight && formData.quiz_settings.weight > 0) {
        if (formData.quiz_settings.weight < 0.01 || formData.quiz_settings.weight > 40) {
          error('Quiz weight must be between 0.01% and 40%', 'Invalid Weight');
          return false;
        }
      }

      for (let i = 0; i < formData.questions.length; i++) {
        const question = formData.questions[i];
        if (!question.question_text.trim()) {
          error(`Please enter text for question ${i + 1}`, 'Question Incomplete');
          return false;
        }
        if (!question.options.every(opt => opt.option_text.trim())) {
          error(`Please fill all options for question ${i + 1}`, 'Options Incomplete');
          return false;
        }
        if (!question.options.some(opt => opt.is_correct)) {
          error(`Please mark the correct answer for question ${i + 1}`, 'Correct Answer Missing');
          return false;
        }
      }
    }

    if (activeTab === 'assignment') {
      if (!formData.assignment_settings?.instructions?.trim()) {
        error('Please provide assignment instructions', 'Assignment Instructions Required');
        return false;
      }

      // Validate weight for graded assignments
      if (formData.assignment_settings?.weight && formData.assignment_settings.weight > 0) {
        if (formData.assignment_settings.weight < 0.01 || formData.assignment_settings.weight > 40) {
          error('Assignment weight must be between 0.01% and 40%', 'Invalid Weight');
          return false;
        }
      }

      // Validate due date (must be at least 1 hour from now)
      if (formData.assignment_settings?.due_date) {
        const dueDate = new Date(formData.assignment_settings.due_date);
        const minDate = new Date();
        minDate.setHours(minDate.getHours() + 1);

        if (dueDate <= minDate) {
          error('Due date must be at least 1 hour from now', 'Invalid Due Date');
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    try {
      setIsUploading(true);
      // Merge the attachment file and reading file with formData before saving
      const dataToSave: LecturePayload = {
        ...formData,
        assignment_settings: {
          ...formData.assignment_settings,
          attachment: assignmentAttachment // Add the file here
        },
        reading_file: readingFile // Add reading file here for backward compatibility
      };

      // For reading lectures, also include specific file types if they exist in formData
      if (formData.content_type === 'reading') {
        if (formData.markdown_file) {
          dataToSave.markdown_file = formData.markdown_file;
        }
        if (formData.pdf_file) {
          dataToSave.pdf_file = formData.pdf_file;
        }
      }
      await onSave(dataToSave);
    } catch (err) {
      // reported by the caller; the form stays open with what was typed
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      title={title}
      description="A lecture is a video, a reading, a quiz or an assignment."
      onClose={isUploading ? undefined : onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <p className="mb-1.5 text-sm font-medium text-fg">Lecture type</p>
            <SegmentedControl
              label="Lecture type"
              options={CONTENT_TYPES}
              value={activeTab}
              onChange={setActiveTab}
            />
          </div>

          <Field label="Lecture Title" required>
            <Input
              data-autofocus
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Introduction to components"
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="One or two sentences about this lecture"
            />
          </Field>

          <div className="rounded-xl border border-line p-4 sm:p-5">
            {activeTab === 'video' && (
              <VideoLectureForm
                formData={formData}
                setFormData={setFormData}
                isUploading={isUploading}
                setIsUploading={setIsUploading}
              />
            )}

            {activeTab === 'reading' && (
              <ReadingForm
                formData={formData}
                setFormData={setFormData}
                readingFile={readingFile}
                setReadingFile={setReadingFile}
              />
            )}

            {activeTab === 'quiz' && (
              <QuizForm formData={formData} setFormData={setFormData} />
            )}

            {activeTab === 'assignment' && (
              <AssignmentForm
                formData={formData}
                setFormData={setFormData}
                assignmentAttachment={assignmentAttachment}
                setAssignmentAttachment={setAssignmentAttachment}
              />
            )}
          </div>

          <div className="space-y-3">
            <Checkbox
              checked={formData.is_preview}
              onChange={(e) => setFormData({ ...formData, is_preview: e.target.checked })}
              label="Allow free preview"
              description="Visitors can open this lecture before they enrol."
            />
            {activeTab !== 'quiz' && (
              <Checkbox
                checked={formData.is_downloadable}
                onChange={(e) => setFormData({ ...formData, is_downloadable: e.target.checked })}
                label="Allow download"
                description="Learners can save the file for offline use."
              />
            )}
          </div>
        </div>

        <ModalFooter className="sticky bottom-0 bg-surface-raised">
          <Button variant="secondary" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button type="submit" loading={isUploading}>
            {isUploading ? 'Uploading...' : `${lecture ? 'Update' : 'Create'} Lecture`}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default LectureModal;
