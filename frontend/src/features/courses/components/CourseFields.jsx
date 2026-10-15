import React, { cloneElement, useId } from 'react';

import { mediaUrl } from '../../../shared/lib/media';
import { COURSE_TYPES, LEVELS } from '../lib/course';

const INPUT =
  'w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500';

/** A labelled control; the label is tied to it so it can be reached by name. */
const Field = ({ label, hint, children }) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      {cloneElement(children, { id })}
      {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
    </div>
  );
};

/** Title, subtitle, description, category, language, level and hours of a course. */
export const BasicFields = ({ values, onChange, categories = [], languages = [] }) => {
  const set = (name) => (event) => onChange({ ...values, [name]: event.target.value });

  return (
    <div className="space-y-6">
      <Field label="Course Title *">
        <input
          type="text"
          value={values.title}
          onChange={set('title')}
          className={INPUT}
          placeholder="e.g., Complete React Developer Course"
          data-autofocus
        />
      </Field>

      <Field label="Subtitle">
        <input
          type="text"
          value={values.subtitle}
          onChange={set('subtitle')}
          className={INPUT}
          placeholder="Brief description of your course"
        />
      </Field>

      <Field label="Description *">
        <textarea
          rows="4"
          value={values.description}
          onChange={set('description')}
          className={INPUT}
          placeholder="What will students learn in this course?"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Category">
          <select value={values.category} onChange={set('category')} className={INPUT}>
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>{category.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Language">
          <select value={values.language} onChange={set('language')} className={INPUT}>
            <option value="">Select a language</option>
            {languages.map((language) => (
              <option key={language.id} value={String(language.id)}>{language.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Level">
          <select value={values.level} onChange={set('level')} className={INPUT}>
            {LEVELS.map((level) => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Estimated Hours to Complete">
          <input
            type="number"
            value={values.estimated_hours}
            onChange={set('estimated_hours')}
            className={INPUT}
            min="1"
            step="0.5"
          />
        </Field>
      </div>
    </div>
  );
};

/** Whether the course is part of Coursera Plus or free. */
export const PricingFields = ({ values, onChange }) => (
  <Field
    label="Course Type"
    hint={
      values.course_type === 'free'
        ? "Free courses are available to all users but don't generate instructor earnings."
        : 'Coursera Plus courses generate earnings based on student engagement and completion rates.'
    }
  >
    <select
      value={values.course_type}
      onChange={(event) => onChange({ ...values, course_type: event.target.value })}
      className={INPUT}
    >
      {COURSE_TYPES.map((type) => (
        <option key={type.value} value={type.value}>{type.label}</option>
      ))}
    </select>
  </Field>
);

/**
 * The course picture: the one it has, a way to choose another and a preview of the chosen one.
 * ``thumbnail`` is what ``useThumbnail`` returns.
 */
export const ThumbnailField = ({ thumbnail, current = null, required = false }) => {
  const id = useId();
  const showCurrent = current && !thumbnail.preview;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
        Course Thumbnail{required ? ' *' : ''}
      </label>

      {showCurrent && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Current thumbnail:</p>
          <img
            src={mediaUrl(current)}
            alt="Current course thumbnail"
            className="h-24 w-auto rounded-lg border border-gray-200"
          />
        </div>
      )}

      <div className="flex items-center justify-center w-full">
        <label
          htmlFor={id}
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Click to {current ? 'change' : 'upload'}</span> course thumbnail
            </p>
            <p className="text-xs text-gray-500">
              JPEG, JPG, PNG or WebP (Max 5MB){required ? '' : ' - Optional'}
            </p>
          </div>
          <input
            id={id}
            type="file"
            className="hidden"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={thumbnail.pick}
          />
        </label>
      </div>

      {thumbnail.error && <p className="text-sm text-red-600 mt-2">{thumbnail.error}</p>}

      {thumbnail.preview && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">{current ? 'New thumbnail preview:' : 'Preview:'}</p>
          <div className="relative inline-block">
            <img
              src={thumbnail.preview}
              alt="Thumbnail preview"
              className="h-24 w-auto rounded-lg border border-gray-200"
            />
            <button
              type="button"
              onClick={thumbnail.clear}
              aria-label="Remove the chosen thumbnail"
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
