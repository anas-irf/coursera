import { useCallback, useEffect, useRef, useState } from 'react';

import * as messagingApi from '../api';
import type { ChatFrame, ChatMessage, Conversation, OutgoingFrame, UserFrame } from '../types';
import { useReconnectingSocket } from './useReconnectingSocket';

const TYPING_VISIBLE_MS = 3000;
const TYPING_IDLE_MS = 1000;

/** What ``useChat`` hands to the messages page. */
export interface UseChatResult {
  conversations: Conversation[];
  /** The open conversation (``null`` until one is chosen). */
  active: Conversation | null;
  activeId: string | null;
  messages: ChatMessage[];
  loading: boolean;
  /** Why the conversation list could not be loaded (whatever was thrown), else ``null``. */
  loadError: unknown;
  /** Why the open conversation could not be loaded, else ``null``. */
  messagesError: unknown;
  sending: boolean;
  typing: boolean;
  open: (conversationId: string) => Promise<void>;
  retry: () => Promise<void>;
  /** Sends ``text`` to the open conversation; ``true`` when it was sent. */
  send: (text: string) => Promise<boolean>;
  /** Starts a conversation with a user and opens it; ``true`` when it was started. */
  start: (userId: number) => Promise<boolean>;
  notifyTyping: () => void;
}

/**
 * State and live updates of the messages page.
 *
 * Every message addressed to or sent by the user arrives on the user socket;
 * the socket of the open conversation only carries typing indicators.
 */
export function useChat(): UseChatResult {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null); // the conversation list could not be loaded
  const [messagesError, setMessagesError] = useState<unknown>(null); // the open conversation could not be
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const activeRef = useRef<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  // a refresh in the background keeps what is shown when it fails; `report` is for the first load
  const reloadConversations = useCallback(async ({ report = false }: { report?: boolean } = {}): Promise<void> => {
    try {
      setConversations(await messagingApi.conversations());
      if (report) setLoadError(null);
    } catch (error) {
      if (report) setLoadError(error);
    }
  }, []);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  }, []);

  const open = useCallback(
    async (conversationId: string): Promise<void> => {
      setActiveId(conversationId);
      activeRef.current = conversationId;
      setTyping(false);
      setMessagesError(null);
      try {
        setMessages(await messagingApi.messages(conversationId));
        reloadConversations(); // unread counters changed
      } catch (error) {
        setMessages([]);
        setMessagesError(error);
      }
    },
    [reloadConversations]
  );

  // first load
  useEffect(() => {
    reloadConversations({ report: true }).finally(() => setLoading(false));
  }, [reloadConversations]);

  const retry = useCallback((): Promise<void> => {
    setLoading(true);
    return reloadConversations({ report: true }).finally(() => setLoading(false));
  }, [reloadConversations]);

  const onUserFrame = useCallback(
    (frame: UserFrame) => {
      if (frame.type !== 'chat_message' || !frame.message) return;
      const { message } = frame;

      if (message.conversation_id === activeRef.current) {
        appendMessage(message);
        if (!message.is_own_message) {
          // wrapped: what the mark-read call answers is not the options of the reload
          messagingApi.markRead(message.conversation_id).then(() => reloadConversations()).catch(() => {});
          return;
        }
      }
      reloadConversations();
    },
    [appendMessage, reloadConversations]
  );

  const onChatFrame = useCallback((frame: ChatFrame) => {
    if (frame.type !== 'typing') return;
    setTyping(Boolean(frame.is_typing));
    clearTimeout(typingTimer.current);
    if (frame.is_typing) {
      typingTimer.current = setTimeout(() => setTyping(false), TYPING_VISIBLE_MS);
    }
  }, []);

  // the user channel carries everything addressed to this user; it is kept open for its frames
  useReconnectingSocket<UserFrame>({ path: '/ws/user/', onMessage: onUserFrame });
  const chat = useReconnectingSocket<ChatFrame, OutgoingFrame>({
    path: activeId ? `/ws/chat/${activeId}/` : null,
    onMessage: onChatFrame,
  });

  useEffect(
    () => () => {
      clearTimeout(typingTimer.current);
      clearTimeout(idleTimer.current);
    },
    []
  );

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const conversation = conversations.find((c) => c.id === activeRef.current);
      const content = text.trim();
      if (!conversation || !content) return false;

      setSending(true);
      try {
        const message = await messagingApi.send(conversation.other_user.id, content);
        appendMessage(message);
        reloadConversations();
        return true;
      } catch (error) {
        return false;
      } finally {
        setSending(false);
      }
    },
    [conversations, appendMessage, reloadConversations]
  );

  const start = useCallback(
    async (userId: number): Promise<boolean> => {
      try {
        const message = await messagingApi.send(userId, 'Hello!');
        await reloadConversations();
        await open(message.conversation_id);
        return true;
      } catch (error) {
        return false;
      }
    },
    [open, reloadConversations]
  );

  /** Call on every keystroke: tells the other side that the user is typing. */
  const notifyTyping = useCallback(() => {
    chat.send({ type: 'typing', is_typing: true });
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => chat.send({ type: 'typing', is_typing: false }), TYPING_IDLE_MS);
  }, [chat]);

  const active = conversations.find((c) => c.id === activeId) || null;

  return {
    conversations,
    active,
    activeId,
    messages,
    loading,
    loadError,
    messagesError,
    sending,
    typing,
    open,
    retry,
    send,
    start,
    notifyTyping,
  };
}
