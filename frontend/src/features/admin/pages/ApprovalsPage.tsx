import React, { useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Clock, Eye, XCircle } from 'lucide-react';

import { errorMessage } from '../../../shared/api/errors';
import { isFullWeight } from '../../../shared/lib/gradeWeight';
import { formatDate } from '../../../shared/lib/time';
import type { CourseType, UUID } from '../../../shared/types';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Callout } from '../../../shared/ui/Callout';
import { Card } from '../../../shared/ui/Card';
import CourseThumbnail from '../../../shared/ui/CourseThumbnail';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { Field } from '../../../shared/ui/Field';
import { SearchInput, Textarea } from '../../../shared/ui/Input';
import Modal, { ModalFooter } from '../../../shared/ui/Modal';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { Metric } from '../../../shared/ui/StatCard';
import { useToast } from '../../../shared/ui/Toast';
import { useApproveCourse, usePendingCourses, useRejectCourse } from '../hooks/useAdmin';
import type { PendingCourse } from '../types';

const TypeBadge = ({ type }: { type: CourseType }) =>
  type === 'free' ? <Badge tone="success">Free</Badge> : <Badge tone="plus">Plus</Badge>;

const instructorName = (course: PendingCourse): string => course.instructor?.name || course.instructor?.email;

const weightLabel = (weight: number | null | undefined): string => `${weight || 0}%`;

