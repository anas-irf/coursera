import React, { useState } from 'react';

import { errorSummary } from '../../../shared/api/errors';
import ErrorState from '../../../shared/ui/ErrorState';
import Modal from '../../../shared/ui/Modal';
import { PageSpinner } from '../../../shared/ui/Spinner';
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

const PRIMARY_BUTTON =
  'flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50';
const SECONDARY_BUTTON = 'flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50';

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
    <Modal title="Create New Course" onClose={onClose}>
      <div className="p-6 space-y-6">
        <BasicFields values={values} onChange={setValues} {...choices} />
        <ThumbnailField thumbnail={thumbnail} required />
        <PricingFields values={values} onChange={setValues} />

        <div className="flex gap-4 pt-4">
          <button onClick={onClose} className={SECONDARY_BUTTON}>Cancel</button>
          <button onClick={handleSubmit} disabled={create.isPending} className={PRIMARY_BUTTON}>
            {create.isPending ? 'Creating...' : 'Create Course'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

const TABS = ['basic', 'curriculum', 'pricing'] as const;
type Tab = (typeof TABS)[number];

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const TabBar = ({ active, onChange }: TabBarProps) => (
  <div className="px-6 flex space-x-8" role="tablist">
    {TABS.map((tab) => (
      <button
        key={tab}
        role="tab"
        aria-selected={active === tab}
        onClick={() => onChange(tab)}
        className={`pb-3 px-1 border-b-2 font-medium text-sm capitalize ${
          active === tab
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
      >
        {tab}
      </button>
    ))}
  </div>
);

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
    <div className="p-6">
      {activeTab === 'basic' && (
        <div className="space-y-6">
          <BasicFields values={values} onChange={setValues} {...choices} />
          <ThumbnailField thumbnail={thumbnail} current={detail.thumbnail || course.thumbnail} />
        </div>
      )}

      {activeTab === 'curriculum' && <CurriculumTab courseId={course.id} />}

      {activeTab === 'pricing' && <PricingFields values={values} onChange={setValues} />}

      <div className="flex gap-4 mt-8">
        <button onClick={onClose} className={SECONDARY_BUTTON}>Cancel</button>
        <button onClick={handleSave} disabled={update.isPending} className={PRIMARY_BUTTON}>
          {update.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
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
      headerExtra={detail.isSuccess ? <TabBar active={activeTab} onChange={setActiveTab} /> : null}
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
