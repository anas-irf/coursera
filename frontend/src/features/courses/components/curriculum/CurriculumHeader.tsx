import React from 'react';
import { Plus } from 'lucide-react';

import { lectureWeights, sumWeights, weightStatus } from '../../../../shared/lib/gradeWeight';
import type { CurriculumSection } from '../../types';

interface CurriculumHeaderProps {
  onAddSection: () => void;
  sections?: CurriculumSection[];
}

const CurriculumHeader = ({ onAddSection, sections = [] }: CurriculumHeaderProps) => {
  const totalWeight = sumWeights(lectureWeights(sections));
  const status = weightStatus(totalWeight);
  const isComplete = status === 'complete';
  const isOver = status === 'over';

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Course Curriculum</h3>
        <div className="flex items-center gap-4 mt-1">
          <span className={`text-sm font-medium ${
            isComplete ? 'text-green-600' : isOver ? 'text-red-600' : 'text-yellow-600'
          }`}>
            Total Grade Weight: {totalWeight.toFixed(2)}%
          </span>
          <span className={`text-xs px-2 py-1 rounded ${
            isComplete
              ? 'bg-green-100 text-green-700'
              : isOver
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
          }`}>
            {isComplete ? 'Ready to Publish' : isOver ? 'Over 100%' : 'Incomplete'}
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
