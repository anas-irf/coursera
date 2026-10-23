import React, { useState } from 'react';
import { BookOpen, Compass, Search } from 'lucide-react';

import { ButtonLink } from '../../../shared/ui/Button';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { SearchInput } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { Tabs } from '../../../shared/ui/Tabs';
import EnrolledCourseCard from '../components/EnrolledCourseCard';
import { useMyCourses } from '../hooks/useLearning';
import type { EnrolledCourse, EnrolledView } from '../types';

const isCompleted = (course: EnrolledCourse) => course.status === 'completed';

// what an empty view says when the student has courses, just none of this kind
const NOTHING_HERE: Record<EnrolledView, string> = {
  active: 'Nothing is in progress right now: every course you joined is finished.',
  completed: 'You have not finished a course yet. Keep going!',
  all: 'Try adjusting your search.',
};

const MyLearningPage = () => {
  // every course of the student comes in one list; the tabs only narrow it
  const courses = useMyCourses({ status: 'all' });
  const [view, setView] = useState<EnrolledView>('active'); // in progress, completed, all
  const [searchTerm, setSearchTerm] = useState('');

  const header = (
    <PageHeader
      title="My Learning"
      description="Pick up where you left off, or revisit a course you finished."
      actions={
        <ButtonLink to="/student/explore" variant="secondary" icon={Compass}>
          Explore courses
        </ButtonLink>
      }
    />
  );

  if (courses.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <PageSpinner className="h-64" />
      </div>
    );
  }

  if (courses.isError) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState title="We could not load your courses" error={courses.error} onRetry={() => courses.refetch()} />
      </div>
    );
  }

  const enrolledCourses = courses.data;

  if (enrolledCourses.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={BookOpen}
          title="No enrolled courses"
          className="rounded-xl border border-dashed border-line-strong py-16"
          action={
            <ButtonLink to="/student/explore" icon={Compass}>
              Browse Courses
            </ButtonLink>
          }
        >
          Start your learning journey by enrolling in a course!
        </EmptyState>
      </div>
    );
  }

  const inProgress = enrolledCourses.filter((course) => !isCompleted(course));
  const finished = enrolledCourses.filter(isCompleted);
  const term = searchTerm.trim().toLowerCase();
  const inView = view === 'active' ? inProgress : view === 'completed' ? finished : enrolledCourses;
  const shown = inView.filter(
    (course) => course.title.toLowerCase().includes(term) || course.instructor.toLowerCase().includes(term)
  );

  return (
    <div className="space-y-6">
      {header}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <Tabs
          label="Show"
          value={view}
          onChange={setView}
          items={[
            { value: 'active', label: 'In Progress', count: inProgress.length },
            { value: 'completed', label: 'Completed', count: finished.length },
            { value: 'all', label: 'All Courses', count: enrolledCourses.length },
          ]}
        />
        <SearchInput
          label="Search your courses"
          placeholder="Search your courses..."
          value={searchTerm}
          onChange={setSearchTerm}
          className="md:w-72"
        />
      </div>

      {shown.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="tabpanel" aria-label="Courses">
          {shown.map((course) => (
            <EnrolledCourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Search} title="No courses found" className="rounded-xl border border-dashed border-line-strong py-14">
          {term ? 'Try adjusting your search.' : NOTHING_HERE[view]}
        </EmptyState>
      )}
    </div>
  );
};

export default MyLearningPage;
