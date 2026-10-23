import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Crown, Heart, PlayCircle, Star, Users } from 'lucide-react';

import { BRAND } from '../../../shared/brand';
import { errorMessage, errorStatus } from '../../../shared/api/errors';
import { cn } from '../../../shared/lib/cn';
import type { UUID } from '../../../shared/types';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import CourseThumbnail from '../../../shared/ui/CourseThumbnail';
import { useConfirm } from '../../../shared/ui/ConfirmDialog';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import { useToast } from '../../../shared/ui/Toast';
import { useEnroll, useToggleBookmark } from '../hooks/useLearning';
import { learnersLabel, levelLabel, ratingLabel } from '../lib/catalog';
import type { CatalogCourse } from '../types';

interface CourseCardProps {
  /**
   * A catalogue course.  The "Go to Course" button opens ``course_id`` when the record has one and
   * ``id`` otherwise, as it always did; the catalogue sends no ``course_id``.
   */
  course: CatalogCourse & { course_id?: UUID };
}

// the pills over the picture are solid: they must read on any thumbnail
const PILL = 'rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide shadow-sm';

/** A course of the catalogue: what it is, who teaches it, and the way in (enrol, open or upgrade). */
const CourseCard = ({ course }: CourseCardProps) => {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(Boolean(course.is_bookmarked));
  const enroll = useEnroll();
  const bookmark = useToggleBookmark();
  const toast = useToast();
  const { confirm } = useConfirm();

  const enrolling = enroll.isPending;
  const goToCheckout = () => navigate('/student/checkout');
  const rating = ratingLabel(course.rating);
  const isPlus = course.course_type === 'coursera_plus';
  const gated = isPlus && course.enrollment_message === 'Plus subscription required';

  const handleEnroll = async () => {
    if (!course.can_enroll || enrolling) return;

    try {
      await enroll.mutateAsync(course.id);
      toast.success('Successfully enrolled in course!', 'Enrollment Complete');
    } catch (err) {
      if (errorStatus(err) === 402) {
        const upgrade = await confirm({
          type: 'info',
          title: `${BRAND.plus} Required`,
          message: `This course requires ${BRAND.plus}. Would you like to upgrade now?`,
          confirmText: 'Upgrade Now',
          cancelText: 'Not Now',
        });
        if (upgrade) goToCheckout();
      } else {
        toast.error(errorMessage(err, 'Failed to enroll. Please try again.'), 'Enrollment Failed');
      }
    }
  };

  const toggleBookmark = () => {
    const next = !liked;
    setLiked(next); // optimistic; undone if the server refuses
    bookmark.mutate(course.id, {
      onError: (err) => {
        setLiked(!next);
        toast.error(errorMessage(err, 'The bookmark could not be saved.'), 'Bookmark failed');
      },
    });
  };

  return (
    <Card as="article" aria-label={course.title} className="group flex flex-col overflow-hidden" interactive>
      <div className="relative">
        <CourseThumbnail course={course} className="aspect-video w-full transition-transform duration-300 group-hover:scale-[1.02]" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className={cn(PILL, isPlus ? 'bg-plus text-white' : 'bg-success text-white')}>
            {isPlus ? 'Plus' : 'Free'}
          </span>
          {course.is_enrolled && <span className={cn(PILL, 'bg-primary text-primary-contrast')}>Enrolled</span>}
        </div>
        <button
          type="button"
          onClick={toggleBookmark}
          aria-label={liked ? 'Remove bookmark' : 'Bookmark this course'}
          aria-pressed={liked}
          title={liked ? 'Remove bookmark' : 'Bookmark this course'}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-fg-muted shadow-sm backdrop-blur transition-colors hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Heart size={17} aria-hidden="true" className={liked ? 'fill-danger text-danger' : ''} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="font-semibold text-primary-fg">{course.category}</span>
          {course.level && (
            <>
              <span aria-hidden="true" className="text-fg-subtle">
                &middot;
              </span>
              <span className="text-fg-subtle">{levelLabel(course.level)}</span>
            </>
          )}
        </div>

        <h3 className="mt-1.5 line-clamp-2 font-semibold leading-snug text-fg">{course.title}</h3>
        <p className="mt-1 truncate text-sm text-fg-muted">{course.instructor}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
          {rating && (
            <span className="flex items-center gap-1 font-semibold text-fg">
              <Star size={14} aria-hidden="true" className="fill-warning-fg text-warning-fg" />
              {rating}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users size={14} aria-hidden="true" />
            {learnersLabel(course.students)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={14} aria-hidden="true" />
            {course.duration}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen size={14} aria-hidden="true" />
            {course.modules} modules
          </span>
        </div>

        {course.is_enrolled && course.progress !== undefined && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-fg-muted">Your progress</span>
              <span className="font-medium text-fg tabular-nums">{Math.round(course.progress || 0)}%</span>
            </div>
            <ProgressBar value={course.progress || 0} size="sm" label={`Progress in ${course.title}`} />
          </div>
        )}

        <div className="mt-auto pt-4">
          {course.is_enrolled ? (
            <Button
              block
              variant="soft"
              icon={PlayCircle}
              onClick={() => navigate(`/courses/${course.course_id || course.id}/learn`)}
            >
              Go to Course
            </Button>
          ) : course.can_enroll ? (
            <Button block onClick={handleEnroll} loading={enrolling}>
              {enrolling ? 'Enrolling...' : 'Enroll Now'}
            </Button>
          ) : gated ? (
            <div className="space-y-2">
              <p className="flex items-center justify-center gap-1.5 rounded-lg bg-plus-soft px-3 py-1.5 text-xs font-semibold text-plus-fg">
                <Crown size={14} aria-hidden="true" />
                {BRAND.plus} Required
              </p>
              <Button block variant="secondary" icon={Crown} onClick={goToCheckout}>
                Upgrade to Access
              </Button>
            </div>
          ) : (
            <Button block variant="secondary" disabled>
              {course.enrollment_message || 'Cannot Enroll'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default CourseCard;
