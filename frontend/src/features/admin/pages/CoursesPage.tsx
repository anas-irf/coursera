import React, { useState } from 'react';
import { BookOpen, Star } from 'lucide-react';

import { COURSE_STATUS } from '../../../shared/lib/courseStatus';
import { isFullWeight } from '../../../shared/lib/gradeWeight';
import { cn } from '../../../shared/lib/cn';
import { formatDate } from '../../../shared/lib/time';
import type { CourseStatus } from '../../../shared/types';
import { Badge } from '../../../shared/ui/Badge';
import { Card } from '../../../shared/ui/Card';
import CourseThumbnail from '../../../shared/ui/CourseThumbnail';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { Field } from '../../../shared/ui/Field';
import { SearchInput, Select } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import StatusBadge from '../../../shared/ui/StatusBadge';
import { Table, TBody, TD, TH, THead, TR } from '../../../shared/ui/Table';
import { useAdminCourses } from '../hooks/useAdmin';

type StatusFilter = 'all' | CourseStatus;

const STATUS_OPTIONS = Object.keys(COURSE_STATUS) as CourseStatus[];

const isStatusFilter = (value: string): value is StatusFilter =>
  value === 'all' || STATUS_OPTIONS.some((status) => status === value);

const CoursesPage = () => {
  const query = useAdminCourses();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (query.isPending) {
    return <PageSpinner />;
  }

  if (query.isError) {
    return (
      <ErrorState title="We could not load the courses" error={query.error} onRetry={() => query.refetch()} />
    );
  }

  const courses = query.data;
  const term = searchQuery.toLowerCase();
  const filteredCourses = courses.filter((course) => {
    const matchesStatus = filter === 'all' || course.status === filter;
    const matchesSearch =
      course.title.toLowerCase().includes(term) ||
      course.instructor.name.toLowerCase().includes(term) ||
      course.instructor.email.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });
  const published = courses.filter((course) => course.status === 'published').length;

  return (
    <div className="space-y-6">
      <PageHeader title="All Courses" description={`${courses.length} total courses, ${published} published`} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          label="Search courses or instructors"
          placeholder="Search courses or instructors..."
          value={searchQuery}
          onChange={setSearchQuery}
          className="flex-1"
        />
        <Field label="Status" hideLabel className="sm:w-56">
          <Select
            value={filter}
            onChange={(e) => {
              if (isStatusFilter(e.target.value)) setFilter(e.target.value);
            }}
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {COURSE_STATUS[status].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Card className="overflow-hidden">
        {filteredCourses.length > 0 ? (
          <Table label="Courses">
            <THead>
              <tr>
                <TH>Course</TH>
                <TH>Instructor</TH>
                <TH>Status</TH>
                <TH>Type</TH>
                <TH align="right">Learners</TH>
                <TH align="right">Rating</TH>
                <TH>Content</TH>
                <TH align="right">Grade Weight</TH>
                <TH>Created</TH>
              </tr>
            </THead>
            <TBody>
              {filteredCourses.map((course) => (
                <TR key={course.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <CourseThumbnail course={course} className="h-10 w-16 shrink-0 rounded-md" />
                      <div className="min-w-0">
                        <p className="max-w-[16rem] truncate font-medium text-fg">{course.title}</p>
                        <p className="text-xs text-fg-subtle">{course.category}</p>
                      </div>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap">
                    <p className="text-fg">{course.instructor.name}</p>
                    <p className="text-xs text-fg-subtle">{course.instructor.email}</p>
                  </TD>
                  <TD>
                    <StatusBadge status={course.status} />
                  </TD>
                  <TD>
                    {course.course_type === 'free' ? <Badge tone="success">Free</Badge> : <Badge tone="plus">Plus</Badge>}
                  </TD>
                  <TD align="right">{(course.total_enrolled || 0).toLocaleString()}</TD>
                  <TD align="right">
                    {course.average_rating > 0 ? (
                      <span className="inline-flex items-center gap-1 text-fg">
                        <Star size={13} aria-hidden="true" className="fill-warning-fg text-warning-fg" />
                        {Number(course.average_rating).toFixed(1)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TD>
                  <TD className="whitespace-nowrap text-xs">
                    {course.sections_count} sections · {course.lectures_count} lectures
                  </TD>
                  <TD align="right">
                    <span className={cn('font-medium', isFullWeight(course.total_weight) ? 'text-success-fg' : 'text-danger-fg')}>
                      {course.total_weight}%
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap">{formatDate(course.created_date)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <EmptyState icon={BookOpen} title="No courses found">
            {searchQuery || filter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No courses have been created yet.'}
          </EmptyState>
        )}
      </Card>
    </div>
  );
};

export default CoursesPage;
