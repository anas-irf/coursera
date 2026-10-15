import api from '../../shared/api/client';

const BASE = '/notifications';

export const unreadCount = () =>
  api.get(`${BASE}/count/`).then((response) => response.data.unread_count);

export const list = ({ limit = 20, includeRead } = {}) => {
  const params = { limit };
  if (includeRead !== undefined) params.include_read = includeRead;
  return api.get(`${BASE}/`, { params }).then((response) => response.data);
};

export const markRead = (id) => api.post(`${BASE}/${id}/read/`);

/** One request for any number of notifications; without ``ids`` every unread one is marked. */
export const markAllRead = (ids) =>
  api.post(`${BASE}/read-all/`, ids ? { ids } : {}).then((response) => response.data);
