import React, { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BookOpen, Crown, Eye, EyeOff, Gift, Pencil, Plus, Search, Send, Star, Trash2 } from 'lucide-react';

import { useAuth } from '../../../shared/auth/AuthProvider';
import { errorMessage } from '../../../shared/api/errors';
import { BRAND } from '../../../shared/brand';
import { formatMoney } from '../../../shared/lib/money';
import { formatDate } from '../../../shared/lib/time';
import type { CourseLevel } from '../../../shared/types';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import type { ButtonVariant } from '../../../shared/ui/Button';
import { Callout } from '../../../shared/ui/Callout';
import { Card } from '../../../shared/ui/Card';
import CourseThumbnail from '../../../shared/ui/CourseThumbnail';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { SearchInput, Select } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import StatusBadge from '../../../shared/ui/StatusBadge';
import { useToast } from '../../../shared/ui/Toast';
import { CreateCourseModal, EditCourseModal } from '../components/CourseModals';
import DeleteCourseModal from '../components/DeleteCourseModal';
import {
  useDeleteCourse,
  useInstructorCourses,
  useSubmitForReview,
  useUnpublishCourse,
} from '../hooks/useCourses';
import { LEVELS } from '../lib/course';
import { isSortKey, isStatusFilter, visibleCourses } from '../lib/courseList';
import type { SortKey, StatusFilter } from '../lib/courseList';
import { LOCKED_DELETE_HINT, LOCKED_EDIT_HINT, isLocked, publishAction } from '../lib/publishing';
import type { PublishTone } from '../lib/publishing';
import type { InstructorCourseRow } from '../types';

// the button of each step of the publishing workflow
const PUBLISH_VARIANTS: Record<PublishTone, ButtonVariant> = {
  success: 'success',
  info: 'primary',
  danger: 'danger-soft',
  waiting: 'secondary',
};

/** "Beginner", "All levels" ... (the form offers three levels, a course may have the fourth). */
const levelLabel = (level: CourseLevel | undefined): string | null => {
  if (!level) return null;
  if (level === 'all_levels') return 'All levels';
  const known = LEVELS.find((option) => option.value === level);
  return known ? known.label : null;
};

/** A figure of a course card: its name over the number (the specs read "Revenue $12.00"). */
const Figure = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs text-fg-subtle">{label}</dt>
    <dd className="mt-0.5 truncate text-sm font-semibold text-fg tabular-nums">{children}</dd>
  </div>
);

interface CourseCardProps {
  course: InstructorCourseRow;
  onEdit: () => void;
  onPublish: () => void;
  onDelete: () => void;
  publishing: boolean;
}

/** One course of the instructor: its state, its figures and what can be done with it. */
const CourseCard = ({ course, onEdit, onPublish, onDelete, publishing }: CourseCardProps) => {
  const action = publishAction(course.status);
  const locked = isLocked(course.status);
  const plus = course.course_type === 'coursera_plus';
  const rating = Number(course.average_rating) || 0;

  return (
    <Card as="article" aria-label={course.title} className="flex flex-col overflow-hidden">
      <CourseThumbnail course={course} className="aspect-video w-full" />

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={course.status} />
          <Badge tone={plus ? 'plus' : 'neutral'} icon={plus ? Crown : Gift}>
            {plus ? 'Plus' : 'Free'}
          </Badge>
        </div>

        <h3 className="mt-3 line-clamp-2 text-base font-semibold text-fg">{course.title}</h3>
        {course.subtitle && <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{course.subtitle}</p>}
        <p className="mt-2 text-xs text-fg-subtle">
          {[
            course.category,
            levelLabel(course.level),
            course.published_date
              ? `Published ${formatDate(course.published_date)}`
              : course.created_at
                ? `Created ${formatDate(course.created_at)}`
                : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>

        <dl className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-line bg-surface-muted/50 px-3 py-2.5">
          <Figure label="Students">{course.total_enrolled}</Figure>
          <Figure label="Rating">
            {rating > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Star size={13} aria-hidden="true" className="fill-warning-fg text-warning-fg" />
                {rating.toFixed(1)}
              </span>
            ) : (
              '-'
            )}
          </Figure>
          <Figure label="Revenue">{formatMoney(course.total_revenue)}</Figure>
        </dl>

        {course.status === 'rejected' && course.rejection_reason && (
          <Callout tone="danger" title="Course Rejected" className="mt-4">
            <p>{course.rejection_reason}</p>
            {course.rejection_date && (
              <p className="mt-1 text-xs text-fg-subtle">Rejected on {formatDate(course.rejection_date)}</p>
            )}
          </Callout>
        )}

        <div className="mt-auto space-y-2 pt-5">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Pencil}
              onClick={onEdit}
              disabled={locked}
              title={locked ? LOCKED_EDIT_HINT : 'Edit course'}
            >
              Edit
            </Button>
            <Button
              variant={PUBLISH_VARIANTS[action.tone]}
              size="sm"
              icon={action.kind === 'unpublish' ? EyeOff : action.kind === 'submit' ? Send : Eye}
              onClick={onPublish}
              disabled={action.disabled}
              loading={publishing}
            >
              {action.label}
            </Button>
          </div>
          <Button
            variant="danger-soft"
            size="sm"
            block
            icon={Trash2}
            onClick={onDelete}
            disabled={locked}
            title={locked ? LOCKED_DELETE_HINT : 'Delete course'}
          >
            Delete Course
          </Button>
        </div>
      </div>
    </Card>
  );
};

const CoursesPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const courses = useInstructorCourses();
  const submitForReview = useSubmitForReview();
  const unpublish = useUnpublishCourse();
  const deleteCourse = useDeleteCourse();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<InstructorCourseRow | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<InstructorCourseRow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOption, setSortOption] = useState<SortKey>('date');
  // the course whose publish button was pressed, while the request runs
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const all = useMemo(() => courses.data || [], [courses.data]);
  const shown = useMemo(
    () => visibleCourses(all, { search: searchTerm, status: statusFilter, sort: sortOption }),
    [all, searchTerm, statusFilter, sortOption]
  );

  const handlePublish = (course: InstructorCourseRow) => {
    const action = publishAction(course.status);
    const done = () => setPublishingId(null);

    if (action.kind === 'submit') {
      setPublishingId(course.id);
      submitForReview.mutate(course.id, {
        onSuccess: (data) => toast.success(data.message || 'Course submitted for review!', 'Submit for Review'),
        onError: (err) => {
          toast.error(
            errorMessage(err, 'Failed to submit course for review. Please try again.'),
            'Submission Failed'
          );
          const detail = err.response && err.response.data;
          if (detail && detail.current_weight !== undefined) {
            toast.warning(
              `Current grade weight: ${detail.current_weight}%. Missing: ${detail.missing_weight}%`,
              'Grade Weight Issue'
            );
          }
        },
        onSettled: done,
      });
    } else if (action.kind === 'unpublish') {
      setPublishingId(course.id);
      unpublish.mutate(course.id, {
        onSuccess: (data) =>
          toast.success(
            data.message || 'Course has been unpublished successfully! You can now edit the course.',
            'Course Unpublished'
          ),
        onError: (err) =>
          toast.error(errorMessage(err, 'Failed to unpublish course. Please try again.'), 'Unpublish Failed'),
        onSettled: done,
      });
    }
  };

  // errors are re-thrown so the dialog can show them
  const handleDeleteConfirm = async (course: InstructorCourseRow, confirmation: string) => {
    const { title } = course;
    await deleteCourse.mutateAsync({ courseId: course.id, confirmation });
    setCourseToDelete(null);
    toast.success(`Course "${title}" has been successfully deleted.`, 'Course Deleted');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortOption('date');
  };

  const published = all.filter((course) => course.status === 'published').length;
  const waiting = all.filter((course) => course.status === 'pending_review').length;

  const header = (
    <PageHeader
      title="My Courses"
      description={
        courses.isSuccess && all.length > 0
          ? `${all.length} course${all.length === 1 ? '' : 's'}: ${published} published, ${waiting} in review`
          : 'Create courses, build their curriculum and send them for review.'
      }
      actions={
        <Button icon={Plus} onClick={() => setShowCreateModal(true)}>
          Create New Course
        </Button>
      }
    />
  );

  if (courses.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <PageSpinner className="h-72" />
      </div>
    );
  }

  if (courses.isError) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <ErrorState
            title="We could not load your courses"
            error={courses.error}
            onRetry={() => courses.refetch()}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {all.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            label="Search courses"
            placeholder="Search your courses..."
            value={searchTerm}
            onChange={setSearchTerm}
            className="sm:flex-1"
          />
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Select
              aria-label="Status"
              value={statusFilter}
              onChange={(e) => {
                if (isStatusFilter(e.target.value)) setStatusFilter(e.target.value);
              }}
              className="sm:w-44"
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="pending_review">Pending Review</option>
              <option value="rejected">Rejected</option>
            </Select>
            <Select
              aria-label="Sort"
              value={sortOption}
              onChange={(e) => {
                if (isSortKey(e.target.value)) setSortOption(e.target.value);
              }}
              className="sm:w-44"
            >
              <option value="date">Newest first</option>
              <option value="revenue">Most revenue</option>
              <option value="students">Most students</option>
            </Select>
          </div>
        </div>
      )}

      {shown.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onEdit={() => setSelectedCourse(course)}
              onPublish={() => handlePublish(course)}
              onDelete={() => setCourseToDelete(course)}
              publishing={publishingId === course.id}
            />
          ))}
        </div>
      )}

      {/* nothing matches the search or the filter */}
      {shown.length === 0 && all.length > 0 && (
        <Card>
          <EmptyState
            icon={Search}
            title="No courses found"
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          >
            Try adjusting your search or filter criteria.
          </EmptyState>
        </Card>
      )}

      {/* no course at all */}
      {all.length === 0 && (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            action={
              <Button icon={Plus} onClick={() => setShowCreateModal(true)}>
                Create Your First Course
              </Button>
            }
          >
            {`Create your first course, add sections and lectures, then request publication. Plus courses earn a share of ${BRAND.plus}.`}
          </EmptyState>
        </Card>
      )}

      {showCreateModal && (
        <CreateCourseModal
          onClose={() => setShowCreateModal(false)}
          onSave={() => setShowCreateModal(false)}
        />
      )}

      {selectedCourse && (
        <EditCourseModal
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          onSave={() => setSelectedCourse(null)}
        />
      )}

      {courseToDelete && (
        <DeleteCourseModal
          course={courseToDelete}
          currentUser={user}
          onClose={() => setCourseToDelete(null)}
          onConfirm={(confirmation) => handleDeleteConfirm(courseToDelete, confirmation)}
        />
      )}
    </div>
  );
};

export default CoursesPage;
