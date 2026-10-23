import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';

import { cn } from '../../../shared/lib/cn';
import { timeAgo } from '../../../shared/lib/time';
import { Button, IconButton } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { usePopover } from '../../../shared/ui/usePopover';
import { useMarkRead, useNotificationList, useUnreadCount } from '../hooks/useNotifications';
import type { AppNotification } from '../types';
import NotificationIcon from './NotificationIcon';

interface NotificationDropdownProps {
  /** The page with the full list; roles without one omit it and the button is not shown. */
  viewAllPath?: string | null;
  /** How many of the newest notifications the dropdown lists. */
  limit?: number;
}

/**
 * The bell in the header of every role.
 *
 * ``viewAllPath`` is the page with the full list; roles without one omit it.  The count and the
 * list come from the same cache as the notifications page, so reading something anywhere
 * updates the badge.
 */
const NotificationDropdown = ({ viewAllPath = null, limit = 20 }: NotificationDropdownProps) => {
  const navigate = useNavigate();
  const { open: isOpen, toggle, close, rootRef, triggerRef } = usePopover();

  const count = useUnreadCount();
  const list = useNotificationList({ limit, enabled: isOpen });
  const markRead = useMarkRead();

  const unreadCount = count.data || 0;
  const notifications = list.data || [];

  const open = (notification: AppNotification) => {
    if (!notification.is_read) markRead.mutate([notification.id]);
    if (!notification.action_url) return;
    close();
    if (notification.action_url.startsWith('/')) {
      navigate(notification.action_url);
    } else {
      window.open(notification.action_url, '_blank', 'noopener');
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <IconButton
        ref={triggerRef}
        icon={Bell}
        label="Notifications"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        badge={unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined}
      />

      {isOpen && (
        <div
          role="dialog"
          aria-label="Latest notifications"
          className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] origin-top-right overflow-hidden rounded-xl border border-line bg-surface-raised shadow-pop animate-scale-in sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-fg">Notifications</h3>
              <p className="text-xs text-fg-subtle">
                {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="xs" icon={CheckCheck} onClick={() => markRead.mutate(null)}>
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {list.isPending ? (
              <PageSpinner className="h-32" />
            ) : list.isError ? (
              <ErrorState
                error={list.error}
                title="Could not load notifications"
                onRetry={list.refetch}
                className="px-4 py-8"
              />
            ) : notifications.length === 0 ? (
              <EmptyState icon={Bell} title="No notifications yet" className="py-10" />
            ) : (
              <ul className="divide-y divide-line">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => open(notification)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none',
                        !notification.is_read && 'bg-primary-soft/40'
                      )}
                    >
                      <NotificationIcon type={notification.type} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block text-sm',
                            notification.is_read ? 'text-fg-muted' : 'font-semibold text-fg'
                          )}
                        >
                          {notification.title}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-fg-muted">{notification.message}</span>
                        <span className="mt-1 block text-[11px] text-fg-subtle">{timeAgo(notification.created_at)}</span>
                      </span>
                      {!notification.is_read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {viewAllPath && notifications.length > 0 && (
            <div className="border-t border-line p-2">
              <Button
                variant="ghost"
                size="sm"
                block
                onClick={() => {
                  close();
                  navigate(viewAllPath);
                }}
              >
                View all notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
