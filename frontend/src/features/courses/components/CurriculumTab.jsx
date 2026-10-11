import React, { useState } from 'react';
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
import useCurriculum from '../hooks/useCurriculum';
import CurriculumHeader from './curriculum/CurriculumHeader';
import EmptyState from './curriculum/EmptyState';
import SectionComponent from './curriculum/SectionComponent';
import SectionModal from './curriculum/SectionModal';
import LectureModal from './curriculum/LectureModal';

const CurriculumTab = ({ courseId }) => {
  const {
    sections,
    loading,
    createSection,
    updateSection,
    deleteSection,
    createLecture,
    updateLecture,
    deleteLecture,
    reorderSections,
    reorderLectures,
    reorderQuizQuestions
  } = useCurriculum(courseId);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [showAddSection, setShowAddSection] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [showAddLecture, setShowAddLecture] = useState(null);
  const [editingLecture, setEditingLecture] = useState(null);

  const handleCreateSection = async (data) => {
    await createSection({ ...data, order: sections.length + 1 });
    setShowAddSection(false);
  };

  const handleUpdateSection = async (data) => {
    await updateSection(editingSection.id, data);
    setEditingSection(null);
  };

  const handleCreateLecture = async (data) => {
    const section = sections.find(s => s.id === showAddLecture);
    const lectureCount = section ? section.lectures.length : 0;
    await createLecture(showAddLecture, { ...data, order: lectureCount + 1 });
    setShowAddLecture(null);
  };

  const handleUpdateLecture = async (data) => {
    await updateLecture(editingLecture.id, data);
    setEditingLecture(null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // Handle section reordering
    if (active.data.current?.type === 'section' && over.data.current?.type === 'section') {
      const oldIndex = sections.findIndex((section) => section.id === active.id);
      const newIndex = sections.findIndex((section) => section.id === over.id);

      if (oldIndex !== newIndex) {
        const newSections = arrayMove(sections, oldIndex, newIndex);
        reorderSections(newSections);
      }
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading curriculum...</div>;
  }

  return (
    <div className="space-y-6">
      <CurriculumHeader onAddSection={() => setShowAddSection(true)} sections={sections} />

      {sections.length === 0 && (
        <EmptyState onAddSection={() => setShowAddSection(true)} />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {sections.map((section, sectionIndex) => (
            <SectionComponent
              key={section.id}
              section={section}
              sectionIndex={sectionIndex}
              onEdit={() => setEditingSection(section)}
              onDelete={() => deleteSection(section.id)}
              onAddLecture={() => setShowAddLecture(section.id)}
              onEditLecture={setEditingLecture}
              onDeleteLecture={deleteLecture}
              onReorderLectures={reorderLectures}
              onReorderQuizQuestions={reorderQuizQuestions}
            />
          ))}
        </SortableContext>
      </DndContext>

      {showAddSection && (
        <SectionModal
          onClose={() => setShowAddSection(false)}
          onSave={handleCreateSection}
          title="Add New Section"
        />
      )}

      {editingSection && (
        <SectionModal
          section={editingSection}
          onClose={() => setEditingSection(null)}
          onSave={handleUpdateSection}
          title="Edit Section"
        />
      )}

      {showAddLecture && (
        <LectureModal
          onClose={() => setShowAddLecture(null)}
          onSave={handleCreateLecture}
          title="Add New Lecture"
        />
      )}

      {editingLecture && (
        <LectureModal
          lecture={editingLecture}
          onClose={() => setEditingLecture(null)}
          onSave={handleUpdateLecture}
          title="Edit Lecture"
        />
      )}
    </div>
  );
};

export default CurriculumTab;