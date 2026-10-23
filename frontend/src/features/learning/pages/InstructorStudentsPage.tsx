import React, { useState } from 'react';
import { Activity, Gauge, Search, Users } from 'lucide-react';

import { timeAgo } from '../../../shared/lib/time';
import Avatar from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import type { Tone } from '../../../shared/ui/Badge';
import { Card } from '../../../shared/ui/Card';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { SearchInput } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ProgressBar } from '../../../shared/ui/ProgressBar';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { StatCard } from '../../../shared/ui/StatCard';
import { TBody, TD, TH, THead, TR, Table } from '../../../shared/ui/Table';
import { useInstructorStudents } from '../hooks/useLearning';
import type { InstructorStudent } from '../types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const STATUS: Record<InstructorStudent['status'], { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'primary' },
  completed: { label: 'Completed', tone: 'success' },
  expired: { label: 'Expired', tone: 'neutral' },
  refunded: { label: 'Refunded', tone: 'neutral' },
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, Number(value) || 0));

const InstructorStudentsPage = () => {
  const query = useInstructorStudents();
  const [searchTerm, setSearchTerm] = useState('');

  const header = (
    <PageHeader title="My Students" description="Everyone enrolled in your courses, with how far they got." />
  );

  if (query.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <PageSpinner className="h-64" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState title="We could not load your students" error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }

  const students = query.data;

  if (students.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState icon={Users} title="No Students Yet" className="rounded-xl border border-dashed border-line-strong py-16">
          You don't have any students enrolled in your courses yet. Once students enroll, they'll appear here.
        </EmptyState>
      </div>
    );
  }

  const term = searchTerm.trim().toLowerCase();
  const shown = students.filter(
    (student) =>
      !term ||
      (student.name || '').toLowerCase().includes(term) ||
      (student.email || '').toLowerCase().includes(term)
  );
  const averageProgress = students.reduce((sum, student) => sum + clampPercent(student.progress), 0) / students.length;
  // the roster says when each learner was last active; "this week" is counted here
  const now = Date.now();
  const activeThisWeek = students.filter(
    (student) => student.last_active && now - new Date(student.last_active).getTime() <= WEEK_MS
  ).length;

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Students" value={students.length} hint="across all your courses" icon={Users} />
        <StatCard
          label="Average progress"
          value={`${Math.round(averageProgress)}%`}
          hint="mean of their courses"
          icon={Gauge}
          tone="success"
        />
        <StatCard
          label="Active this week"
          value={activeThisWeek}
          hint="learned in the last 7 days"
          icon={Activity}
          tone="info"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-fg-muted">
            {shown.length === students.length
              ? `${students.length} learner${students.length === 1 ? '' : 's'}`
              : `${shown.length} of ${students.length} learners`}
          </p>
          <SearchInput
            label="Search students"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={setSearchTerm}
            className="sm:w-72"
          />
        </div>

        {shown.length === 0 ? (
          <EmptyState icon={Search} title="No students found" className="py-12">
            No student matches your search.
          </EmptyState>
        ) : (
          <Table label="Students">
            <THead>
              <tr>
                <TH>Student</TH>
                <TH>Courses</TH>
                <TH>Progress</TH>
                <TH>Status</TH>
                <TH>Last active</TH>
              </tr>
            </THead>
            <TBody>
              {shown.map((student) => {
                const status = STATUS[student.status] || STATUS.active;
                const progress = clampPercent(student.progress);
                return (
                  <TR key={student.id}>
                    <TD>
                      <div className="flex min-w-[14rem] items-center gap-3">
                        <Avatar name={student.name} className="h-9 w-9 text-xs" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">{student.name}</p>
                          <p className="truncate text-xs text-fg-subtle">{student.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap">{student.courses_enrolled}</TD>
                    <TD>
                      <div className="flex min-w-[10rem] items-center gap-3">
                        <ProgressBar value={progress} size="sm" label={`Progress of ${student.name}`} className="w-28" />
                        <span className="text-xs font-medium text-fg tabular-nums">{Math.round(progress)}%</span>
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={status.tone} dot>
                        {status.label}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap">{student.last_active ? timeAgo(student.last_active) : 'Never'}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default InstructorStudentsPage;
