import React from 'react';
import { Plus } from 'lucide-react';

import { lectureWeights, sumWeights, weightStatus } from '../../../../shared/lib/gradeWeight';
import { Badge, TONE_TEXT } from '../../../../shared/ui/Badge';
import { Button } from '../../../../shared/ui/Button';
import { ProgressBar } from '../../../../shared/ui/ProgressBar';
import type { CurriculumSection } from '../../types';

interface CurriculumHeaderProps {
  onAddSection: () => void;
  sections?: CurriculumSection[];
}

const LOOKS = {
  complete: { tone: 'success', label: 'Ready to Publish' },
  over: { tone: 'danger', label: 'Over 100%' },
  under: { tone: 'warning', label: 'Incomplete' },
} as const;

/** The size of the curriculum and how far its graded work is from the 100 % a course needs. */
const CurriculumHeader = ({ onAddSection, sections = [] }: CurriculumHeaderProps) => {
  const totalWeight = sumWeights(lectureWeights(sections));
  const look = LOOKS[weightStatus(totalWeight)];
  const lectures = sections.reduce((count, section) => count + (section.lectures?.length || 0), 0);

  return (
    <div className="rounded-xl border border-line bg-surface-muted/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-fg">Course Curriculum</h3>
          <p className="mt-0.5 text-sm text-fg-muted">
            {sections.length} section{sections.length === 1 ? '' : 's'}, {lectures} lecture{lectures === 1 ? '' : 's'}.
            Drag the handles to reorder.
          </p>
        </div>
        <Button icon={Plus} onClick={onAddSection} className="shrink-0">
          Add Section
        </Button>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className={`font-medium ${TONE_TEXT[look.tone]}`}>Total Grade Weight: {totalWeight.toFixed(2)}%</span>
          <Badge tone={look.tone} dot>{look.label}</Badge>
        </div>
        <ProgressBar
          value={Math.min(totalWeight, 100)}
          tone={look.tone}
          size="sm"
          label="Total grade weight"
          className="mt-2"
        />
        <p className="mt-1.5 text-xs text-fg-subtle">
          The graded quizzes and assignments must add up to exactly 100% before the course can be published.
        </p>
      </div>
    </div>
  );
};

export default CurriculumHeader;
