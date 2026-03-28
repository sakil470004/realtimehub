/**
 * Chat Modal Component
 * ====================
 * 
 * Purpose: A reusable modal for displaying and managing conversations (DM or group chat).
 * 
 * Features:
 * - Display messages in chronological order
 * - Send new messages with validation
 * - Edit/delete existing messages
 * - Show message edit history (e.g., "[edited]")
 * - Read receipts (who has read this message)
 * - Typing indicator (show when others are typing)
 * - Online status of participants
 * - Auto-scroll to newest messages
 * - Real-time updates via Socket.io
 * - Mobile responsive
 * 
 * Usage:
 * ```tsx
 * <ChatModal
 *   isOpen={true}
 *   onClose={() => setIsOpen(false)}
 *   chatId="chat_123"
 *   chatName="John Doe"
 *   isGroup={false}
 *   participants={[...]}
 * />
 * ```
 * 
 * Layout:
 * ┌─────────────────────────────────────┐
 * │ ✕ Chat Name  👤 Online/Offline      │
 * ├─────────────────────────────────────┤
 * │ [March 28, 2024]                    │
 * │ Friend: Hi there!                   │
 * │ You: Hey, how are you?              │
 * │ Friend: All good! ✓✓ 2:30 PM        │
 * │ You: Great! 📝 2:31 PM              │
 * │ Friend: Is typing...                │
 * ├─────────────────────────────────────┤
 * │ [Message input area]   [Send] (↵)  │
 * └─────────────────────────────────────┘
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { socketManager } from '@/lib/socket';

// ========== TYPE DEFINITIONS ==========

/**
 * Message structure
 * Used for rendering individual messages with all metadata
 */
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

/**
 * Chat structure
 * Contains conversation metadata and participants
 */
interface Chat {
  _id: string;
  name?: string;
  isGroup: boolean;
  participants: Array<{
    _id: string;
    username: string;
    isOnline?: boolean;
  }>;
  lastMessage?: string;
  lastMessageAt?: string;
}

/**
 * Modal component props
 */
interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  chatName: string;
  isGroup: boolean;
  participants: Chat['participants'];
}

// ========== COMPONENT ==========

