import React from 'react';
import type { ChangeEvent } from 'react';
import { Crown, Gift, ImagePlus, X } from 'lucide-react';

import { BRAND } from '../../../shared/brand';
import { mediaUrl } from '../../../shared/lib/media';
import { Field } from '../../../shared/ui/Field';
import { Input, Select, Textarea } from '../../../shared/ui/Input';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl';
import type { ThumbnailState } from '../hooks/useThumbnail';
import { LEVELS, isLevel } from '../lib/course';
import type { Category, CourseFormValues, Language } from '../types';
import FileDrop from '../../../shared/ui/FileDrop';

/** The fields of the form whose control holds the text as it is. */
type TextField = 'title' | 'subtitle' | 'description' | 'category' | 'language' | 'estimated_hours';

interface BasicFieldsProps {
  values: CourseFormValues;
  onChange: (values: CourseFormValues) => void;
  categories?: Category[];
  languages?: Language[];
}

/** Title, subtitle, description, category, language, level and hours of a course. */
export const BasicFields = ({ values, onChange, categories = [], languages = [] }: BasicFieldsProps) => {
  const set = (name: TextField) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange({ ...values, [name]: event.target.value });

  return (
    <div className="space-y-5">
      <Field label="Course Title" required>
        <Input
          value={values.title}
          onChange={set('title')}
          placeholder="e.g. The Complete React Developer Course"
          data-autofocus
        />
      </Field>

      <Field label="Subtitle" hint="One line that sells the course in the catalogue.">
        <Input value={values.subtitle} onChange={set('subtitle')} placeholder="Hooks, state and the patterns that scale" />
      </Field>

      <Field label="Description" required>
        <Textarea
          rows={4}
          value={values.description}
          onChange={set('description')}
          placeholder="What will students learn in this course?"
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Category">
          <Select value={values.category} onChange={set('category')}>
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>{category.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Language">
          <Select value={values.language} onChange={set('language')}>
            <option value="">Select a language</option>
            {languages.map((language) => (
              <option key={language.id} value={String(language.id)}>{language.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Level">
          <Select
            value={values.level}
            onChange={(event) => {
              if (isLevel(event.target.value)) onChange({ ...values, level: event.target.value });
            }}
          >
            {LEVELS.map((level) => (
              <option key={level.value} value={level.value}>{level.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="Estimated hours to complete">
          <Input type="number" value={values.estimated_hours} onChange={set('estimated_hours')} min="1" step="0.5" />
        </Field>
      </div>
    </div>
  );
};

interface PricingFieldsProps {
  values: CourseFormValues;
  onChange: (values: CourseFormValues) => void;
}

/** Whether the course is part of Coursera Plus or free. */
export const PricingFields = ({ values, onChange }: PricingFieldsProps) => (
  <div>
    <p className="mb-1.5 text-sm font-medium text-fg">Course Type</p>
    <SegmentedControl
      label="Course Type"
      variant="cards"
      value={values.course_type}
      onChange={(course_type) => onChange({ ...values, course_type })}
      options={[
        {
          value: 'coursera_plus',
          label: BRAND.plus,
          icon: Crown,
          description: 'Open to members. Earns a share of the Plus revenue from engagement and completions.',
        },
        {
          value: 'free',
          label: 'Free course',
          icon: Gift,
          description: 'Open to every learner. Free courses do not generate instructor earnings.',
        },
      ]}
    />
  </div>
);

interface ThumbnailFieldProps {
  /** What ``useThumbnail`` returns. */
  thumbnail: ThumbnailState;
  /** The picture the course has now (a path of the API), if any. */
  current?: string | null;
  required?: boolean;
}

/**
 * The course picture: the one it has, a drop zone to choose another and a preview of the chosen
 * one.  ``thumbnail`` is what ``useThumbnail`` returns.
 */
export const ThumbnailField = ({ thumbnail, current = null, required = false }: ThumbnailFieldProps) => {
  const shown = thumbnail.preview || mediaUrl(current);

  return (
    <Field
      label="Course Thumbnail"
      required={required}
      error={thumbnail.error || undefined}
      hint={`JPEG, PNG or WebP, at most 5 MB${required ? '' : '. Optional: leave it to keep the current one'}.`}
    >
      <ThumbnailPicker thumbnail={thumbnail} shown={shown} replacing={Boolean(current) || Boolean(thumbnail.preview)} />
    </Field>
  );
};

interface ThumbnailPickerProps {
  thumbnail: ThumbnailState;
  /** The picture shown beside the drop zone. */
  shown: string | null;
  replacing: boolean;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/** The preview and the drop zone, side by side from a tablet up (it takes the field's id). */
const ThumbnailPicker = ({ thumbnail, shown, replacing, ...input }: ThumbnailPickerProps) => (
  <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-center">
    <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-surface-muted">
      {shown ? (
        <img src={shown} alt={thumbnail.preview ? 'Thumbnail preview' : 'Current course thumbnail'} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-fg-subtle">
          <ImagePlus size={22} aria-hidden="true" />
          <span className="text-xs">No picture yet</span>
        </div>
      )}
      {thumbnail.preview && (
        <button
          type="button"
          onClick={thumbnail.clear}
          aria-label="Remove the chosen thumbnail"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
    <FileDrop
      {...input}
      accept="image/jpeg,image/jpg,image/png,image/webp"
      icon={ImagePlus}
      title={replacing ? 'Drop a new picture here' : 'Drop the course picture here'}
      hint="16:9 works best, e.g. 1280 x 720"
      buttonLabel={replacing ? 'Choose another' : 'Choose a picture'}
      onFile={(file, reset) => {
        if (!thumbnail.choose(file)) reset();
      }}
    />
  </div>
);
