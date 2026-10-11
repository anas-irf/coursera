import React, { useState } from 'react';
import { Plus, Edit3, Trash2, GripVertical } from 'lucide-react';
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
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import LectureItem from './LectureItem';

const SectionComponent = ({
  section,
  sectionIndex,
  onEdit,
  onDelete,
  onAddLecture,
  onEditLecture,
  onDeleteLecture,
  onReorderLectures,
  onReorderQuizQuestions
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // Make section sortable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: section.id,
    data: {
      type: 'section',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Lecture drag sensors
  const lectureSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleLectureDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const lectures = section.lectures || [];
    const oldIndex = lectures.findIndex((lecture) => lecture.id === active.id);
    const newIndex = lectures.findIndex((lecture) => lecture.id === over.id);

    if (oldIndex !== newIndex) {
      const newLectures = arrayMove(lectures, oldIndex, newIndex);
      onReorderLectures(section.id, newLectures);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="border border-gray-200 rounded-lg">
      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GripVertical
            size={16}
            className="text-gray-400 cursor-move"
            {...attributes}
            {...listeners}
          />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-left flex-1"
          >
            <h4 className="font-medium text-gray-900">
              Section {sectionIndex + 1}: {section.title}
            </h4>
            {section.description && (
              <p className="text-sm text-gray-600 mt-1">{section.description}</p>
            )}
          </button>
          <span className="text-sm text-gray-500">
            {section.lectures?.length || 0} lecture{(section.lectures?.length || 0) !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onAddLecture}
            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="Add Lecture"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="Edit Section"
          >
            <Edit3 size={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete Section"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 py-2">
          {section.lectures?.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <p className="text-sm">No lectures in this section yet.</p>
              <button
                onClick={onAddLecture}
                className="mt-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              >
                Add your first lecture
              </button>
            </div>
          ) : (
            <DndContext
              sensors={lectureSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleLectureDragEnd}
            >
              <SortableContext
                items={section.lectures.map(l => l.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {section.lectures.map((lecture, lectureIndex) => (
                    <LectureItem
                      key={lecture.id}
                      lecture={lecture}
                      lectureIndex={lectureIndex}
                      onEdit={() => onEditLecture(lecture)}
                      onDelete={() => onDeleteLecture(lecture.id)}
                      onReorderQuizQuestions={onReorderQuizQuestions}
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