export default function ChatModal({
  isOpen,
  onClose,
  chatId,
  chatName,
  isGroup,
  participants,
}: ChatModalProps) {
  const { user } = useAuth();

  // ========== STATE MANAGEMENT ==========

  // All messages in the chat
  const [messages, setMessages] = useState<Message[]>([]);

  // New message being typed
  const [messageInput, setMessageInput] = useState('');

  // Is a request in progress
  const [isSending, setIsSending] = useState(false);

  // Loading messages
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  // Error handling
  const [error, setError] = useState('');

  // Pagination for messages
  const [page, setPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  // Typing indicator
  const [usersTyping, setUsersTyping] = useState<string[]>([]);

  // Message being edited (null = not editing)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Refs for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Online status of participants
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // ========== LOAD INITIAL MESSAGES ==========

  /**
   * Fetch messages when chat is opened
   * Messages are sorted newest first and reversed for display
   */
  const loadMessages = async (pageNum = 1) => {
    try {
      setIsLoadingMessages(true);
      setError('');

      // API call: GET /api/chats/[chatId]/messages
      // Query params: page, limit
      // Returns: { messages: [...], hasMore: boolean, total: number }
      const response = await fetch(
        `/api/chats/${chatId}/messages?page=${pageNum}&limit=30`
      );

      if (!response.ok) {
        setError('Failed to load messages');
        return;
      }

      const data = await response.json();

      // On first page, set messages
      // On subsequent pages, prepend (for infinite scroll)
      if (pageNum === 1) {
        setMessages(data.messages);
      } else {
        setMessages((prev) => [...data.messages, ...prev]);
      }

      setHasMoreMessages(data.hasMore);
    } catch (error) {
      console.error('Load messages error:', error);
      setError('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // ========== SEND MESSAGE ==========

  /**
   * Send a new message or save an edited message
   */
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate message
    const trimmedContent = messageInput.trim();
    if (!trimmedContent) return;
    if (trimmedContent.length > 1000) {
      alert('Message must be 1000 characters or less');
      return;
    }

    setIsSending(true);

    try {
      if (editingMessageId) {
        // ========== EDIT MESSAGE FLOW ==========

        // API call: PUT /api/messages/[messageId]
        // Request: { content: string }
        const response = await fetch(
          `/api/messages/${editingMessageId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: trimmedContent }),
          }
        );

        if (response.ok) {
          const updatedMessage = await response.json();

          // Update message in list
          setMessages((prev) =>
            prev.map((msg) =>
              msg._id === editingMessageId
                ? {
                    ...msg,
                    content: updatedMessage.content,
                    isEdited: updatedMessage.isEdited,
                    editedAt: updatedMessage.editedAt,
                  }
                : msg
            )
          );

          // Call Socket.io to notify others
          const socket = socketManager.getSocket();
          socket?.emit('message_edited', {
            messageId: editingMessageId,
            chatId,
            content: trimmedContent,
          });

          // Clear edit mode
          setEditingMessageId(null);
          setEditingContent('');
          setMessageInput('');
        } else {
          alert('Failed to edit message');
        }
      } else {
        // ========== SEND NEW MESSAGE FLOW ==========

        // API call: POST /api/chats/[chatId]/messages
        // Request: { content: string }
        // Response: { message: Message }
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

          // Add new message to list
          setMessages((prev) => [...prev, data.message]);

          // Emit Socket.io event for real-time updates
          const socket = socketManager.getSocket();
          socket?.emit('message_sent', {
            chatId,
            message: data.message,
          });

          // Clear input
          setMessageInput('');

          // Stop typing indicator broadcast
          socket?.emit('stop_typing', { chatId });
        } else {
          alert('Failed to send message');
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
      alert('An error occurred');
    } finally {
      setIsSending(false);
    }
  };

  // ========== EDIT MESSAGE ==========

  /**
   * Start editing a message
   * Populate the message input with current content
   */
  const handleStartEdit = (message: Message) => {
    setEditingMessageId(message._id);
    setEditingContent(message.content);
    setMessageInput(message.content);
  };

  /**
   * Cancel editing
   * Restore message input to empty
   */
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
    setMessageInput('');
  };

  // ========== DELETE MESSAGE ==========

  /**
   * Delete a message (soft delete)
   * Message content is cleared and marked as deleted
   */
  const handleDeleteMessage = async (messageId: string) => {
    try {
      // API call: DELETE /api/messages/[messageId]
      const response = await fetch(
        `/api/messages/${messageId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        // Update message in list to show as deleted
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                  ...msg,
                  isDeleted: true,
                  content: '[message deleted]',
                }
              : msg
          )
        );

        // Emit Socket.io event
        const socket = socketManager.getSocket();
        socket?.emit('message_deleted', {
          messageId,
          chatId,
        });

        setDeleteConfirm(null);
      } else {
        alert('Failed to delete message');
      }
    } catch (error) {
      console.error('Delete message error:', error);
      alert('An error occurred');
    }
  };

  // ========== MARK MESSAGES AS READ ==========

  /**
   * Mark all unread messages as read
   * Called when user opens the chat
   */
  const markMessagesAsRead = async () => {
    // Find unread messages
    const unreadMessages = messages.filter(
      (msg) =>
        !msg.isDeleted &&
        msg.sender._id !== user?.id &&
        !msg.readBy.some((r) => r.user === user?.id)
    );

    for (const message of unreadMessages) {
      try {
        // API call: POST /api/messages/[messageId]/read
        await fetch(
          `/api/messages/${message._id}/read`,
          { method: 'POST' }
        );
      } catch (error) {
        console.error('Mark as read error:', error);
      }
    }
  };

  // ========== TYPING INDICATOR ==========

  /**
   * Broadcast typing status
   * Called when user types in message input
   * Throttled to avoid too many Socket.io events
   */
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const handleTyping = () => {
    // Broadcast that user is typing
    const socket = socketManager.getSocket();
    socket?.emit('start_typing', { chatId, username: user?.username });

    // Clear previous timeout
    clearTimeout(typingTimeoutRef.current);

    // After 2 seconds of no typing, broadcast stop typing
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit('stop_typing', { chatId });
    }, 2000);
  };

  // ========== INITIAL LOAD EFFECT ==========

  /**
   * Load messages when chat opens
   * Set up Socket.io listeners for real-time updates
   */
  useEffect(() => {
    if (!isOpen) return;

    // Step 1: Load initial messages
    loadMessages(1);

    // Step 2: Mark messages as read
    setTimeout(() => {
      markMessagesAsRead();
    }, 500);

    // Step 3: Initialize online users from participants
    // When chat opens, mark all participants as potentially online
    // They'll be confirmed online/offline via Socket.io events
    const initialOnlineUsers = new Set<string>();
    participants.forEach((p) => {
      initialOnlineUsers.add(p._id);
    });
    setOnlineUsers(initialOnlineUsers);

    // Step 4: Set up Socket.io listeners
    const socket = socketManager.getSocket();
    if (!socket) return;

    // Step 4a: Join this specific chat room
    // This allows the server to broadcast messages to only users in this chat
    socket.emit('join_chat', { 
      chatId, 
      userId: user?.id 
    });
    console.log(`📍 Joined chat room: chat_${chatId}`);

    // Listen for new messages
    const handleNewMessage = (data: { message: Message }) => {
      // Prevent duplicate messages (sender already added message from API response)
      setMessages((prev) => {
        // Check if message already exists
        const messageExists = prev.some((msg) => msg._id === data.message._id);
        if (messageExists) {
          return prev; // Don't add duplicate
        }
        return [...prev, data.message];
      });
    };
    socket.on('message_received', handleNewMessage);

    // Listen for message edits
    const handleEditMessage = (data: {
      messageId: string;
      content: string;
    }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? {
                ...msg,
                content: data.content,
                isEdited: true,
              }
            : msg
        )
      );
    };
    socket.on('message_edited', handleEditMessage);

    // Listen for message deletes
    const handleDeletedMessage = (data: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, isDeleted: true, content: '[message deleted]' }
            : msg
        )
      );
    };
    socket.on('message_deleted', handleDeletedMessage);

    // Listen for typing indicator
    const handleUserTyping = (data: { username: string }) => {
      setUsersTyping((prev) => {
        // Add user if not already typing
        if (!prev.includes(data.username)) {
          return [...prev, data.username];
        }
        return prev;
      });

      // Auto-remove after 3 seconds
      setTimeout(() => {
        setUsersTyping((prev) =>
          prev.filter((u) => u !== data.username)
        );
      }, 3000);
    };
    socket.on('user_typing', handleUserTyping);

    // Listen for user stopped typing
    const handleUserStoppedTyping = (data: { username: string }) => {
      setUsersTyping((prev) =>
        prev.filter((u) => u !== data.username)
      );
    };
    socket.on('user_stopped_typing', handleUserStoppedTyping);

    // Listen for user online/offline status changes
    const handleUserStatusChanged = (data: {
      userId: string;
      username: string;
      isOnline: boolean;
    }) => {
      // Step 1: Update online users Set based on status change
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

    // Cleanup listeners and leave chat room when modal closes
    return () => {
      // Emit leave_chat event
      socket.emit('leave_chat', {
        chatId,
        userId: user?.id
      });
      console.log(`📍 Left chat room: chat_${chatId}`);

      // Remove all listeners
      socket.off('message_received', handleNewMessage);
      socket.off('message_edited', handleEditMessage);
      socket.off('message_deleted', handleDeletedMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
      socket.off('user_status_changed', handleUserStatusChanged);
    };
  }, [isOpen, chatId]);

  // ========== AUTO-SCROLL EFFECT ==========

  /**
   * Auto-scroll to newest message when new message arrives or user sends
   * Smooth scroll to bottom of chat
   */
  useEffect(() => {
    // Small delay to ensure DOM has updated
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages]);

  // ========== FORMAT TIME ==========

  /**
   * Format timestamp to readable format
   * Shows time if today, or date if older
   */
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

  // ========== GET OTHER USERS IN CHAT ==========

  /**
   * Get list of other users (not current user)
   * For showing online status and typing indicators
   */
  const otherUsers = participants.filter((p) => p._id !== user?.id);

  // ========== RENDER: IF NOT OPEN ==========

  if (!isOpen) return null;

  // ========== RENDER: MAIN MODAL ==========

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {/* Modal Container */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* ========== HEADER ========== */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {/* Chat Name & Online Status */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
              {chatName.charAt(0).toUpperCase()}
            </div>

            {/* Name & Status */}
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 dark:text-white truncate">
                {chatName}
              </h2>
              {!isGroup && otherUsers.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  {/* Online Status Indicator for DM */}
                  {/* Check if the other user (DM recipient) is in our onlineUsers Set */}
                  {onlineUsers.has(otherUsers[0]._id) ? (
                    <>
                      <span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span>
                      <span className="text-green-500 font-medium">Online</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 bg-gray-400 rounded-full inline-block"></span>
                      <span className="text-gray-500">Offline</span>
                    </>
                  )}
                </p>
              )}
              {isGroup && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {/* Group Chat: Show member count and how many are online */}
                  {/* Count how many participants are currently online */}
                  {participants.length} members • {participants.filter((p) => onlineUsers.has(p._id)).length} online
                </p>
              )}
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            aria-label="Close chat"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* ========== MESSAGES AREA ========== */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900"
        >
          {/* Loading State */}
          {isLoadingMessages ? (
            <div className="flex justify-center items-center h-32">
              <div className="spinner w-6 h-6"></div>
            </div>
          ) : messages.length === 0 ? (
            /* Empty State */
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            // Messages List
            <>
              {messages.map((message) => {
                // Determine if message is from current user
                const isOwnMessage = String(message.sender._id) === String(user?.id);

                return (
                  <div
                    key={message._id}
                    className={`flex ${
                      isOwnMessage ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {/* Message Bubble Container */}
                    <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} gap-1`}>
                      {/* Sender name (for received messages or group chats) */}
                      {!isOwnMessage && isGroup && (
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 px-1">
                          {message.sender.username}
                        </p>
                      )}

                      {/* Message Bubble */}
                      <div
                      className={`max-w-xs px-4 py-2 rounded-lg group ${
                        isOwnMessage
                          ? 'bg-blue-500 text-white rounded-br-none'
                          : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {/* Message Content */}
                      <div>
                        {message.isDeleted ? (
                          <p className="italic text-gray-500 dark:text-gray-400">
                            [message deleted]
                          </p>
                        ) : (
                          <p className="break-words">{message.content}</p>
                        )}
                      </div>

                      {/* Message Metadata */}
                      <div
                        className={`flex items-center gap-2 mt-1 text-xs ${
                          isOwnMessage
                            ? 'text-blue-100'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <span>{formatTime(message.createdAt)}</span>

                        {/* Edit Indicator */}
                        {message.isEdited && (
                          <span className="italic">📝</span>
                        )}

                        {/* Read Receipts (only for own messages) */}
                        {isOwnMessage && message.readBy.length > 0 && (
                          <span title={`Read by: ${message.readBy.map((r) => r.user).join(', ')}`}>
                            ✓✓
                          </span>
                        )}
                      </div>

                      {/* Edit/Delete Buttons (only visible on hover) */}
                      {isOwnMessage && !message.isDeleted && (
                        <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition">
                          {/* Edit Button */}
                          <button
                            onClick={() => handleStartEdit(message)}
                            className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded transition"
                            title="Edit message"
                          >
                            ✎
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => setDeleteConfirm(message._id)}
                            className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 rounded transition"
                            title="Delete message"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Delete Confirmation */}
                      {deleteConfirm === message._id && (
                        <div className="mt-2 flex gap-1">
                          <button
                            onClick={() =>
                              handleDeleteMessage(message._id)
                            }
                            className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded transition"
                          >
                            Confirm Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs px-2 py-1 bg-gray-400 hover:bg-gray-500 rounded transition"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                );
              })}

              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </>
          )}

          {/* Error State */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* ========== TYPING INDICATOR ========== */}
        {usersTyping.length > 0 && (
          <div className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
            {usersTyping.join(', ')}{' '}
            {usersTyping.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        {/* ========== EDIT MODE INDICATOR ========== */}
        {editingMessageId && (
          <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800 flex items-center justify-between">
            <span className="text-sm text-yellow-800 dark:text-yellow-400">
              ✎ Editing message...
            </span>
            <button
              onClick={handleCancelEdit}
              className="text-sm text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 underline"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ========== INPUT AREA ========== */}
        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t border-gray-200 dark:border-gray-700"
        >
          <div className="flex gap-3">
            {/* Message Input */}
            <input
              type="text"
              value={messageInput}
              onChange={(e) => {
                setMessageInput(e.target.value);
                handleTyping();
              }}
              placeholder="Type a message... (1-1000 chars)"
              disabled={isSending}
              maxLength={1000}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={isSending || !messageInput.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              title="Send message (or press Enter)"
            >
              {isSending ? '...' : '→'}
            </button>
          </div>

          {/* Character Counter */}
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">
            {messageInput.length} / 1000
          </div>
        </form>
      </div>
    </div>
  );
}
