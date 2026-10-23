import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Check, CheckCheck } from 'lucide-react';

import { cn } from '../../../shared/lib/cn';
import { timeAgo } from '../../../shared/lib/time';
import { Button, IconButton } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Checkbox } from '../../../shared/ui/Checkbox';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { Field } from '../../../shared/ui/Field';
import { SearchInput, Select } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useMarkRead, useNotificationList } from '../hooks/useNotifications';
import NotificationIcon from '../components/NotificationIcon';

const FILTERS = [
  { value: 'all', label: 'All notifications' },
  { value: 'unread', label: 'Unread' },
  { value: 'enrollment', label: 'Enrollments' },
  { value: 'course_approved', label: 'Course updates' },
  { value: 'assignment_graded', label: 'Grades' },
  { value: 'assignment_due', label: 'Assignments' },
  { value: 'certificate_earned', label: 'Certificates' },
  { value: 'announcement', label: 'Announcements' },
] as const;

type FilterValue = (typeof FILTERS)[number]['value'];

// the value of a select is a string: only the options of the list are filters
const isFilterValue = (value: string): value is FilterValue =>
  FILTERS.some((option) => option.value === value);

/** Every notification of the signed-in user (any role), with search, filters and bulk reading. */
const NotificationsPage = () => {
  const list = useNotificationList({ limit: 100, includeRead: true });
  const markRead = useMarkRead();
  const [selected, setSelected] = useState<number[]>([]);
  const [filterType, setFilterType] = useState<FilterValue>('all');
  const [query, setQuery] = useState('');

  const notifications = useMemo(() => list.data || [], [list.data]);

  const visible = useMemo(() => {
    let rows = notifications;
    if (filterType === 'unread') {
      rows = rows.filter((n) => !n.is_read);
    } else if (filterType !== 'all') {
      rows = rows.filter((n) => n.type === filterType);
    }
    const text = query.trim().toLowerCase();
    if (text) {
      rows = rows.filter(
        (n) => n.title.toLowerCase().includes(text) || n.message.toLowerCase().includes(text)
      );
    }
    return rows;
  }, [notifications, filterType, query]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const read = (ids: number[]) =>
    markRead.mutate(ids, {
      onSuccess: () => setSelected((prev) => prev.filter((id) => !ids.includes(id))),
    });

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));

  // every visible row is ticked (and nothing else): the box unticks them, else it ticks them
  const visibleIds = visible.map((n) => n.id);
  const allVisibleSelected = visible.length > 0 && visibleIds.every((id) => selected.includes(id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={
          <>
            {list.isPending && 'Loading...'}
            {list.isError && 'The list could not be loaded'}
            {list.isSuccess &&
              (unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up!')}
          </>
        }
        actions={
          unreadCount > 0 && (
            <Button
              icon={CheckCheck}
              onClick={() => read(notifications.filter((n) => !n.is_read).map((n) => n.id))}
              loading={markRead.isPending}
            >
              Mark all as read
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          label="Search notifications"
          placeholder="Search notifications..."
          value={query}
          onChange={setQuery}
          className="flex-1"
        />
        <Field label="Show" hideLabel className="sm:w-56">
          <Select
            value={filterType}
            onChange={(e) => {
              const { value } = e.target;
              if (isFilterValue(value)) setFilterType(value);
            }}
          >
            {FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary-soft/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-primary-fg">
            {selected.length} notification{selected.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" icon={Check} onClick={() => read(selected)}>
              Mark as read
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Deselect all
            </Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        {list.isPending ? (
          <PageSpinner className="h-64" />
        ) : list.isError ? (
          <ErrorState error={list.error} title="Could not load your notifications" onRetry={list.refetch} />
        ) : visible.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications found">
            {query ? 'Try adjusting your search query.' : "You're all caught up!"}
          </EmptyState>
        ) : (
          <>
            <div className="border-b border-line bg-surface-muted/60 px-5 py-3">
              <Checkbox
                checked={allVisibleSelected}
                onChange={() => setSelected(allVisibleSelected ? [] : visibleIds)}
                label={<span className="font-normal text-fg-muted">Select all visible ({visible.length})</span>}
              />
            </div>

            <ul className="divide-y divide-line">
              {visible.map((notification) => (
                <li
                  key={notification.id}
                  className={cn(
                    'relative flex items-start gap-3 px-5 py-4 transition-colors sm:gap-4',
                    !notification.is_read && 'bg-primary-soft/30'
                  )}
                >
                  {!notification.is_read && (
                    <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
                  )}
                  <Checkbox
                    checked={selected.includes(notification.id)}
                    onChange={() => toggle(notification.id)}
                    aria-label={`Select "${notification.title}"`}
                    className="mt-2.5"
                  />
                  <NotificationIcon type={notification.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className={cn('text-sm', notification.is_read ? 'font-medium text-fg-muted' : 'font-semibold text-fg')}>
                          {notification.title}
                        </h3>
                        <p className="mt-0.5 text-sm text-fg-muted">{notification.message}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="hidden text-xs text-fg-subtle sm:inline">{timeAgo(notification.created_at)}</span>
                        {!notification.is_read && (
                          <IconButton icon={Check} label="Mark as read" size="sm" onClick={() => read([notification.id])} />
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-xs text-fg-subtle sm:hidden">{timeAgo(notification.created_at)}</span>
                      {notification.action_url && (
                        <Link
                          to={notification.action_url}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary-fg hover:underline"
                        >
                          View details
                          <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
};

export default NotificationsPage;
