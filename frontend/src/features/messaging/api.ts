import api from '../../shared/api/client';
import type {
  ChatMessage,
  Conversation,
  ConversationsResponse,
  MarkReadResult,
  MessagesResponse,
  MessagingUser,
  PushedMessage,
  SendResponse,
  UsersResponse,
} from './types';

const BASE = '/messaging';

export const conversations = (): Promise<Conversation[]> =>
  api.get<ConversationsResponse>(`${BASE}/conversations/`).then((response) => response.data.conversations || []);

/** Messages of a conversation; the server marks the incoming ones as read. */
export const messages = (conversationId: string): Promise<ChatMessage[]> =>
  api
    .get<MessagesResponse>(`${BASE}/conversations/${conversationId}/`)
    .then((response) => response.data.messages || []);

export const markRead = (conversationId: string): Promise<MarkReadResult> =>
  api.post<MarkReadResult>(`${BASE}/conversations/${conversationId}/mark-read/`).then((response) => response.data);

/** Sends a message; resolves with the stored message (conversation_id included). */
export const send = (recipientId: number, content: string): Promise<PushedMessage> =>
  api
    .post<SendResponse>(`${BASE}/send/`, { recipient_id: recipientId, content })
    .then((response) => response.data.message);

export const users = (): Promise<MessagingUser[]> =>
  api.get<UsersResponse>(`${BASE}/users/`).then((response) => response.data.users || []);
