import React, { useState } from 'react';
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
import ErrorState from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import type { UUID } from '../../../shared/types';
import useCurriculum from '../hooks/useCurriculum';
import type { CurriculumLecture, CurriculumSection, LecturePayload, SectionFormData } from '../types';
import CurriculumHeader from './curriculum/CurriculumHeader';
import EmptyState from './curriculum/EmptyState';
import SectionComponent from './curriculum/SectionComponent';
import SectionModal from './curriculum/SectionModal';
import LectureModal from './curriculum/LectureModal';

interface CurriculumTabProps {
  courseId: UUID;
}

const CurriculumTab = ({ courseId }: CurriculumTabProps) => {
  const {
    sections,
    loading,
    error,
    refetch,
    createSection,
    updateSection,
    deleteSection,
    createLecture,
    updateLecture,
    deleteLecture,
    reorderSections,
    reorderLectures
  } = useCurriculum(courseId);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [showAddSection, setShowAddSection] = useState(false);
  const [editingSection, setEditingSection] = useState<CurriculumSection | null>(null);
  // the id of the section a lecture is being added to
  const [showAddLecture, setShowAddLecture] = useState<UUID | null>(null);
  const [editingLecture, setEditingLecture] = useState<CurriculumLecture | null>(null);

  // a change that fails rejects after it was reported: the dialog stays open with its content
  const handleCreateSection = async (data: SectionFormData) => {
    await createSection({ ...data, order: sections.length + 1 });
    setShowAddSection(false);
  };

  const handleUpdateSection = async (data: SectionFormData) => {
    // the dialog is only open while a section is being edited
    if (!editingSection) return;
    await updateSection(editingSection.id, data);
    setEditingSection(null);
  };

  const handleCreateLecture = async (data: LecturePayload) => {
    // the dialog is only open while a section is chosen
    if (!showAddLecture) return;
    const section = sections.find(s => s.id === showAddLecture);
    const lectureCount = section ? section.lectures.length : 0;
    await createLecture(showAddLecture, { ...data, order: lectureCount + 1 });
    setShowAddLecture(null);
  };

  const handleUpdateLecture = async (data: LecturePayload) => {
    // the dialog is only open while a lecture is being edited
    if (!editingLecture) return;
    await updateLecture(editingLecture.id, data);
    setEditingLecture(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
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
    return <PageSpinner className="h-48" />;
  }

  if (error) {
    return <ErrorState title="We could not load the curriculum" error={error} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
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
