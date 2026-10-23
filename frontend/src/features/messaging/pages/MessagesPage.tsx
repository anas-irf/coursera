import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MessageSquare, MessageSquarePlus, Send } from 'lucide-react';

import { cn } from '../../../shared/lib/cn';
import type { ISODateTime } from '../../../shared/types';
import Avatar from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { IconButton } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import ErrorState from '../../../shared/ui/ErrorState';
import { SearchInput } from '../../../shared/ui/Input';
import Modal from '../../../shared/ui/Modal';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useToast } from '../../../shared/ui/Toast';
import { useChat } from '../hooks/useChat';
import { useMessageableUsers } from '../hooks/useDirectory';
import type { ChatMessage } from '../types';

const clock = (value: ISODateTime | null | undefined): string =>
  value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

const dayKey = (value: ISODateTime): string => new Date(value).toDateString();

/** "Today", "Yesterday" or the date: the separators between the days of a conversation. */
const dayLabel = (value: ISODateTime, now = new Date()): string => {
  const date = new Date(value);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

/** The last message of a conversation: the time today, else the date. */
const listTime = (value: ISODateTime | null | undefined): string => {
  if (!value) return '';
  const date = new Date(value);
  return date.toDateString() === new Date().toDateString()
    ? clock(value)
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const ROLE_TONE = { student: 'primary', instructor: 'success', admin: 'plus' } as const;

/** The messages of the open conversation, one group per day. */
const groupByDay = (messages: ChatMessage[]): Array<{ day: string; label: string; messages: ChatMessage[] }> => {
  const groups: Array<{ day: string; label: string; messages: ChatMessage[] }> = [];
  messages.forEach((message) => {
    const day = dayKey(message.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.messages.push(message);
    else groups.push({ day, label: dayLabel(message.created_at), messages: [message] });
  });
  return groups;
};

/**
 * Direct messages: conversation list, open chat and the "new conversation" dialog.  The same
 * page serves every role.  On a phone the list and the chat take turns.
 */
const MessagesPage = () => {
  const chat = useChat();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  // phones show one pane: the list until a conversation is opened
  const [pane, setPane] = useState<'list' | 'chat'>('list');
  const directory = useMessageableUsers({ enabled: showNewChat });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (endRef.current && endRef.current.scrollIntoView) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chat.messages, chat.typing]);

  const matches = useMemo(() => {
    const text = search.toLowerCase();
    return (directory.data || []).filter(
      (user) =>
        (user.name || '').toLowerCase().includes(text) || (user.email || '').toLowerCase().includes(text)
    );
  }, [directory.data, search]);

  const conversations = useMemo(() => {
    const text = filter.trim().toLowerCase();
    if (!text) return chat.conversations;
    return chat.conversations.filter((conversation) => conversation.other_user.name.toLowerCase().includes(text));
  }, [chat.conversations, filter]);

  const days = useMemo(() => groupByDay(chat.messages), [chat.messages]);

  const submit = async () => {
    if (!draft.trim() || chat.sending) return;
    if (await chat.send(draft)) {
      setDraft('');
    } else {
      toast.error('Your message could not be sent. Please try again.', 'Message Not Sent');
    }
  };

  const openConversation = (id: string) => {
    setPane('chat');
    chat.open(id);
  };

  const startWith = async (userId: number) => {
    if (await chat.start(userId)) {
      setShowNewChat(false);
      setSearch('');
      setPane('chat');
    } else {
      toast.error('The conversation could not be started. Please try again.', 'Conversation Not Started');
    }
  };

  const closeNewChat = () => {
    setShowNewChat(false);
    setSearch('');
  };

  if (chat.loading) {
    return <PageSpinner />;
  }

  if (chat.loadError) {
    return (
      <ErrorState
        title="Your conversations could not be loaded"
        error={chat.loadError}
        onRetry={() => chat.retry()}
      />
    );
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[30rem] overflow-hidden rounded-xl border border-line bg-surface shadow-card lg:h-[calc(100dvh-10rem)]">
      {/* conversations */}
      <section
        aria-label="Conversations"
        className={cn(
          'flex w-full shrink-0 flex-col border-line md:w-80 md:border-r lg:w-96',
          pane === 'chat' && 'hidden md:flex'
        )}
      >
        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
          <div>
            <h1 className="text-lg font-semibold text-fg">Messages</h1>
            <p className="text-xs text-fg-subtle">
              {chat.conversations.length} conversation{chat.conversations.length === 1 ? '' : 's'}
            </p>
          </div>
          <IconButton icon={MessageSquarePlus} label="New conversation" variant="soft" onClick={() => setShowNewChat(true)} />
        </div>
        {chat.conversations.length > 0 && (
          <div className="px-4 pb-3">
            <SearchInput label="Filter conversations" placeholder="Filter by name" value={filter} onChange={setFilter} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto border-t border-line">
          {chat.conversations.length > 0 ? (
            <ul className="divide-y divide-line">
              {conversations.map((conversation) => {
                const active = chat.activeId === conversation.id;
                return (
                  <li key={conversation.id}>
                    <button
                      onClick={() => openConversation(conversation.id)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        active ? 'bg-primary-soft/70' : 'hover:bg-surface-muted'
                      )}
                    >
                      {active && <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />}
                      <Avatar name={conversation.other_user.name} className="h-10 w-10 text-sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-fg">{conversation.other_user.name}</span>
                          <span className="shrink-0 text-[11px] text-fg-subtle">{listTime(conversation.last_message_time)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'truncate text-sm',
                              conversation.unread_count > 0 ? 'font-medium text-fg' : 'text-fg-muted'
                            )}
                          >
                            {conversation.last_message}
                          </span>
                          {conversation.unread_count > 0 && (
                            <span className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[11px] font-semibold text-primary-contrast tabular-nums">
                              {conversation.unread_count}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-[11px] capitalize text-fg-subtle">{conversation.other_user.user_type}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {conversations.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-fg-subtle">Nobody of that name</li>
              )}
            </ul>
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="No conversations yet"
              className="py-12"
              action={
                <button
                  onClick={() => setShowNewChat(true)}
                  className="text-sm font-semibold text-primary-fg hover:underline"
                >
                  Start a conversation
                </button>
              }
            >
              Write to an instructor, a classmate or the admins.
            </EmptyState>
          )}
        </div>
      </section>

      {/* open chat */}
      <section
        aria-label="Conversation"
        className={cn('min-w-0 flex-1 flex-col', pane === 'list' ? 'hidden md:flex' : 'flex')}
      >
        {chat.active ? (
          <>
            <div className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-5">
              <IconButton icon={ArrowLeft} label="Back to conversations" onClick={() => setPane('list')} className="md:hidden" />
              <Avatar name={chat.active.other_user.name} className="h-10 w-10 text-sm" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-fg">{chat.active.other_user.name}</h2>
                <p className="truncate text-xs text-fg-subtle">{chat.active.other_user.email}</p>
              </div>
              <Badge tone={ROLE_TONE[chat.active.other_user.user_type]} className="capitalize">
                {chat.active.other_user.user_type}
              </Badge>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto bg-canvas/60 px-3 py-5 sm:px-6">
              {/* what failed is whatever was thrown (``unknown``), hence the Boolean */}
              {Boolean(chat.messagesError) && (
                <ErrorState
                  className="py-6"
                  title="This conversation could not be loaded"
                  error={chat.messagesError}
                  // an open conversation has an id: the test only narrows it
                  onRetry={() => chat.activeId && chat.open(chat.activeId)}
                />
              )}
              {days.map((group) => (
                <div key={group.day} className="space-y-2">
                  <div className="flex items-center gap-3" role="separator" aria-label={group.label}>
                    <span className="h-px flex-1 bg-line" aria-hidden="true" />
                    <span className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{group.label}</span>
                    <span className="h-px flex-1 bg-line" aria-hidden="true" />
                  </div>
                  {group.messages.map((message) => (
                    <div key={message.id} className={cn('flex', message.is_own_message ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[85%] rounded-2xl px-4 py-2 shadow-xs sm:max-w-md',
                          message.is_own_message
                            ? 'rounded-br-md bg-primary text-primary-contrast'
                            : 'rounded-bl-md border border-line bg-surface text-fg'
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                        <p
                          className={cn(
                            'mt-1 text-right text-[11px]',
                            message.is_own_message ? 'text-primary-contrast/70' : 'text-fg-subtle'
                          )}
                        >
                          {clock(message.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {chat.typing && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3" aria-label="Typing">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="border-t border-line bg-surface p-3 sm:p-4">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    chat.notifyTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="Write a message..."
                  aria-label="Message"
                  className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-sm text-fg shadow-xs placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
                  rows={1}
                  disabled={chat.sending}
                />
                <IconButton
                  icon={Send}
                  label="Send"
                  variant="primary"
                  size="lg"
                  onClick={submit}
                  disabled={!draft.trim() || chat.sending}
                  className="h-11 w-11 rounded-xl"
                />
              </div>
              <p className="mt-1.5 hidden text-[11px] text-fg-subtle sm:block">Enter sends, Shift + Enter starts a new line.</p>
            </div>
          </>
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="Select a conversation"
            className="flex-1 bg-canvas/60"
          >
            Choose a conversation from the list, or start a new one.
          </EmptyState>
        )}
      </section>

      {/* new conversation */}
      {showNewChat && (
        <Modal title="Start New Conversation" description="People you share a course with, and the admins." onClose={closeNewChat} size="sm">
          <div className="p-5 sm:p-6">
            <SearchInput
              label="Search users"
              placeholder="Search by name or email"
              data-autofocus
              value={search}
              onChange={setSearch}
            />

            <div className="mt-4 max-h-72 overflow-y-auto">
              {directory.isPending && <PageSpinner className="h-24" />}
              {directory.isError && (
                <ErrorState
                  className="py-6"
                  title="The list of people could not be loaded"
                  error={directory.error}
                  onRetry={() => directory.refetch()}
                />
              )}
              {directory.isSuccess && (
                <ul className="space-y-1">
                  {matches.map((user) => (
                    <li key={user.id}>
                      <button
                        onClick={() => startWith(user.id)}
                        className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Avatar name={user.name} className="h-9 w-9 text-xs" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-fg">{user.name}</span>
                          <span className="block truncate text-xs text-fg-subtle">{user.email}</span>
                        </span>
                        <Badge tone={ROLE_TONE[user.user_type]} className="capitalize">
                          {user.user_type}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {directory.isSuccess && matches.length === 0 && (
                <p className="py-6 text-center text-sm text-fg-subtle">No users found</p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MessagesPage;