const ApprovalsPage = () => {
  const pending = usePendingCourses();
  const approve = useApproveCourse();
  const reject = useRejectCourse();
  const toast = useToast();

  const [reviewing, setReviewing] = useState<PendingCourse | null>(null); // the course shown in the review dialog
  const [rejecting, setRejecting] = useState<PendingCourse | null>(null); // the course the rejection reason is asked for
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleApprove = (courseId: UUID) =>
    approve.mutate({ courseId }, {
      onSuccess: () => {
        setReviewing(null);
        toast.success('Course approved successfully!', 'Course Approved');
      },
      onError: (err) =>
        toast.error(errorMessage(err, 'Failed to approve course. Please try again.'), 'Approval Failed'),
    });

  const handleReject = (courseId: UUID) => {
    if (!rejectionReason.trim()) {
      toast.warning('Please provide a rejection reason.', 'Missing Reason');
      return;
    }

    reject.mutate({ courseId, reason: rejectionReason }, {
      onSuccess: () => {
        setRejecting(null);
        setReviewing(null);
        setRejectionReason('');
        toast.success('Course rejected successfully!', 'Course Rejected');
      },
      onError: (err) =>
        toast.error(errorMessage(err, 'Failed to reject course. Please try again.'), 'Rejection Failed'),
    });
  };

  const closeRejection = () => {
    setRejecting(null);
    setRejectionReason('');
  };

  if (pending.isPending) {
    return <PageSpinner />;
  }

  if (pending.isError) {
    return (
      <ErrorState
        title="We could not load the approval queue"
        error={pending.error}
        onRetry={() => pending.refetch()}
      />
    );
  }

  const courses = pending.data;
  const term = searchQuery.toLowerCase();
  const filteredCourses = courses.filter(
    (course) =>
      course.title.toLowerCase().includes(term) ||
      course.instructor?.name?.toLowerCase().includes(term) ||
      course.instructor?.email?.toLowerCase().includes(term)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Approvals"
        description={`${courses.length} course${courses.length === 1 ? '' : 's'} awaiting approval`}
        actions={
          courses.length > 0 && (
            <SearchInput
              label="Search courses or instructors"
              placeholder="Search courses or instructors..."
              value={searchQuery}
              onChange={setSearchQuery}
              className="w-full sm:w-72"
            />
          )
        }
      />

      {courses.length > 0 && (
        <Callout tone="info">
          A course can be published once its graded quizzes and assignments add up to exactly 100% of the final grade.
        </Callout>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredCourses.map((course) => {
          const complete = isFullWeight(course.total_weight);
          return (
            <Card as="article" key={course.id} aria-label={course.title} className="flex flex-col overflow-hidden">
              <div className="flex gap-4 p-5">
                <CourseThumbnail course={course} className="hidden h-20 w-32 shrink-0 rounded-lg sm:block" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold text-fg">{course.title}</h2>
                    <TypeBadge type={course.course_type} />
                  </div>
                  <p className="mt-0.5 text-sm text-fg-muted">by {instructorName(course)}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-fg-subtle">{course.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 border-t border-line px-5 py-4">
                <Metric label="Sections" value={course.sections_count || 0} />
                <Metric label="Lectures" value={course.lectures_count || 0} />
                <Metric label="Duration" value={`${course.duration_hours || 0}h`} />
                <Metric label="Grade Weight" value={weightLabel(course.total_weight)} tone={complete ? 'success' : 'danger'} />
              </div>

              <div className="mt-auto flex flex-col gap-3 border-t border-line bg-surface-muted/40 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
                  <CalendarDays size={14} aria-hidden="true" />
                  Submitted {formatDate(course.submitted_date)}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" icon={Eye} onClick={() => setReviewing(course)}>
                    Review
                  </Button>
                  <Button
                    variant="danger-soft"
                    size="sm"
                    icon={XCircle}
                    onClick={() => setRejecting(course)}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    icon={CheckCircle2}
                    onClick={() => handleApprove(course.id)}
                    disabled={approve.isPending}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredCourses.length === 0 && (
        <Card>
          <EmptyState icon={Clock} title="No pending approvals">
            {searchQuery ? 'Try adjusting your search criteria.' : 'All courses have been reviewed. Great job!'}
          </EmptyState>
        </Card>
      )}

      {/* Course Review Modal */}
      {reviewing && !rejecting && (
        <Modal title="Course Review" description={reviewing.title} onClose={() => setReviewing(null)} size="lg">
          <div className="space-y-6 p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row">
              <CourseThumbnail course={reviewing} className="h-32 w-full shrink-0 rounded-xl sm:w-56" />
              <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Instructor</dt>
                  <dd className="mt-1 font-medium text-fg">{instructorName(reviewing)}</dd>
                  <dd className="text-fg-muted">{reviewing.instructor?.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Category</dt>
                  <dd className="mt-1 text-fg">{reviewing.category}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Course Type</dt>
                  <dd className="mt-1"><TypeBadge type={reviewing.course_type} /></dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Submitted</dt>
                  <dd className="mt-1 text-fg">{formatDate(reviewing.submitted_date)}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Description</h3>
              <p className="mt-1 text-sm text-fg">{reviewing.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Sections', reviewing.sections_count || 0],
                ['Lectures', reviewing.lectures_count || 0],
                ['Duration', `${reviewing.duration_hours || 0}h`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-surface-muted p-4 text-center">
                  <Metric label={String(label)} value={value} />
                </div>
              ))}
              <div className="rounded-lg bg-surface-muted p-4 text-center">
                <Metric
                  label="Grade Weight"
                  value={weightLabel(reviewing.total_weight)}
                  tone={isFullWeight(reviewing.total_weight) ? 'success' : 'danger'}
                />
              </div>
            </div>

            {isFullWeight(reviewing.total_weight) ? (
              <Callout tone="success" title={`Grade Weight: ${reviewing.total_weight}%`}>
                Ready for approval.
              </Callout>
            ) : (
              <Callout tone="danger" icon={AlertCircle} title={`Grade Weight: ${reviewing.total_weight}%`}>
                Missing {Number((100 - (reviewing.total_weight || 0)).toFixed(2))}% before it can be published.
              </Callout>
            )}
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setReviewing(null)}>
              Close
            </Button>
            <Button variant="danger-soft" icon={XCircle} onClick={() => setRejecting(reviewing)}>
              Reject Course
            </Button>
            <Button variant="success" icon={CheckCircle2} onClick={() => handleApprove(reviewing.id)} loading={approve.isPending}>
              Approve Course
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Rejection Form */}
      {rejecting && (
        <Modal title="Reject Course" description={`"${rejecting.title}" goes back to its instructor with your reason.`} onClose={closeRejection} size="sm">
          <div className="p-5 sm:p-6">
            <Field label="Rejection reason" hint="The instructor sees this on the course card.">
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="What has to change before the course can be published?"
                rows={5}
                data-autofocus
              />
            </Field>
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={closeRejection}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => handleReject(rejecting.id)} loading={reject.isPending}>
              Reject Course
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
};

export default ApprovalsPage;
