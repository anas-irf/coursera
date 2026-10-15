import api from '../../shared/api/client';
import type {
  AppNotification,
  MarkAllReadResponse,
  MarkReadResponse,
  UnreadCountResponse,
} from './types';

const BASE = '/notifications';

/** What ``list`` takes: how many to fetch and whether the ones already read are included. */
export interface ListOptions {
  limit?: number;
  includeRead?: boolean;
}

export const unreadCount = (): Promise<number> =>
  api.get<UnreadCountResponse>(`${BASE}/count/`).then((response) => response.data.unread_count);

export const list = ({ limit = 20, includeRead }: ListOptions = {}): Promise<AppNotification[]> => {
  const params: { limit: number; include_read?: boolean } = { limit };
  if (includeRead !== undefined) params.include_read = includeRead;
  return api.get<AppNotification[]>(`${BASE}/`, { params }).then((response) => response.data);
};

export const markRead = (id: number) => api.post<MarkReadResponse>(`${BASE}/${id}/read/`);

/** One request for any number of notifications; without ``ids`` every unread one is marked. */
export const markAllRead = (ids?: number[]): Promise<MarkAllReadResponse> =>
  api.post<MarkAllReadResponse>(`${BASE}/read-all/`, ids ? { ids } : {}).then((response) => response.data);
