import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import * as messagingApi from '../api';
import type { MessagingUser } from '../types';

export const directoryKey = ['messaging', 'users'] as const;

/**
 * The people the user may start a conversation with (those who share a course with them, and
 * the administrators).  Only fetched while the "new conversation" dialog is open.
 */
export function useMessageableUsers({ enabled }: { enabled: boolean }): UseQueryResult<MessagingUser[]> {
  return useQuery({ queryKey: directoryKey, queryFn: messagingApi.users, enabled });
}
