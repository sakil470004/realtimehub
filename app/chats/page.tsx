/**
 * Chats Page (Chat List)
 * ======================
 * 
 * Path: /chats
 * 
 * Purpose: Display all conversations (DMs and group chats)
 * 
 * Features:
 * - List all chats sorted by most recent message
 * - Show unread message count badge
 * - Search chats by name or participant name
 * - Last message preview ("You: Hey there...")
 * - Open chat modal to view/send messages
 * - Create new DM (requires friendship)
 * - Create new group chat
 * - Delete/leave chat
 * - Real-time updates via Socket.io
 * 
 * Layout:
 * ┌──────────────────────────────┐
 * │ Chats (12)                   │
 * │ [Search box]                 │
 * │                              │
 * │ John Doe          [2] unread │
 * │ You: Sounds good! 2:30 PM    │
 * │                              │
 * │ Team Project      [5] unread │
 * │ Sarah: Great work! 1:15 PM   │
 * │                              │
 * │ [Create DM] [New Group]      │
 * └──────────────────────────────┘
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { socketManager } from '@/lib/socket';

// ========== TYPE DEFINITIONS ==========

/**
 * Chat structure for list display
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
  lastMessage?: string | { content: string; isDeleted: boolean }; // Can be string or Message object
  lastMessageAt?: string;
  unreadCount?: number;
}

// ========== COMPONENT ==========

export default function ChatsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // ========== STATE MANAGEMENT ==========

  // All chats for current user
  const [chats, setChats] = useState<Chat[]>([]);

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  // Error handling
  const [error, setError] = useState('');

  // Create DM modal
  const [showCreateDM, setShowCreateDM] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<string>('');
  const [friends, setFriends] = useState<
    Array<{ _id: string; username: string; email: string }>
  >([]);

  // Create group modal
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);

  // ========== LOAD CHATS ==========

  /**
   * Fetch all chats for current user
   * Sorted by lastMessageAt (most recent first)
   */
  const loadChats = async () => {
    try {
      setIsLoading(true);
      setError('');

      // API call: GET /api/chats
      // Returns: { chats: [...], count: number }
      const response = await fetch('/api/chats');

      if (response.ok) {
        const data = await response.json();
        setChats(data.chats);
      } else {
        setError('Failed to load chats');
      }
    } catch (error) {
      console.error('Load chats error:', error);
      setError('Failed to load chats');
    } finally {
      setIsLoading(false);
    }
  };

  // ========== LOAD FRIENDS (FOR DM CREATION) ==========

  /**
   * Fetch all accepted friends for creating DM
   */
  const loadFriends = async () => {
    try {
      // API call: GET /api/friends/list
      const response = await fetch('/api/friends/list');

      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends);
      }
    } catch (error) {
      console.error('Load friends error:', error);
    }
  };

  // ========== CREATE DM CHAT ==========

  /**
   * Create a direct message with a friend
   * Verifies friendship exists before creating
   */
  const handleCreateDM = async () => {
    if (!selectedFriend) {
      alert('Please select a friend');
      return;
    }

    try {
      // API call: POST /api/chats
      // Request: { recipientId: string, isGroup: false }
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: selectedFriend,
          isGroup: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Add new chat to list
        setChats((prev) => [data.chat, ...prev]);

        // Emit Socket.io event
        const socket = socketManager.getSocket();
        socket?.emit('chat_created', { chat: data.chat });

        // Navigate to the new chat
        router.push(`/chats/${data.chat._id}`);

        // Close modal
        setShowCreateDM(false);
        setSelectedFriend('');
      } else {
        alert('Failed to create chat');
      }
    } catch (error) {
      console.error('Create DM error:', error);
      alert('An error occurred');
    }
  };

  // ========== CREATE GROUP CHAT ==========

  /**
   * Create a group chat with multiple friends
   * Requires group name and at least 2 participants
   */
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    if (selectedGroupMembers.length < 1) {
      alert('Please select at least 1 member');
      return;
    }

    try {
      // API call: POST /api/chats
      // Request: { name: string, participantIds: string[], isGroup: true }
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          participantIds: selectedGroupMembers,
          isGroup: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Add new chat to list
        setChats((prev) => [data.chat, ...prev]);

        // Emit Socket.io event
        const socket = socketManager.getSocket();
        socket?.emit('chat_created', { chat: data.chat });

        // Navigate to the new chat
        router.push(`/chats/${data.chat._id}`);

        // Close modal
        setShowCreateGroup(false);
        setGroupName('');
        setSelectedGroupMembers([]);
      } else {
        alert('Failed to create group');
      }
    } catch (error) {
      console.error('Create group error:', error);
      alert('An error occurred');
    }
  };

  // ========== DELETE/LEAVE CHAT ==========

  /**
   * Remove user from chat (leave DM or group)
   */
  const handleLeaveChat = async (chatId: string) => {
    if (!confirm('Are you sure you want to leave this chat?')) {
      return;
    }

    try {
      // TODO: Implement DELETE /api/chats/[chatId] endpoint
      // For now, just remove from UI
      setChats((prev) => prev.filter((c) => c._id !== chatId));

      alert('Left chat');
    } catch (error) {
      console.error('Leave chat error:', error);
      alert('An error occurred');
    }
  };

  // ========== INITIAL LOAD EFFECT ==========

  /**
   * Load data when page mounts
   */
  useEffect(() => {
    if (!authLoading) {
      loadChats();
      loadFriends();
    }
  }, [authLoading]);

  // ========== SOCKET.IO LISTENERS ==========

  /**
   * Listen for real-time chat updates
   */
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket) return;

    // Listen for new messages in any chat
    const handleNewMessage = (data: {
      chatId: string;
      message: { content: string; createdAt: string };
    }) => {
      // Update chat's last message
      setChats((prev) =>
        prev.map((chat) =>
          chat._id === data.chatId
            ? {
                ...chat,
                lastMessage: data.message.content,
                lastMessageAt: data.message.createdAt,
              }
            : chat
        )
      );

      // Move chat to top
      setChats((prev) => {
        const chat = prev.find((c) => c._id === data.chatId);
        if (!chat) return prev;
        return [chat, ...prev.filter((c) => c._id !== data.chatId)];
      });
    };
    socket.on('message_received', handleNewMessage);

    // Listen for new chats
    const handleNewChat = (data: { chat: Chat }) => {
      setChats((prev) => [data.chat, ...prev]);
    };
    socket.on('chat_created', handleNewChat);

    return () => {
      socket.off('message_received', handleNewMessage);
      socket.off('chat_created', handleNewChat);
    };
  }, []);

  // ========== FILTER CHATS ==========

  /**
   * Filter chats by search query
   * Searches chat name and participant names
   */
  const filteredChats = chats.filter((chat) => {
    const searchLower = searchQuery.toLowerCase();

    // Check chat name (for groups)
    if (chat.name?.toLowerCase().includes(searchLower)) return true;

    // Check participant names
    return chat.participants.some((p) =>
      p.username.toLowerCase().includes(searchLower)
    );
  });

  // ========== GET CHAT DISPLAY NAME ==========

  /**
   * Get the display name for a chat
   * For DMs: other person's username
   * For groups: group name
   */
  const getChatName = (chat: Chat) => {
    if (chat.isGroup) {
      return chat.name || 'Group Chat';
    }

    // For DM, find the other participant
    const otherUser = chat.participants.find((p) => p._id !== user?.id);
    return otherUser?.username || 'Chat';
  };

  // ========== GET LAST MESSAGE PREVIEW ==========

  /**
   * Get preview of last message
   * Truncate if too long
   * 
   * Note: lastMessage can be either:
   * - A string (from Socket.io events)
   * - A Message object from API (with content, isDeleted, etc.)
   */
  const getMessagePreview = (chat: Chat) => {
    if (!chat.lastMessage) return 'No messages yet';

    // Handle if lastMessage is a Message object (from API populate)
    if (typeof chat.lastMessage === 'object' && 'content' in chat.lastMessage) {
      const messageObj = chat.lastMessage as any;
      
      // Show deleted message indicator
      if (messageObj.isDeleted) return '[message deleted]';
      
      const content = messageObj.content || '';
      const preview =
        content.length > 40
          ? content.substring(0, 40) + '...'
          : content;
      return preview;
    }

    // Handle if lastMessage is a string (from Socket events)
    const messageStr = typeof chat.lastMessage === 'string' ? chat.lastMessage : '';
    const preview =
      messageStr.length > 40
        ? messageStr.substring(0, 40) + '...'
        : messageStr;

    return preview || 'No messages yet';
  };

  // ========== FORMAT TIME ==========

  /**
   * Format last message timestamp
   */
  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();

    // Today: show time only
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    // Yesterday: show "Yesterday"
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // Older: show date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // ========== RENDER: LOADING STATE ==========

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  // ========== RENDER: MAIN PAGE ==========

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* PAGE HEADER */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Chats
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {chats.length} conversations
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* Create DM Button */}
            <button
              onClick={() => {
                loadFriends();
                setShowCreateDM(true);
              }}
              title="Create new DM"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
            >
              + DM
            </button>

            {/* Create Group Button */}
            <button
              onClick={() => {
                loadFriends();
                setShowCreateGroup(true);
              }}
              title="Create group chat"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"
            >
              + Group
            </button>
          </div>
        </div>

        {/* Search Box */}
        <input
          type="text"
          placeholder="Search chats by name or person..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* LOADING STATE */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="spinner w-6 h-6 mx-auto"></div>
        </div>
      ) : filteredChats.length === 0 ? (
        /* EMPTY STATE */
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {chats.length === 0
              ? 'No chats yet. Start a conversation!'
              : `No chats found matching "${searchQuery}"`}
          </p>
          {chats.length === 0 && (
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  loadFriends();
                  setShowCreateDM(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Create DM
              </button>
              <button
                onClick={() => {
                  loadFriends();
                  setShowCreateGroup(true);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Create Group
              </button>
            </div>
          )}
        </div>
      ) : (
        /* CHATS LIST */
        <div className="space-y-2">
          {filteredChats.map((chat) => (
            <div
              key={chat._id}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition cursor-pointer group"
              onClick={() => router.push(`/chats/${chat._id}`)}
            >
              {/* Chat Info */}
              <div className="flex-1 min-w-0">
                {/* Chat Name */}
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {getChatName(chat)}
                  </h3>
                  {chat.isGroup && (
                    <span className="text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-1 rounded">
                      Group
                    </span>
                  )}
                </div>

                {/* Last Message Preview */}
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {getMessagePreview(chat)}
                </p>

                {/* Time */}
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {formatTime(chat.lastMessageAt)}
                </p>
              </div>

              {/* Unread Badge & Actions */}
              <div className="flex items-center gap-3">
                {/* Unread Count */}
                {chat.unreadCount ? (
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium flex-shrink-0">
                    {chat.unreadCount}
                  </span>
                ) : null}

                {/* Leave Button (on hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLeaveChat(chat._id);
                  }}
                  className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/20 transition"
                  title="Leave chat"
                >
                  <svg
                    className="w-5 h-5 text-red-600 dark:text-red-400"
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
            </div>
          ))}
        </div>
      )}

      {/* ========== CREATE DM MODAL ========== */}
      {showCreateDM && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Start a Conversation
            </h2>

            {/* Friend Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Friend
              </label>
              <select
                value={selectedFriend}
                onChange={(e) => setSelectedFriend(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a friend...</option>
                {friends.map((friend) => (
                  <option key={friend._id} value={friend._id}>
                    {friend.username}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCreateDM}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Create Chat
              </button>
              <button
                onClick={() => setShowCreateDM(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== CREATE GROUP MODAL ========== */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Create Group Chat
            </h2>

            {/* Group Name Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Member Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Members ({selectedGroupMembers.length} selected)
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {friends.map((friend) => (
                  <label
                    key={friend._id}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroupMembers.includes(friend._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGroupMembers((prev) => [
                            ...prev,
                            friend._id,
                          ]);
                        } else {
                          setSelectedGroupMembers((prev) =>
                            prev.filter((id) => id !== friend._id)
                          );
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    />
                    <span className="text-gray-900 dark:text-white">
                      {friend.username}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCreateGroup}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                Create Group
              </button>
              <button
                onClick={() => {
                  setShowCreateGroup(false);
                  setGroupName('');
                  setSelectedGroupMembers([]);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
