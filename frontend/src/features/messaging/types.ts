// Direct messaging: what the REST endpoints answer and what the two sockets carry.  The wire
// format is built in backend/apps/messaging/payloads.py (rows and messages) and consumers.py
// (frames).
import type { ISODateTime, UserType } from '../../shared/types';

/** Somebody a conversation can be had with: the directory, and the other side of a conversation. */
export interface MessagingUser {
  id: number;
  first_name: string;
  last_name: string;
  /** "First Last", or the email address when the user has no name. */
  name: string;
  email: string;
  user_type: UserType;
  avatar: string;
}

/** A row of the conversation list. */
export interface Conversation {
  /** ``conv_<a>_<b>``: the ids of the two users, sorted as text. */
  id: string;
  other_user: MessagingUser;
  last_message: string;
  last_message_time: ISODateTime;
  /** The id of the user who wrote the last message. */
  last_message_sender: number;
  unread_count: number;
  message_count: number;
}

/** Who wrote a message. */
export interface MessageSender {
  id: number;
  name: string;
  user_type: UserType;
}

/**
 * A message.  The history says whether it was read (``is_read``) and not which conversation it
 * belongs to (the request already says so); a message that is pushed or answered to a send
 * carries ``conversation_id`` and no ``is_read`` (see ``PushedMessage``).
 */
export interface ChatMessage {
  id: number;
  sender: MessageSender;
  content: string;
  created_at: ISODateTime;
  /** Whether the viewer wrote it. */
  is_own_message: boolean;
  is_read?: boolean;
  conversation_id?: string;
}

/** A message as the send endpoint answers it and the sockets push it. */
export type PushedMessage = ChatMessage & { conversation_id: string };

// ---------------------------------------------------------------------------------------------
// REST answers
// ---------------------------------------------------------------------------------------------

/** ``GET /messaging/conversations/``. */
export interface ConversationsResponse {
  conversations: Conversation[];
}

/** ``GET /messaging/conversations/<id>/``: the history, oldest first. */
export interface MessagesResponse {
  messages: ChatMessage[];
}

/** ``POST /messaging/send/``. */
export interface SendResponse {
  message: PushedMessage;
}

/** ``GET /messaging/users/``: who the user may write to. */
export interface UsersResponse {
  users: MessagingUser[];
}

/** ``POST /messaging/conversations/<id>/mark-read/``. */
export interface MarkReadResult {
  marked_read: number;
  conversation_id: string;
}

// ---------------------------------------------------------------------------------------------
// Socket frames (JSON text)
// ---------------------------------------------------------------------------------------------

/** A new message, pushed to everybody concerned (``is_own_message`` is set for each receiver). */
export interface MessageFrame {
  type: 'chat_message';
  message: PushedMessage;
}

/** The other side is typing (a typist does not get their own frame back). */
export interface TypingFrame {
  type: 'typing';
  user_id: number;
  is_typing: boolean;
}

/** A frame the server refused, e.g. a message to somebody the user may not write to. */
export interface ErrorFrame {
  type: 'error';
  error: string;
}

/** The answer to a frame that was not JSON: an error that has no type. */
export interface InvalidFrame {
  type?: undefined;
  error: string;
}

/** What arrives on the socket of the user: the messages of every conversation. */
export type UserFrame = MessageFrame;

/** What arrives on the socket of an open conversation (its typing indicators, and the rest). */
export type ChatFrame = MessageFrame | TypingFrame | ErrorFrame | InvalidFrame;

/** What the client sends on the socket of a conversation. */
export type OutgoingFrame =
  | { type: 'typing'; is_typing: boolean }
  | { type: 'chat_message'; recipient_id: number; message: string };
