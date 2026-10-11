import React from 'react';
import { Plus } from 'lucide-react';

const CurriculumHeader = ({ onAddSection, sections = [] }) => {
  const calculateTotalWeight = () => {
    let totalWeight = 0;
    sections.forEach(section => {
      section.lectures?.forEach(lecture => {
        if (lecture.content_type === 'quiz' && lecture.quiz_settings?.weight) {
          totalWeight += parseFloat(lecture.quiz_settings.weight) || 0;
        }
        if (lecture.content_type === 'assignment' && lecture.assignment_settings?.weight) {
          totalWeight += parseFloat(lecture.assignment_settings.weight) || 0;
        }
      });
    });
    return totalWeight;
  };

  const totalWeight = calculateTotalWeight();
  const isComplete = totalWeight === 100;

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Course Curriculum</h3>
        <div className="flex items-center gap-4 mt-1">
          <span className={`text-sm font-medium ${
            isComplete ? 'text-green-600' : totalWeight > 100 ? 'text-red-600' : 'text-yellow-600'
          }`}>
            Total Grade Weight: {totalWeight.toFixed(2)}%
          </span>
          <span className={`text-xs px-2 py-1 rounded ${
            isComplete
              ? 'bg-green-100 text-green-700'
              : totalWeight > 100
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
          }`}>
            {isComplete ? 'Ready to Publish' : totalWeight > 100 ? 'Over 100%' : 'Incomplete'}
          </span>
        </div>
      </div>
      <button
        onClick={onAddSection}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <Plus size={16} />
        Add Section
      </button>
    </div>
  );
};

export default CurriculumHeader;