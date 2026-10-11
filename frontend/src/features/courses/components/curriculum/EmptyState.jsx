import React from 'react';
import { FileText } from 'lucide-react';

const EmptyState = ({ onAddSection }) => {
  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg">
      <div className="text-gray-500 mb-4">
        <FileText size={48} className="mx-auto mb-4 text-gray-400" />
        <p className="text-lg font-medium">No sections yet</p>
        <p className="text-sm">Start building your course by adding the first section.</p>
      </div>
      <button
        onClick={onAddSection}
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Add Your First Section
      </button>
    </div>
  );
};

export default EmptyState;