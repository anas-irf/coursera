import { useCallback, useEffect, useRef, useState } from 'react';

import * as messagingApi from '../api';
import { useReconnectingSocket } from './useReconnectingSocket';

const TYPING_VISIBLE_MS = 3000;
const TYPING_IDLE_MS = 1000;

/**
 * State and live updates of the messages page.
 *
 * Every message addressed to or sent by the user arrives on the user socket;
 * the socket of the open conversation only carries typing indicators.
 */
export function useChat() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null); // the conversation list could not be loaded
  const [messagesError, setMessagesError] = useState(null); // the open conversation could not be
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const activeRef = useRef(null);
  const typingTimer = useRef(null);
  const idleTimer = useRef(null);

  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  // a refresh in the background keeps what is shown when it fails; `report` is for the first load
  const reloadConversations = useCallback(async ({ report = false } = {}) => {
    try {
      setConversations(await messagingApi.conversations());
      if (report) setLoadError(null);
    } catch (error) {
      if (report) setLoadError(error);
    }
  }, []);

  const appendMessage = useCallback((message) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  }, []);

  const open = useCallback(
    async (conversationId) => {
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

  const retry = useCallback(() => {
    setLoading(true);
    return reloadConversations({ report: true }).finally(() => setLoading(false));
  }, [reloadConversations]);

  const onUserFrame = useCallback(
    (frame) => {
      if (frame.type !== 'chat_message' || !frame.message) return;
      const { message } = frame;

      if (message.conversation_id === activeRef.current) {
        appendMessage(message);
        if (!message.is_own_message) {
          messagingApi.markRead(message.conversation_id).then(reloadConversations).catch(() => {});
          return;
        }
      }
      reloadConversations();
    },
    [appendMessage, reloadConversations]
  );

  const onChatFrame = useCallback((frame) => {
    if (frame.type !== 'typing') return;
    setTyping(Boolean(frame.is_typing));
    clearTimeout(typingTimer.current);
    if (frame.is_typing) {
      typingTimer.current = setTimeout(() => setTyping(false), TYPING_VISIBLE_MS);
    }
  }, []);

  // the user channel carries everything addressed to this user; it is kept open for its frames
  useReconnectingSocket({ path: '/ws/user/', onMessage: onUserFrame });
  const chat = useReconnectingSocket({
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
    async (text) => {
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
    async (userId) => {
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
