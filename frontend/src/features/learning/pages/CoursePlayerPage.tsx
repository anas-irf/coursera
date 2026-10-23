import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ListTree, RefreshCw } from 'lucide-react';

import { errorMessage, errorStatus } from '../../../shared/api/errors';
import { cn } from '../../../shared/lib/cn';
import type { UUID } from '../../../shared/types';
import { ButtonLink, IconButton } from '../../../shared/ui/Button';
import { useConfirm } from '../../../shared/ui/ConfirmDialog';
import { Drawer } from '../../../shared/ui/Drawer';
import ErrorState from '../../../shared/ui/ErrorState';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { ThemeToggle } from '../../../shared/ui/ThemeToggle';
import { useToast } from '../../../shared/ui/Toast';
import CourseOutline from '../components/CourseOutline';
import LectureContent from '../components/LectureContent';
import { useCompleteLecture, usePlayer, useRefreshProgress } from '../hooks/usePlayer';
import { allLectures, firstIncomplete } from '../lib/player';
import type { PlayerLecture } from '../types';

const storageKey = (courseId: UUID) => `selectedLecture_${courseId}`;

const readSelection = (courseId: UUID): string | null => {
  try {
    return window.localStorage.getItem(storageKey(courseId));
  } catch (error) {
    return null;
  }
};

const writeSelection = (courseId: UUID, lectureId: UUID) => {
  try {
    window.localStorage.setItem(storageKey(courseId), lectureId);
  } catch (error) {
    // the position is simply not remembered
  }
};

/**
 * The learning interface of one course, on a page of its own: a top bar (back, title, progress,
 * theme), the outline on the left (a drawer on a small screen) and the selected lecture.
 */
const CoursePlayerPage = () => {
  // the route is "/courses/:courseId/learn": the parameter is there whenever this page renders
  const courseId = useParams<{ courseId: string }>().courseId!;
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirm();

  const player = usePlayer(courseId);
  const completeLecture = useCompleteLecture(courseId);
  const refreshProgress = useRefreshProgress(courseId);

  const [chosenId, setChosenId] = useState<UUID | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<UUID, boolean>>({});
  const quizActive = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

  const course = player.data || null;
  const status = errorStatus(player.error) ?? null;

  // an enrolment is required: the student is sent home with the reason
  useEffect(() => {
    if (status === 403) {
      toast.error('You must be enrolled in this course to access learning materials', 'Access Denied');
      navigate('/student', { replace: true });
    }
    // toast changes identity on every render of its provider; only the failure matters here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const lectures = useMemo(() => (course ? allLectures(course.sections) : []), [course]);

  // the lecture shown: the student's choice, else where they stopped last time, else the first
  // one they have not finished
  const selected = useMemo(() => {
    if (!course) return null;
    const wanted = chosenId || readSelection(courseId);
    return lectures.find((lecture) => lecture.id === wanted) || firstIncomplete(course.sections);
  }, [course, lectures, chosenId, courseId]);

  const index = selected ? lectures.findIndex((lecture) => lecture.id === selected.id) : -1;
  const previous = index > 0 ? lectures[index - 1] : null;
  const next = index >= 0 && index < lectures.length - 1 ? lectures[index + 1] : null;

  const select = async (lecture: PlayerLecture) => {
    if (quizActive.current) {
      const leave = await confirm({
        type: 'warning',
        title: 'Quiz in Progress',
        message:
          'You are currently taking a quiz. Switching lectures will end your current quiz attempt. Are you sure you want to continue?',
        confirmText: 'Switch Lecture',
        cancelText: 'Stay on Quiz',
      });
      if (!leave) return;
    }

    setOutlineOpen(false);
    setChosenId(lecture.id);
    writeSelection(courseId, lecture.id);
    if (mainRef.current && typeof mainRef.current.scrollTo === 'function') mainRef.current.scrollTo({ top: 0 });
  };

  const complete = (lectureId: UUID) =>
    completeLecture.mutate(lectureId, {
      onError: (err) =>
        toast.error(errorMessage(err, 'Failed to mark lecture as complete. Please try again.'), 'Update Failed'),
    });

  const handleRefresh = async () => {
    const result = await player.refetch();
    if (result.isError) {
      toast.error(errorMessage(result.error, 'Failed to refresh the course.'), 'Refresh Failed');
    }
  };

  const onQuizActiveChange = useCallback((active: boolean) => {
    quizActive.current = active;
  }, []);

  const toggleSection = (sectionId: UUID) =>
    setCollapsed((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));

  if (player.isPending || status === 403) {
    return <PageSpinner className="min-h-screen bg-canvas" />;
  }

  if (!course) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-card">
          <ErrorState
            className="py-6"
            title="Course not found"
            error={player.error}
            onRetry={() => player.refetch()}
          />
          <div className="flex justify-center pb-2">
            <ButtonLink to="/student/my-learning" variant="ghost" icon={ArrowLeft}>
              Back to my learning
            </ButtonLink>
          </div>
        </div>
      </main>
    );
  }

  const progress = course.progress;
  const refreshing = player.isFetching;
  const outline = (onClose?: () => void) => (
    <CourseOutline
      sections={course.sections}
      progress={progress}
      selectedId={selected ? selected.id : null}
      collapsed={collapsed}
      onToggleSection={toggleSection}
      onSelect={select}
      onClose={onClose}
    />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas supports-[height:100dvh]:h-[100dvh]">
      <header className="flex h-16 shrink-0 items-center gap-1.5 border-b border-line bg-surface px-2 sm:gap-2 sm:px-4">
        <IconButton icon={ListTree} label="Course content" onClick={() => setOutlineOpen(true)} className="lg:hidden" />
        <IconButton icon={ArrowLeft} label="Back to my learning" onClick={() => navigate('/student/my-learning')} />
        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate text-sm font-semibold text-fg sm:text-base">{course.course.title}</h1>
          <p className="hidden truncate text-xs text-fg-subtle sm:block">by {course.course.instructor}</p>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <span className="text-xs font-medium text-fg-muted tabular-nums">
            {progress.progress_percentage}% complete
          </span>
          <ProgressBar
            value={progress.progress_percentage}
            size="sm"
            tone={progress.progress_percentage >= 100 ? 'success' : 'primary'}
            label="Course progress"
            className="w-32"
          />
        </div>
        <IconButton
          icon={RefreshCw}
          label="Refresh course data"
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(refreshing && '[&>svg]:animate-spin')}
        />
        <ThemeToggle />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-80 shrink-0 flex-col border-r border-line bg-surface lg:flex">{outline()}</aside>

        {outlineOpen && (
          <Drawer label="Course content" onClose={() => setOutlineOpen(false)}>
            {outline(() => setOutlineOpen(false))}
          </Drawer>
        )}

        <main ref={mainRef} id="main" className="min-w-0 flex-1 overflow-y-auto">
          <LectureContent
            courseId={courseId}
            lecture={selected}
            onComplete={complete}
            completing={completeLecture.isPending}
            onReload={refreshProgress}
            onQuizActiveChange={onQuizActiveChange}
            previous={previous}
            next={next}
            onNavigate={select}
          />
        </main>
      </div>
    </div>
  );
};

export default CoursePlayerPage;
