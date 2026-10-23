import React, { useMemo, useState } from 'react';
import { GraduationCap, Presentation, ShieldCheck, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { formatDate } from '../../../shared/lib/time';
import type { UserType } from '../../../shared/types';
import Avatar from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { Card } from '../../../shared/ui/Card';
import EmptyState from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { SearchInput } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '../../../shared/ui/Table';
import { Tabs } from '../../../shared/ui/Tabs';
import { useAdminUsers } from '../hooks/useAdmin';
import type { AdminUser } from '../types';

type RoleFilter = 'all' | UserType;

const ROLES: Record<UserType, { label: string; icon: LucideIcon; tone: 'primary' | 'success' | 'plus' }> = {
  student: { label: 'Student', icon: GraduationCap, tone: 'primary' },
  instructor: { label: 'Instructor', icon: Presentation, tone: 'success' },
  admin: { label: 'Admin', icon: ShieldCheck, tone: 'plus' },
};

/** What a row says about the user's activity, by role. */
const Activity = ({ user }: { user: AdminUser }) => {
  if (user.user_type === 'student') {
    return (
      <div>
        <p className="text-fg">{user.courses_enrolled || 0} courses enrolled</p>
        <p className="text-xs text-fg-subtle">
          {user.completed_courses || 0} completed, {user.active_courses || 0} active
        </p>
      </div>
    );
  }
  if (user.user_type === 'instructor') {
    return (
      <div>
        <p className="text-fg">{user.courses_created || 0} courses created</p>
        <p className="text-xs text-fg-subtle">
          {user.published_courses || 0} published, {user.students_taught || 0} students taught
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-fg">Administrator</p>
      <p className="text-xs text-fg-subtle">{user.is_superuser ? 'Superuser' : 'Admin'}</p>
    </div>
  );
};

const UsersPage = () => {
  const query = useAdminUsers();
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const users = useMemo(() => query.data || [], [query.data]);
  const counts = useMemo(() => ({
    student: users.filter((user) => user.user_type === 'student').length,
    instructor: users.filter((user) => user.user_type === 'instructor').length,
    admin: users.filter((user) => user.user_type === 'admin').length,
  }), [users]);

  if (query.isPending) {
    return <PageSpinner />;
  }

  if (query.isError) {
    return <ErrorState title="We could not load the users" error={query.error} onRetry={() => query.refetch()} />;
  }

  const term = searchQuery.toLowerCase();
  const filteredUsers = users.filter((user) => {
    const matchesType = filter === 'all' || user.user_type === filter;
    const matchesSearch = user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description={`${users.length} total users (${counts.student} students, ${counts.instructor} instructors, ${counts.admin} admins)`}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs<RoleFilter>
          label="Role"
          variant="pills"
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'All users', count: users.length },
            { value: 'student', label: 'Students', count: counts.student },
            { value: 'instructor', label: 'Instructors', count: counts.instructor },
            { value: 'admin', label: 'Admins', count: counts.admin },
          ]}
        />
        <SearchInput
          label="Search users"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={setSearchQuery}
          className="w-full lg:w-80"
        />
      </div>

      <Card className="overflow-hidden">
        {filteredUsers.length > 0 ? (
          <Table label="Users">
            <THead>
              <tr>
                <TH>User</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Activity</TH>
                <TH>Joined</TH>
              </tr>
            </THead>
            <TBody>
              {filteredUsers.map((user) => {
                const role = ROLES[user.user_type];
                return (
                  <TR key={user.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} className="h-9 w-9 text-xs" />
                        <div className="min-w-0">
                          <p className="whitespace-nowrap font-medium text-fg">{user.name}</p>
                          <p className="flex items-center gap-2 whitespace-nowrap text-xs text-fg-subtle">
                            {user.email}
                            {user.email_verified && <Badge tone="success">Verified</Badge>}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={role.tone} icon={role.icon}>
                        {role.label}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge tone={user.status === 'active' ? 'success' : 'neutral'} dot>
                        {user.status}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap">
                      <Activity user={user} />
                    </TD>
                    <TD className="whitespace-nowrap">
                      <p className="text-fg">{formatDate(user.join_date)}</p>
                      <p className="text-xs text-fg-subtle">
                        {user.last_login ? `Last login ${formatDate(user.last_login)}` : 'Never logged in'}
                      </p>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <EmptyState icon={Users} title="No users found">
            {searchQuery || filter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No users have been registered yet.'}
          </EmptyState>
        )}
      </Card>
    </div>
  );
};

export default UsersPage;
