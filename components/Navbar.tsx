/**
 * Navbar Component
 * ================
 * 
 * The navigation bar displayed at the top of every page.
 * Shows different content based on authentication status.
 * 
 * Features:
 * - Logo/brand
 * - Navigation links
 * - Notification bell with badge
 * - User menu with logout
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { socketManager } from '@/lib/socket';

export default function Navbar() {
  const { user, logout, isLoading } = useAuth();
  
  // Notification state
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  // Using a more specific type for notifications
  interface NotificationItem {
    _id: string;
    type: 'like' | 'comment';
    sender: { _id: string; username: string };
    post: { content: string } | string;
    read: boolean;
    createdAt: string;
  }
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  
  // User menu state
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // Refs for click outside detection
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  /**
   * Fetch Notifications
   * -------------------
   * Gets notifications from API and updates badge count.
   */
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/notifications?limit=10');
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();

    // Listen for real-time notifications
    const socket = socketManager.getSocket();
    if (socket) {
      socket.on('notification', (notification: NotificationItem) => {
        setNotifications(prev => [notification, ...prev].slice(0, 10));
        setUnreadCount(prev => prev + 1);
      });
    }

    return () => {
      socket?.off('notification');
    };
  }, [user]);

  /**
   * Click Outside Handler
   * ---------------------
   * Closes dropdowns when clicking outside them.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Mark Notifications as Read
   * --------------------------
   * Called when user opens notification dropdown.
   */
  const markAsRead = async () => {
    if (unreadCount === 0) return;

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  // Don't render anything while checking auth
  if (isLoading) {
    return (
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <span className="text-xl font-bold text-blue-600">RealTimeHub</span>
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <Link href={user ? '/feed' : '/login'} className="text-xl font-bold text-blue-600 hover:text-blue-700 transition">
          RealTimeHub
        </Link>

        {/* Navigation Items */}
        {user ? (
          <div className="flex items-center gap-4">
            {/* Create Post Button */}
            <Link
              href="/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              Create Post
            </Link>

            {/* Friends Link */}
            <Link
              href="/friends"
              className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition font-medium text-sm"
            >
              Friends
            </Link>

            {/* Chats Link */}
            <Link
              href="/chats"
              className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition font-medium text-sm"
            >
              Chats
            </Link>

            {/* Notification Bell */}
            <div ref={notificationRef} className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) markAsRead();
                }}
                className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
                aria-label="Notifications"
              >
                {/* Bell Icon */}
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                
                {/* Badge */}
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-gray-500 dark:text-gray-400">
                        No notifications yet
                      </p>
                    ) : (
                      notifications.map((notification,index) => (
                        <div
                          key={index}
                          className={`p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                            !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <p className="text-sm text-gray-800 dark:text-gray-200">
                            <span className="font-medium">{notification.sender?.username || 'Someone'}</span>
                            {' '}
                            {notification.type === 'like' ? 'liked' : 'commented on'} your post
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {new Date(notification.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                {/* User Avatar */}
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline font-medium">{user.username}</span>
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="font-medium text-gray-900 dark:text-white">{user.username}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                  </div>
                  <Link
                    href={`/profile/${user._id}`}
                    className="block px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    onClick={() => setShowUserMenu(false)}
                  >
                    👤 My Profile
                  </Link>
                  <Link
                    href={`/feed?user=${user.username}`}
                    className="block px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    onClick={() => setShowUserMenu(false)}
                  >
                    My Posts
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Not logged in - show auth links
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition font-medium"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
