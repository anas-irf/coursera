import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as notificationsApi from '../api';

/**
 * Query keys of the notifications.  The bell, the page and any badge read these, and a mutation
 * invalidates the whole ``['notifications']`` prefix, so they never disagree.
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  list: (params: { limit: number; includeRead: boolean }) => ['notifications', 'list', params] as const,
};

/** How many notifications are unread (refreshed every minute: the bell is always on screen). */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 60 * 1000,
  });
}

interface NotificationListOptions {
  limit?: number;
  includeRead?: boolean;
  enabled?: boolean;
}

/** The newest notifications; ``enabled`` false until the list is needed (the dropdown is closed). */
export function useNotificationList({
  limit = 20,
  includeRead = true,
  enabled = true,
}: NotificationListOptions = {}) {
  return useQuery({
    queryKey: notificationKeys.list({ limit, includeRead }),
    queryFn: () => notificationsApi.list({ limit, includeRead }),
    enabled,
  });
}

/** Mark notifications as read: ``mutate(ids)``, or ``mutate(null)`` for every unread one. */
export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    // what the server answers is not read, so it is not typed
    mutationFn: (ids: number[] | null): Promise<unknown> => {
      if (ids && ids.length === 1) return notificationsApi.markRead(ids[0]);
      return notificationsApi.markAllRead(ids || undefined);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
