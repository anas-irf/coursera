import React from 'react';
import { ListTree, Plus } from 'lucide-react';

import { Button } from '../../../../shared/ui/Button';
import { EmptyState as Empty } from '../../../../shared/ui/EmptyState';

interface EmptyStateProps {
  onAddSection: () => void;
}

/** A course without sections: the way to start its curriculum. */
const EmptyState = ({ onAddSection }: EmptyStateProps) => (
  <div className="rounded-xl border-2 border-dashed border-line-strong">
    <Empty
      icon={ListTree}
      title="No sections yet"
      action={
        <Button icon={Plus} onClick={onAddSection}>
          Add Your First Section
        </Button>
      }
    >
      Start building your course by adding the first section. Lectures, quizzes and assignments go inside it.
    </Empty>
  </div>
);

export default EmptyState;
