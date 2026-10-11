import api from '../../shared/api/client';

// served below /courses/ for historical reasons
const BASE = '/courses/notifications';

export const unreadCount = () =>
  api.get(`${BASE}/count/`).then((response) => response.data.unread_count);

export const list = ({ limit = 20, includeRead } = {}) => {
  const params = { limit };
  if (includeRead !== undefined) params.include_read = includeRead;
  return api.get(`${BASE}/`, { params }).then((response) => response.data);
};

export const markRead = (id) => api.post(`${BASE}/${id}/read/`);

export const markAllRead = (ids) => Promise.all(ids.map(markRead));
