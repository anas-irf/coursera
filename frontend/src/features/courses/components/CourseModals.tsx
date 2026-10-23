import React, { useState } from 'react';
import { BadgeDollarSign, FileText, ListTree, Save } from 'lucide-react';

import { errorSummary } from '../../../shared/api/errors';
import { Button } from '../../../shared/ui/Button';
import ErrorState from '../../../shared/ui/ErrorState';
import Modal, { ModalFooter } from '../../../shared/ui/Modal';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { Tabs } from '../../../shared/ui/Tabs';
import type { TabItem } from '../../../shared/ui/Tabs';
import { useToast } from '../../../shared/ui/Toast';
import {
  useCategories,
  useCourseDetail,
  useCreateCourse,
  useLanguages,
  useUpdateCourse,
} from '../hooks/useCourses';
import { useThumbnail } from '../hooks/useThumbnail';
import { blankCourse, courseBody, courseValues, hasRequiredFields } from '../lib/course';
import type { CourseDetail, InstructorCourseRow } from '../types';
import { BasicFields, PricingFields, ThumbnailField } from './CourseFields';
import CurriculumTab from './CurriculumTab';

/** The choices of the category and language selects. */
const useFormChoices = () => {
  const categories = useCategories();
  const languages = useLanguages();
  return { categories: categories.data || [], languages: languages.data || [] };
};

interface CreateCourseModalProps {
  onClose: () => void;
  onSave: () => void;
}

export const CreateCourseModal = ({ onClose, onSave }: CreateCourseModalProps) => {
  const toast = useToast();
  const create = useCreateCourse();
  const choices = useFormChoices();
  const thumbnail = useThumbnail();
  const [values, setValues] = useState(blankCourse);

  const handleSubmit = async () => {
    if (!hasRequiredFields(values)) {
      toast.warning('Please fill in required fields (Title and Description)', 'Missing Information');
      return;
    }
    if (!thumbnail.file) {
      toast.warning('Please upload a course thumbnail', 'Missing Thumbnail');
      return;
    }

    try {
      await create.mutateAsync(courseBody(values, thumbnail.file));
      toast.success('Course created successfully! You can now edit it and add content.', 'Course Created');
      onSave();
    } catch (err) {
      toast.error(errorSummary(err, 'Unknown error occurred'), 'Course Creation Failed');
    }
  };

  return (
    <Modal
      title="Create New Course"
      description="Start with the basics. You build the curriculum once the course exists."
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-6 p-5 sm:p-6">
        <BasicFields values={values} onChange={setValues} {...choices} />
        <ThumbnailField thumbnail={thumbnail} required />
        <PricingFields values={values} onChange={setValues} />
      </div>
      <ModalFooter className="sticky bottom-0 bg-surface-raised">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} loading={create.isPending}>Create Course</Button>
      </ModalFooter>
    </Modal>
  );
};

type Tab = 'basic' | 'curriculum' | 'pricing';

const TABS: TabItem<Tab>[] = [
  { value: 'basic', label: 'Details', icon: FileText },
  { value: 'curriculum', label: 'Curriculum', icon: ListTree },
  { value: 'pricing', label: 'Pricing', icon: BadgeDollarSign },
];

interface EditCourseFormProps {
  course: InstructorCourseRow;
  /** The stored course, loaded: the form starts from it. */
  detail: CourseDetail;
  activeTab: Tab;
  onClose: () => void;
  onSave: () => void;
}

/** The editing form of a course whose stored values are known. */
const EditCourseForm = ({ course, detail, activeTab, onClose, onSave }: EditCourseFormProps) => {
  const toast = useToast();
  const update = useUpdateCourse(course.id);
  const choices = useFormChoices();
  const thumbnail = useThumbnail();
  const [values, setValues] = useState(() => courseValues(detail));

  const handleSave = async () => {
    if (!hasRequiredFields(values)) {
      toast.warning('Please fill in required fields (Title and Description)', 'Missing Information');
      return;
    }

    try {
      await update.mutateAsync(courseBody(values, thumbnail.file));
      toast.success('Course updated successfully!', 'Course Updated');
      onSave();
    } catch (err) {
      toast.error(errorSummary(err, 'Unknown error occurred'), 'Course Update Failed');
    }
  };

  return (
    <>
      <div className="p-5 sm:p-6">
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <BasicFields values={values} onChange={setValues} {...choices} />
            <ThumbnailField thumbnail={thumbnail} current={detail.thumbnail || course.thumbnail} />
          </div>
        )}

        {activeTab === 'curriculum' && <CurriculumTab courseId={course.id} />}

        {activeTab === 'pricing' && <PricingFields values={values} onChange={setValues} />}
      </div>

      <ModalFooter className="sticky bottom-0 bg-surface-raised">
        {activeTab === 'curriculum' && (
          <p className="mr-auto hidden text-xs text-fg-subtle sm:block">Changes to sections and lectures are saved as you make them.</p>
        )}
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button icon={Save} onClick={handleSave} loading={update.isPending}>Save Changes</Button>
      </ModalFooter>
    </>
  );
};

interface EditCourseModalProps {
  course: InstructorCourseRow;
  onClose: () => void;
  onSave: () => void;
}

export const EditCourseModal = ({ course, onClose, onSave }: EditCourseModalProps) => {
  const detail = useCourseDetail(course.id);
  const [activeTab, setActiveTab] = useState<Tab>('basic');

  // the form starts from what is stored: without it, saving would overwrite the course with blanks
  return (
    <Modal
      title={`Edit Course: ${course.title}`}
      onClose={onClose}
      size="lg"
      headerExtra={
        detail.isSuccess ? (
          <Tabs
            label="Course sections"
            items={TABS}
            value={activeTab}
            onChange={setActiveTab}
            className="-mb-px px-5 sm:px-6"
          />
        ) : null
      }
    >
      {detail.isPending && (
        <div className="p-6">
          <PageSpinner className="h-48" />
        </div>
      )}
      {detail.isError && (
        <div className="p-6">
          <ErrorState
            title="We could not load the course"
            error={detail.error}
            onRetry={() => detail.refetch()}
          />
        </div>
      )}
      {detail.isSuccess && (
        <EditCourseForm
          course={course}
          detail={detail.data}
          activeTab={activeTab}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </Modal>
  );
};
