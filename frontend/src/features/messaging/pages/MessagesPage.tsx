import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Plus, Search, Send } from 'lucide-react';

import type { ISODateTime } from '../../../shared/types';
import Avatar from '../../../shared/ui/Avatar';
import ErrorState from '../../../shared/ui/ErrorState';
import Modal from '../../../shared/ui/Modal';
import { PageSpinner } from '../../../shared/ui/Spinner';
import { useToast } from '../../../shared/ui/Toast';
import { useChat } from '../hooks/useChat';
import { useMessageableUsers } from '../hooks/useDirectory';

const clock = (value: ISODateTime | null | undefined): string =>
  value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Direct messages: conversation list, open chat and the "new conversation"
 * dialog.  The same page serves students and instructors.
 */
const MessagesPage = () => {
  const chat = useChat();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [search, setSearch] = useState('');
  const directory = useMessageableUsers({ enabled: showNewChat });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (endRef.current && endRef.current.scrollIntoView) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chat.messages, chat.typing]);

  const matches = useMemo(() => {
    const text = search.toLowerCase();
    return (directory.data || []).filter(
      (user) =>
        (user.name || '').toLowerCase().includes(text) || (user.email || '').toLowerCase().includes(text)
    );
  }, [directory.data, search]);

  const submit = async () => {
    if (!draft.trim() || chat.sending) return;
    if (await chat.send(draft)) {
      setDraft('');
    } else {
      toast.error('Your message could not be sent. Please try again.', 'Message Not Sent');
    }
  };

  const startWith = async (userId: number) => {
    if (await chat.start(userId)) {
      setShowNewChat(false);
      setSearch('');
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
    <div className="flex h-[calc(100vh-120px)] min-h-[480px] bg-white rounded-xl shadow-sm overflow-hidden">
      {/* conversations */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
          <button
            onClick={() => setShowNewChat(true)}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            aria-label="New conversation"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chat.conversations.length > 0 ? (
            chat.conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => chat.open(conversation.id)}
                aria-current={chat.activeId === conversation.id ? 'true' : undefined}
                className={`block w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  chat.activeId === conversation.id ? 'bg-indigo-50 border-indigo-200' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <Avatar name={conversation.other_user.name} className="w-12 h-12 text-sm flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {conversation.other_user.name}
                      </h3>
                      <span className="text-xs text-gray-500">{clock(conversation.last_message_time)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1 capitalize">{conversation.other_user.user_type}</p>
                    <p className="text-sm text-gray-600 truncate">{conversation.last_message}</p>
                  </div>
                  {conversation.unread_count > 0 && (
                    <div className="bg-indigo-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                      {conversation.unread_count}
                    </div>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No conversations yet</p>
              <button
                onClick={() => setShowNewChat(true)}
                className="mt-2 text-indigo-600 hover:text-indigo-800 text-sm"
              >
                Start a conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* open chat */}
      <div className="flex-1 flex flex-col">
        {chat.active ? (
          <>
            <div className="p-4 border-b border-gray-200 bg-white flex items-center space-x-3">
              <Avatar name={chat.active.other_user.name} className="w-10 h-10 text-sm" />
              <div>
                <h3 className="font-medium text-gray-900">{chat.active.other_user.name}</h3>
                <p className="text-sm text-gray-500">{chat.active.other_user.email}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
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
              {chat.messages.map((message) => (
                <div key={message.id} className={`flex ${message.is_own_message ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.is_own_message
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    <p className={`text-xs mt-1 ${message.is_own_message ? 'text-indigo-200' : 'text-gray-500'}`}>
                      {clock(message.created_at)}
                    </p>
                  </div>
                </div>
              ))}
              {chat.typing && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                    <p className="text-sm text-gray-500">Typing...</p>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-end space-x-2">
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
                  placeholder="Type a message..."
                  aria-label="Message"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={1}
                  disabled={chat.sending}
                />
                <button
                  onClick={submit}
                  disabled={!draft.trim() || chat.sending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Send"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-600">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* new conversation */}
      {showNewChat && (
        <Modal title="Start New Conversation" onClose={closeNewChat} size="sm">
          <div className="p-6">
            <div className="relative mb-4">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                aria-label="Search users"
                data-autofocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="max-h-60 overflow-y-auto">
              {directory.isPending && <PageSpinner className="h-24" />}
              {directory.isError && (
                <ErrorState
                  className="py-6"
                  title="The list of people could not be loaded"
                  error={directory.error}
                  onRetry={() => directory.refetch()}
                />
              )}
              {directory.isSuccess &&
                matches.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => startWith(user.id)}
                    className="flex w-full items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg text-left"
                  >
                    <Avatar name={user.name} className="w-8 h-8 text-xs" />
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </button>
                ))}
              {directory.isSuccess && matches.length === 0 && (
                <p className="text-center text-sm text-gray-500 py-6">No users found</p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MessagesPage;
