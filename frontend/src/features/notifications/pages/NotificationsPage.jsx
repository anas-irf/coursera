import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, ChevronLeft, Filter, Search } from 'lucide-react';

import { PageSpinner } from '../../../shared/ui/Spinner';
import { timeAgo } from '../../../shared/lib/time';
import * as notificationsApi from '../api';
import NotificationIcon from '../components/NotificationIcon';

const FILTERS = [
  { value: 'all', label: 'All Notifications' },
  { value: 'unread', label: 'Unread' },
  { value: 'enrollment', label: 'Enrollments' },
  { value: 'course_approved', label: 'Course Updates' },
  { value: 'assignment_due', label: 'Assignments' },
  { value: 'certificate_earned', label: 'Certificates' },
  { value: 'announcement', label: 'Announcements' },
];

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setNotifications(await notificationsApi.list({ limit: 100, includeRead: true }));
    } catch (error) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    let rows = notifications;
    if (filterType === 'unread') {
      rows = rows.filter((n) => !n.is_read);
    } else if (filterType !== 'all') {
      rows = rows.filter((n) => n.type === filterType);
    }
    const text = query.trim().toLowerCase();
    if (text) {
      rows = rows.filter(
        (n) => n.title.toLowerCase().includes(text) || n.message.toLowerCase().includes(text)
      );
    }
    return rows;
  }, [notifications, filterType, query]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = async (ids) => {
    try {
      await notificationsApi.markAllRead(ids);
      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true, read_at: now } : n))
      );
      setSelected((prev) => prev.filter((id) => !ids.includes(id)));
    } catch (error) {
      load();
    }
  };

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));

  const allVisibleSelected = visible.length > 0 && selected.length === visible.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markRead(notifications.filter((n) => !n.is_read).map((n) => n.id))}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <CheckCheck size={16} className="mr-2" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Filter size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {selected.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm text-blue-800">
            {selected.length} notification{selected.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => markRead(selected)}
              className="flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              <Check size={14} className="mr-1" />
              Mark as read
            </button>
            <button
              onClick={() => setSelected([])}
              className="px-3 py-1 text-blue-600 text-sm hover:bg-blue-100 rounded transition-colors"
            >
              Deselect all
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <PageSpinner className="py-12 h-auto" color="border-blue-600" />
        ) : visible.length === 0 ? (
          <div className="text-center py-12">
            <Bell size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
            <p className="text-gray-500">
              {query ? 'Try adjusting your search query' : "You're all caught up!"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => setSelected(allVisibleSelected ? [] : visible.map((n) => n.id))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600">Select all visible ({visible.length})</span>
              </label>
            </div>

            {visible.map((notification) => (
              <div
                key={notification.id}
                className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                  !notification.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start space-x-4">
                  <input
                    type="checkbox"
                    checked={selected.includes(notification.id)}
                    onChange={() => toggle(notification.id)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />

                  <div className="flex-shrink-0 mt-1">
                    <NotificationIcon type={notification.type} size={20} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className={`text-sm font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                        <p className="text-xs text-gray-500 mt-2">{timeAgo(notification.created_at)}</p>
                      </div>

                      {!notification.is_read && (
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => markRead([notification.id])}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Mark as read"
                          >
                            <Check size={16} />
                          </button>
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        </div>
                      )}
                    </div>

                    {notification.action_url && (
                      <div className="mt-3">
                        <Link
                          to={notification.action_url}
                          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                        >
                          View Details
                          <ChevronLeft size={14} className="ml-1 rotate-180" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
