import React, { useState } from 'react';

import Modal from '../../../../shared/ui/Modal';
import { useToast } from '../../../../shared/ui/Toast';

/**
 * Adds or edits a section.  ``onSave`` may reject (the caller reports why): the dialog then
 * stays open with what was typed.
 */
const SectionModal = ({ section, onClose, onSave, title }) => {
  const { error } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: section?.title || '',
    description: section?.description || '',
    is_preview: section?.is_preview || false
  });

  const handleSubmit = async (e) => {
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
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label htmlFor="section-title" className="block text-sm font-medium text-gray-700 mb-2">
            Section Title *
          </label>
          <input
            id="section-title"
            type="text"
            data-autofocus
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g., Introduction to React"
            required
          />
        </div>
        <div>
          <label htmlFor="section-description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="section-description"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Brief description of this section"
          />
        </div>
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_preview}
              onChange={(e) => setFormData({...formData, is_preview: e.target.checked})}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Allow free preview of this section</span>
          </label>
        </div>
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : `${section ? 'Update' : 'Create'} Section`}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default SectionModal;
