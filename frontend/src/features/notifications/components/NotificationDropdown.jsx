import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';

import { timeAgo } from '../../../shared/lib/time';
import * as notificationsApi from '../api';
import NotificationIcon from './NotificationIcon';

/**
 * The bell in the header of every role.
 *
 * ``viewAllPath`` is the page with the full list; roles without one omit it.
 */
const NotificationDropdown = ({ viewAllPath = null, limit = 20 }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const loadCount = useCallback(async () => {
    try {
      setUnreadCount(await notificationsApi.unreadCount());
    } catch (error) {
      // the bell simply shows no badge
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      setNotifications(await notificationsApi.list({ limit }));
    } catch (error) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadCount();
  }, [loadCount]);

  useEffect(() => {
    if (isOpen) loadList();
  }, [isOpen, loadList]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const markRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      // stays unread
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead(notifications.filter((n) => !n.is_read).map((n) => n.id));
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      loadCount();
    }
  };

  const open = (notification) => {
    if (!notification.is_read) markRead(notification.id);
    if (!notification.action_url) return;
    setIsOpen(false);
    if (notification.action_url.startsWith('/')) {
      navigate(notification.action_url);
    } else {
      window.open(notification.action_url, '_blank', 'noopener');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((value) => !value)}
        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg relative transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bell size={48} className="mx-auto text-gray-300 mb-2" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => open(notification)}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        <NotificationIcon type={notification.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-gray-500 mt-2">{timeAgo(notification.created_at)}</p>
                      </div>
                      {!notification.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {viewAllPath && notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate(viewAllPath);
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
