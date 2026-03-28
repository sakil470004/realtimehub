/**
 * Chat Page (Full-Screen Chat View)
 * ==================================
 * 
 * Path: /chats/[chatId]
 * 
 * A dedicated full-screen chat page instead of modal.
 * Provides better real-time updates and UX.
 * 
 * Features:
 * - Full screen chat interface
 * - Real-time messaging via Socket.io
 * - Online/offline status indicators
 * - Message editing and deletion
 * - Read receipts
 * - Typing indicators
 * - Back navigation to chat list
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { socketManager } from '@/lib/socket';

// ========== TYPE DEFINITIONS ==========

interface Message {
  _id: string;
  sender: {
    _id: string;
    username: string;
  };
  content: string;
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  readBy: Array<{
    user: string;
    readAt: string;
  }>;
  createdAt: string;
}

interface Chat {
  _id: string;
  name?: string;
  isGroup: boolean;
  participants: Array<{
    _id: string;
    username: string;
  }>;
}

// ========== COMPONENT ==========

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const chatId = params.chatId as string;
  const { user, isLoading: authLoading } = useAuth();

  // ========== STATE MANAGEMENT ==========

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setError] = useState('');
  const [chat, setChat] = useState<Chat | null>(null);
  const [usersTyping, setUsersTyping] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // ========== LOAD CHAT & MESSAGES ==========

  const loadChat = async () => {
    try {
      const response = await fetch(`/api/chats?id=${chatId}`);
      if (response.ok) {
        const data = await response.json();
        const foundChat = data.chats.find((c: Chat) => c._id === chatId);
        if (foundChat) {
          setChat(foundChat);
          // Initialize online users
          const onlineSet = new Set<string>();
          foundChat.participants.forEach((p) => onlineSet.add(p._id));
          setOnlineUsers(onlineSet);
        }
      }
    } catch (error) {
      console.error('Load chat error:', error);
    }
  };

  const loadMessages = async () => {
    try {
      setIsLoadingMessages(true);
      setError('');

      const response = await fetch(
        `/api/chats/${chatId}/messages?page=1&limit=50`
      );

      if (!response.ok) {
        setError('Failed to load messages');
        return;
      }

      const data = await response.json();
      setMessages(data.messages);

      // Mark messages as read
      setTimeout(() => {
        data.messages.forEach(async (msg: Message) => {
          if (
            !msg.isDeleted &&
            msg.sender._id !== user?._id &&
            !msg.readBy.some((r) => r.user === user?._id)
          ) {
            try {
              await fetch(`/api/messages/${msg._id}/read`, {
                method: 'POST',
              });
            } catch (error) {
              console.error('Mark as read error:', error);
            }
          }
        });
      }, 500);
    } catch (error) {
      console.error('Load messages error:', error);
      setError('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // ========== SEND MESSAGE ==========

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedContent = messageInput.trim();
    if (!trimmedContent) return;

    setIsSending(true);

    try {
      const response = await fetch(
        `/api/chats/${chatId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmedContent }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Add message locally
        setMessages((prev) => [...prev, data.message]);

        // Emit Socket.io event for other users
        const socket = socketManager.getSocket();
        socket?.emit('message_sent', {
          chatId,
          message: data.message,
        });

        setMessageInput('');
        socket?.emit('stop_typing', { chatId });
      } else {
        alert('Failed to send message');
      }
    } catch (error) {
      console.error('Send message error:', error);
      alert('An error occurred');
    } finally {
      setIsSending(false);
    }
  };

  // ========== INITIAL LOAD EFFECT ==========

  useEffect(() => {
    if (authLoading || !user) return;

    loadChat();
    loadMessages();
  }, [chatId, authLoading, user]);

  // ========== SOCKET.IO SETUP ==========

  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket || !chatId) return;

    // Join chat room
    socket.emit('join_chat', { chatId, userId: user?._id });
    console.log(`📍 Joined chat: ${chatId}`);

    // Listen for new messages
    const handleNewMessage = (data: { message: Message }) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m._id === data.message._id);
        return exists ? prev : [...prev, data.message];
      });
    };
    socket.on('message_received', handleNewMessage);

    // Listen for message edits
    const handleEditMessage = (data: { messageId: string; content: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, content: data.content, isEdited: true }
            : msg
        )
      );
    };
    socket.on('message_edited', handleEditMessage);

    // Listen for message deletes
    const handleDeleteMessage = (data: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, isDeleted: true, content: '[message deleted]' }
            : msg
        )
      );
    };
    socket.on('message_deleted', handleDeleteMessage);

    // Listen for typing indicators
    const handleUserTyping = (data: { username: string }) => {
      setUsersTyping((prev) =>
        prev.includes(data.username) ? prev : [...prev, data.username]
      );
      setTimeout(() => {
        setUsersTyping((prev) => prev.filter((u) => u !== data.username));
      }, 3000);
    };
    socket.on('user_typing', handleUserTyping);

    // Listen for online status
    const handleUserStatusChanged = (data: {
      userId: string;
      isOnline: boolean;
    }) => {
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        if (data.isOnline) {
          updated.add(data.userId);
        } else {
          updated.delete(data.userId);
        }
        return updated;
      });
    };
    socket.on('user_status_changed', handleUserStatusChanged);

    // Cleanup
    return () => {
      socket.emit('leave_chat', { chatId, userId: user?._id });
      socket.off('message_received', handleNewMessage);
      socket.off('message_edited', handleEditMessage);
      socket.off('message_deleted', handleDeleteMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_status_changed', handleUserStatusChanged);
    };
  }, [chatId, user?._id]);

  // ========== FORMAT TIME ==========

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // ========== GET OTHER USERS ==========

  const otherUsers = chat?.participants.filter((p) => p._id !== user?._id) || [];

  // ========== RENDER: LOADING ==========

  if (authLoading || !chat) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  // ========== RENDER: MAIN ==========

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* ========== HEADER ========== */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 shadow">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Back Button & Chat Info */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              title="Back to chats"
            >
              <svg
                className="w-6 h-6 text-gray-600 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Chat Name & Status */}
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {chat.name ||
                  otherUsers[0]?.username ||
                  'Chat'}
              </h1>
              {!chat.isGroup && otherUsers.length > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {onlineUsers.has(otherUsers[0]._id) ? (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Online
                    </span>
                  ) : (
                    <span>Offline</span>
                  )}
                </p>
              )}
              {chat.isGroup && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {chat.participants.length} members •{' '}
                  {Array.from(onlineUsers).filter((id) =>
                    chat.participants.some((p) => p._id === id)
                  ).length}{' '}
                  online
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========== MESSAGES AREA ========== */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoadingMessages ? (
          <div className="flex justify-center items-center h-full">
            <div className="spinner w-6 h-6"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = String(message.sender._id) === String(user?._id);

            return (
              <div
                key={message._id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex flex-col ${
                    isOwnMessage ? 'items-end' : 'items-start'
                  } gap-1`}
                >
                  {!isOwnMessage && chat.isGroup && (
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 px-1">
                      {message.sender.username}
                    </p>
                  )}

                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${
                      isOwnMessage
                        ? 'bg-blue-500 text-white rounded-br-none'
                        : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none border border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    {message.isDeleted ? (
                      <p className="italic text-gray-500 dark:text-gray-400">
                        [message deleted]
                      </p>
                    ) : (
                      <p className="break-words">{message.content}</p>
                    )}

                    <div
                      className={`flex items-center gap-2 mt-1 text-xs ${
                        isOwnMessage
                          ? 'text-blue-100'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <span>{formatTime(message.createdAt)}</span>
                      {message.isEdited && <span>📝</span>}
                      {isOwnMessage && message.readBy.length > 0 && (
                        <span>✓✓</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========== TYPING INDICATOR ========== */}
      {usersTyping.length > 0 && (
        <div className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
          {usersTyping.join(', ')}{' '}
          {usersTyping.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* ========== MESSAGE INPUT ========== */}
      <form
        onSubmit={handleSendMessage}
        className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4"
      >
        <div className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={isSending || !messageInput.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isSending ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
