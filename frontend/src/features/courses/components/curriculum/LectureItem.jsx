import React from 'react';
import { Edit3, Trash2, GripVertical, Play, FileText, HelpCircle, ClipboardList } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const LectureItem = ({ lecture, lectureIndex, onEdit, onDelete, onReorderQuizQuestions }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lecture.id,
    data: {
      type: 'lecture',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const getLectureIcon = (contentType) => {
    switch (contentType) {
      case 'video': return <Play size={16} className="text-blue-600" />;
      case 'article': return <FileText size={16} className="text-green-600" />;
      case 'quiz': return <HelpCircle size={16} className="text-yellow-600" />;
      case 'assignment': return <ClipboardList size={16} className="text-red-600" />;
      default: return <FileText size={16} className="text-gray-600" />;
    }
  };

  const getLectureTypeLabel = (contentType) => {
    const labels = {
      'video': 'Video Lecture',
      'article': 'Reading',
      'quiz': 'Quiz',
      'assignment': 'Assignment',
      'resource': 'Resource'
    };
    return labels[contentType] || 'Content';
  };

  const getWeightDisplay = () => {
    if (lecture.content_type === 'quiz' && lecture.quiz_settings?.weight) {
      return lecture.quiz_settings.weight > 0 ? `${lecture.quiz_settings.weight}%` : 'Ungraded';
    }
    if (lecture.content_type === 'assignment' && lecture.assignment_settings?.weight) {
      return lecture.assignment_settings.weight > 0 ? `${lecture.assignment_settings.weight}%` : 'Ungraded';
    }
    return null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <GripVertical
        size={14}
        className="text-gray-400 cursor-move"
        {...attributes}
        {...listeners}
      />
      {getLectureIcon(lecture.content_type)}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{lecture.title}</span>
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
            {getLectureTypeLabel(lecture.content_type)}
          </span>
          {getWeightDisplay() && (
            <span className={`text-xs px-2 py-1 rounded font-medium ${
              getWeightDisplay() === 'Ungraded'
                ? 'bg-gray-100 text-gray-600'
                : 'bg-green-100 text-green-700'
            }`}>
              {getWeightDisplay()}
            </span>
          )}
        </div>
        {lecture.description && (
          <p className="text-sm text-gray-600 mt-1">{lecture.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="p-1 text-gray-400 hover:text-indigo-600 rounded"
          title="Edit Lecture"
        >
          <Edit3 size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-gray-400 hover:text-red-600 rounded"
          title="Delete Lecture"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default LectureItem;