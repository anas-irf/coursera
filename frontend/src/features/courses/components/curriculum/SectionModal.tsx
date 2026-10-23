import React, { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { Checkbox } from '../../../../shared/ui/Checkbox';
import { Field } from '../../../../shared/ui/Field';
import { Input, Textarea } from '../../../../shared/ui/Input';
import Modal, { ModalFooter } from '../../../../shared/ui/Modal';
import { useToast } from '../../../../shared/ui/Toast';
import type { CurriculumSection, SectionFormData } from '../../types';

interface SectionModalProps {
  /** The section being edited; none when one is being added. */
  section?: CurriculumSection;
  onClose: () => void;
  onSave: (data: SectionFormData) => Promise<void>;
  title: string;
}

/**
 * Adds or edits a section.  ``onSave`` may reject (the caller reports why): the dialog then
 * stays open with what was typed.
 */
const SectionModal = ({ section, onClose, onSave, title }: SectionModalProps) => {
  const { error } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<SectionFormData>({
    title: section?.title || '',
    description: section?.description || '',
    is_preview: section?.is_preview || false
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      error('Please enter a section title', 'Validation Error');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
    } catch (err) {
      // reported by the caller; the form stays as it is
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-4 p-5 sm:p-6">
          <Field label="Section Title" required>
            <Input
              data-autofocus
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Introduction to React"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="What this section covers"
            />
          </Field>
          <Checkbox
            checked={formData.is_preview}
            onChange={(e) => setFormData({ ...formData, is_preview: e.target.checked })}
            label="Allow free preview of this section"
            description="Visitors can open its lectures before they enrol."
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>
            {section ? 'Update Section' : 'Create Section'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default SectionModal;
