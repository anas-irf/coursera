import React, { useState } from 'react';
import {
  AlertCircle, Award, BarChart3, BookOpen, Calendar, CheckCircle2, Clock, FileText, GraduationCap, Target,
} from 'lucide-react';

import { cn } from '../../../shared/lib/cn';
import { formatDate } from '../../../shared/lib/time';
import type { UUID } from '../../../shared/types';
import { TONE_SOFT, TONE_TEXT } from '../../../shared/ui/Badge';
import { ButtonLink } from '../../../shared/ui/Button';
import { Card, CardBody, CardHeader } from '../../../shared/ui/Card';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { StatCard } from '../../../shared/ui/StatCard';
import { Tabs } from '../../../shared/ui/Tabs';
import { useGradebook } from '../hooks/useAssignments';
import { filterCourses, gradeBand, gradebookStats } from '../lib/grades';
import type { GradeFilter } from '../lib/grades';
import type { GradebookCourse } from '../types';

const HEADER = (
  <PageHeader title="My Grades" description="Your weighted grade in every course, and what it is made of." />
);

interface CourseRowProps {
  course: GradebookCourse;
  selected: boolean;
  onSelect: () => void;
}

/** One course of the list: its title, its progress and the grade with its letter. */
const CourseRow = ({ course, selected, onSelect }: CourseRowProps) => {
  const { tone } = gradeBand(course.final_grade);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'relative flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors sm:flex-row sm:items-start sm:justify-between',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          selected ? 'bg-primary-soft/60' : 'hover:bg-surface-muted/60'
        )}
      >
        {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary" />}
        <div className="min-w-0">
          <h3 className="font-semibold text-fg">{course.course_title}</h3>
          <p className="mt-0.5 text-sm text-fg-muted">Instructor: {course.instructor}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-subtle">
            <span className="flex items-center gap-1">
              <Calendar size={12} aria-hidden="true" />
              Enrolled: {formatDate(course.enrollment_date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} aria-hidden="true" />
              {course.progress_percentage}% Complete
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
          <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold tabular-nums', TONE_SOFT[tone])}>
            <span>{course.letter_grade}</span>
            <span>{course.final_grade.toFixed(1)}%</span>
          </span>
          {course.is_passing ? (
            <span className="flex items-center gap-1 text-xs font-medium text-success-fg">
              <CheckCircle2 size={12} aria-hidden="true" />
              Passing
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-danger-fg">
              <AlertCircle size={12} aria-hidden="true" />
              Below Passing
            </span>
          )}
        </div>
      </button>
    </li>
  );
};

/** The weighted grade of one course and its components. */
const GradeBreakdown = ({ course }: { course: GradebookCourse }) => {
  const { tone } = gradeBand(course.final_grade);
  return (
    <Card className="lg:sticky lg:top-24">
      <CardHeader as="h3" title={course.course_title} description="Grade Breakdown" />
      <CardBody className="space-y-5">
        <div className={cn('rounded-xl px-4 py-5 text-center', TONE_SOFT[tone])}>
          <div className="text-4xl font-bold tracking-tight">{course.letter_grade}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{course.final_grade.toFixed(1)}%</div>
          <p className="mt-1 text-xs opacity-80">Final Grade</p>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-fg">Grade Components</h4>
          {course.components && course.components.length > 0 ? (
            <ul className="space-y-2">
              {course.components.map((component) => {
                const Icon = component.type === 'assignments' ? FileText : Award;
                return (
                  <li key={component.type} className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted/70 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', TONE_SOFT[component.type === 'assignments' ? 'plus' : 'primary'])}>
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize text-fg">{component.type}</p>
                        <p className="text-xs text-fg-subtle">
                          {component.completed}/{component.total} completed
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-sm font-semibold tabular-nums', TONE_TEXT[gradeBand(component.score).tone])}>
                        {component.score.toFixed(1)}%
                      </p>
                      <p className="text-xs text-fg-subtle">Weight: {component.weight}%</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-lg bg-surface-muted/70 py-4 text-center text-sm text-fg-muted">No graded components yet</p>
          )}
        </div>

        <div className="border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-fg">Course Progress</span>
            <span className="text-fg-muted tabular-nums">{course.progress_percentage}%</span>
          </div>
          <ProgressBar value={course.progress_percentage} label={`Progress in ${course.course_title}`} />
        </div>

        <div className="border-t border-line pt-4">
          {course.is_passing ? (
            <p className="flex items-center justify-center gap-2 font-medium text-success-fg">
              <CheckCircle2 size={18} aria-hidden="true" />
              Passing Grade
            </p>
          ) : (
            <p className="flex items-center justify-center gap-2 font-medium text-danger-fg">
              <AlertCircle size={18} aria-hidden="true" />
              Below Passing Threshold
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

const GradesPage = () => {
  const query = useGradebook();
  const [chosenId, setChosenId] = useState<UUID | null>(null);
  const [filter, setFilter] = useState<GradeFilter>('all');

  if (query.isPending) {
    return (
      <div className="space-y-6">
        {HEADER}
        <PageSpinner className="h-64" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-6">
        {HEADER}
        <ErrorState title="We could not load your grades" error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }

  const gradebook = query.data;

  if (!gradebook || gradebook.courses.length === 0) {
    return (
      <div className="space-y-6">
        {HEADER}
        <EmptyState
          icon={GraduationCap}
          title="No Grades Available"
          className="rounded-xl border border-dashed border-line-strong py-16"
          action={
            <ButtonLink to="/student/explore" variant="secondary">
              Explore courses
            </ButtonLink>
          }
        >
          Enroll in courses to see your grades here.
        </EmptyState>
      </div>
    );
  }

  const stats = gradebookStats(gradebook.courses);
  const filteredCourses = filterCourses(gradebook.courses, filter);
  // the first course is shown until the student picks another one
  const selectedCourse = gradebook.courses.find((course) => course.course_id === chosenId) || gradebook.courses[0];

  return (
    <div className="space-y-6">
      {HEADER}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Overall Average"
          value={`${stats.average.toFixed(1)}%`}
          hint="mean of your course grades"
          icon={BarChart3}
          tone={gradeBand(stats.average).tone}
        />
        <StatCard
          label="Passing Courses"
          value={`${stats.passingCourses}/${stats.totalCourses}`}
          hint="at or above the passing grade"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard label="Total Courses" value={stats.totalCourses} hint="with a gradebook" icon={BookOpen} tone="info" />
        <StatCard
          label="Success Rate"
          value={`${stats.successRate.toFixed(0)}%`}
          hint="share of courses you pass"
          icon={Target}
          tone="plus"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-fg">Course Grades</h2>
            <Tabs
              label="Filter"
              variant="pills"
              value={filter}
              onChange={setFilter}
              items={[
                { value: 'all', label: 'All Courses' },
                { value: 'passing', label: 'Passing' },
                { value: 'failing', label: 'Needs Improvement' },
              ]}
            />
          </div>
          {filteredCourses.length > 0 ? (
            <ul className="divide-y divide-line">
              {filteredCourses.map((course) => (
                <CourseRow
                  key={course.course_id}
                  course={course}
                  selected={selectedCourse.course_id === course.course_id}
                  onSelect={() => setChosenId(course.course_id)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState icon={GraduationCap} title="No courses in this view" className="py-10">
              {filter === 'passing' ? 'None of your courses is passing yet.' : 'Every course you take is passing.'}
            </EmptyState>
          )}
        </Card>

        <GradeBreakdown course={selectedCourse} />
      </div>
    </div>
  );
};

export default GradesPage;
