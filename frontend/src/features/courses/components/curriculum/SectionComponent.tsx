import React, { useState } from 'react';
import { ChevronDown, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { cn } from '../../../../shared/lib/cn';
import type { UUID } from '../../../../shared/types';
import { Badge } from '../../../../shared/ui/Badge';
import { Button, IconButton } from '../../../../shared/ui/Button';
import type { CurriculumLecture, CurriculumSection } from '../../types';
import LectureItem from './LectureItem';

interface SectionComponentProps {
  section: CurriculumSection;
  /** The position of the section in the course, from 0. */
  sectionIndex: number;
  onEdit: () => void;
  onDelete: () => void;
  onAddLecture: () => void;
  onEditLecture: (lecture: CurriculumLecture) => void;
  onDeleteLecture: (lectureId: UUID) => void;
  onReorderLectures: (sectionId: UUID, lectures: CurriculumLecture[]) => void;
}

/** A section of the curriculum: drag it by its handle, open or fold its lectures, add one. */
const SectionComponent = ({
  section,
  sectionIndex,
  onEdit,
  onDelete,
  onAddLecture,
  onEditLecture,
  onDeleteLecture,
  onReorderLectures
}: SectionComponentProps) => {
  const [collapsed, setCollapsed] = useState(false);

  // the section itself is sortable among the sections
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: {
      type: 'section',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // its lectures are sortable among themselves
  const lectureSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleLectureDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const lectures = section.lectures || [];
    const oldIndex = lectures.findIndex((lecture) => lecture.id === active.id);
    const newIndex = lectures.findIndex((lecture) => lecture.id === over.id);

    if (oldIndex !== newIndex) {
      onReorderLectures(section.id, arrayMove(lectures, oldIndex, newIndex));
    }
  };

  const count = section.lectures?.length || 0;
  const heading = `Section ${sectionIndex + 1}: ${section.title}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-xl border border-line bg-surface-muted/40',
        isDragging && 'relative z-10 opacity-90 shadow-pop'
      )}
    >
      <div className={cn('flex items-center gap-2 px-3 py-2.5 sm:px-4', !collapsed && 'border-b border-line')}>
        <button
          type="button"
          aria-label={`Move section ${sectionIndex + 1}`}
          className="shrink-0 cursor-grab touch-none rounded text-fg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn('shrink-0 text-fg-subtle transition-transform', collapsed && '-rotate-90')}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-fg">{heading}</span>
            {section.description && <span className="block truncate text-xs text-fg-subtle">{section.description}</span>}
          </span>
        </button>

        <Badge className="hidden sm:inline-flex">
          {count} lecture{count !== 1 ? 's' : ''}
        </Badge>
        {section.is_preview && <Badge tone="info" className="hidden sm:inline-flex">Preview</Badge>}

        <div className="flex shrink-0 items-center">
          <IconButton icon={Plus} label="Add Lecture" size="sm" onClick={onAddLecture} />
          <IconButton icon={Pencil} label="Edit Section" size="sm" onClick={onEdit} />
          <IconButton icon={Trash2} label="Delete Section" size="sm" onClick={onDelete} />
        </div>
      </div>

      {!collapsed && (
        <div className="p-2.5 sm:p-3">
          {count === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm text-fg-muted">No lectures in this section yet.</p>
              <Button variant="soft" size="sm" icon={Plus} onClick={onAddLecture}>
                Add your first lecture
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={lectureSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleLectureDragEnd}
            >
              <SortableContext
                items={section.lectures.map((lecture) => lecture.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {section.lectures.map((lecture) => (
                    <LectureItem
                      key={lecture.id}
                      lecture={lecture}
                      onEdit={() => onEditLecture(lecture)}
                      onDelete={() => onDeleteLecture(lecture.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
};

export default SectionComponent;
