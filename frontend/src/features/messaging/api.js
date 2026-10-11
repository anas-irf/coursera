import api from '../../shared/api/client';

// served from the "discussions" prefix for historical reasons
const BASE = '/discussions/messages';

export const conversations = () =>
  api.get(`${BASE}/conversations/`).then((response) => response.data.conversations || []);

/** Messages of a conversation; the server marks the incoming ones as read. */
export const messages = (conversationId) =>
  api.get(`${BASE}/conversations/${conversationId}/`).then((response) => response.data.messages || []);

export const markRead = (conversationId) =>
  api.post(`${BASE}/conversations/${conversationId}/mark-read/`).then((response) => response.data);

/** Sends a message; resolves with the stored message (conversation_id included). */
export const send = (recipientId, content) =>
  api
    .post(`${BASE}/send/`, { recipient_id: recipientId, content })
    .then((response) => response.data.message);

export const users = () => api.get(`${BASE}/users/`).then((response) => response.data.users || []);
