import { useQuery } from '@tanstack/react-query';

import * as messagingApi from '../api';

export const directoryKey = ['messaging', 'users'];

/**
 * The people the user may start a conversation with (those who share a course with them, and
 * the administrators).  Only fetched while the "new conversation" dialog is open.
 */
export function useMessageableUsers({ enabled }) {
  return useQuery({ queryKey: directoryKey, queryFn: messagingApi.users, enabled });
}
