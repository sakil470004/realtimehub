/**
 * Friends Management Page
 * =======================
 * 
 * Path: /friends
 * 
 * Features:
 * - View pending friend requests with Accept/Reject buttons
 * - View all accepted friends with Unfriend option
 * - Search friends by username
 * - Real-time updates via Socket.io
 * - Loading and error states
 * 
 * Layout:
 * ┌─────────────────────────────────────┐
 * │  Pending Requests (x)               │
 * │  ├─ User 1  [Accept] [Reject]       │
 * │  └─ User 2  [Accept] [Reject]       │
 * │                                     │
 * │  Friends (x)        [Search box]    │
 * │  ├─ Friend 1        [Unfriend]      │
 * │  └─ Friend 2        [Unfriend]      │
 * └─────────────────────────────────────┘
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { socketManager } from '@/lib/socket';
import ChatModal from '@/components/ChatModal';

// TypeScript interfaces for type safety
interface FriendRequest {
  _id: string;
  requester: {
    _id: string;
    username: string;
    email: string;
  };
  status: 'pending';
  createdAt: string;
}

interface Friend {
  _id: string;
  username: string;
  email: string;
  friendship: {
    _id: string;
    acceptedAt: string;
  };
}

export default function FriendsPage() {
  const { user, isLoading: authLoading } = useAuth();

  // ========== STATE MANAGEMENT ==========
  // Pending requests from other users
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  
  // All accepted friends
  const [friends, setFriends] = useState<Friend[]>([]);
  
  // Search query for filtering friends
  const [searchQuery, setSearchQuery] = useState('');
  
  // Loading states
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  
  // Error handling
  const [requestError, setRequestError] = useState('');
  const [friendError, setFriendError] = useState('');
  
  // Actions in progress (to show loading spinners)
  const [actionInProgress, setActionInProgress] = useState<{
    [key: string]: boolean;
  }>({});

  // Chat modal state
  const [selectedFriendChat, setSelectedFriendChat] = useState<Friend | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Online status tracking
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // ========== LISTEN FOR USER PRESENCE UPDATES ==========

  /**
   * Listen for real-time online status changes
   * When user logs in/out, all clients get notified
   */
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket) return;

    // Listen for status changes (user came online or went offline)
    const handleUserStatusChanged = (data: {
      userId: string;
      username: string;
      isOnline: boolean;
    }) => {
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        
        // Step 1: If user came online, add to Set
        if (data.isOnline) {
          updated.add(data.userId);
        }
        // Step 2: If user went offline, remove from Set
        else {
          updated.delete(data.userId);
        }
        
        return updated;
      });
    };

    // Register listener
    socket.on('user_status_changed', handleUserStatusChanged);

    // Cleanup listener when component unmounts
    return () => {
      socket.off('user_status_changed', handleUserStatusChanged);
    };
  }, []);

  // ========== LOAD PENDING REQUESTS ==========

  /**
   * Create or open a DM chat with a friend
   * Finds existing DM or creates a new one
   */
  const handleOpenChat = async (friend: Friend) => {
    try {
      // API call: POST /api/chats
      // Creates a DM if it doesn't exist, or returns existing one
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: friend._id,
          isGroup: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Set chat modal state with correct chatId
        setSelectedFriendChat({
          ...friend,
          _id: data.chat._id, // Use actual chat ID
        });
        setIsModalOpen(true);
      } else {
        alert('Failed to open chat');
      }
    } catch (error) {
      console.error('Open chat error:', error);
      alert('An error occurred');
    }
  };

  // ========== LOAD PENDING REQUESTS ==========
  /**
   * Fetch all pending friend requests sent to the current user
   * Called on page mount and when user accepts/rejects requests
   */
  const loadPendingRequests = async () => {
    try {
      setIsLoadingRequests(true);
      setRequestError('');

      // API call: GET /api/friends
      // Returns: { requests: [...], count: number }
      const response = await fetch('/api/friends');

      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data.requests);
      } else {
        setRequestError('Failed to load friend requests');
      }
    } catch (error) {
      console.error('Load requests error:', error);
      setRequestError('Failed to load friend requests');
    } finally {
      setIsLoadingRequests(false);
    }
  };

  // ========== LOAD FRIENDS ==========
  /**
   * Fetch all accepted friends
   * Called on page mount and when user adds/removes friends
   */
  const loadFriends = async () => {
    try {
      setIsLoadingFriends(true);
      setFriendError('');

      // API call: GET /api/friends/list
      // Returns: { friends: [...], count: number }
      const response = await fetch('/api/friends/list');

      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends);
      } else {
        setFriendError('Failed to load friends');
      }
    } catch (error) {
      console.error('Load friends error:', error);
      setFriendError('Failed to load friends');
    } finally {
      setIsLoadingFriends(false);
    }
  };

  // ========== ACCEPT FRIEND REQUEST ==========
  /**
   * Accept a friend request
   * Changes friendship status from 'pending' to 'accepted'
   */
  const handleAcceptRequest = async (friendshipId: string) => {
    // Set this action as in-progress
    setActionInProgress((prev) => ({ ...prev, [friendshipId]: true }));

    try {
      // API call: POST /api/friends/[friendshipId]/accept
      const response = await fetch(
        `/api/friends/${friendshipId}/accept`,
        { method: 'POST' }
      );

      if (response.ok) {
        // Remove from pending requests
        setPendingRequests((prev) =>
          prev.filter((r) => r._id !== friendshipId)
        );

        // Refresh friends list to show newly accepted friend
        await loadFriends();

        // Emit socket event for real-time updates
        const socket = socketManager.getSocket();
        socket?.emit('friend_request_accepted', { friendshipId });
      } else {
        alert('Failed to accept friend request');
      }
    } catch (error) {
      console.error('Accept request error:', error);
      alert('An error occurred');
    } finally {
      // Action complete, remove from in-progress
      setActionInProgress((prev) => {
        const updated = { ...prev };
        delete updated[friendshipId];
        return updated;
      });
    }
  };

  // ========== REJECT FRIEND REQUEST ==========
  /**
   * Reject a friend request
   * Deletes the friendship document entirely
   */
  const handleRejectRequest = async (friendshipId: string) => {
    // Confirm with user before rejecting
    if (!confirm('Reject this friend request?')) {
      return;
    }

    setActionInProgress((prev) => ({ ...prev, [friendshipId]: true }));

    try {
      // API call: POST /api/friends/[friendshipId]/reject
      const response = await fetch(
        `/api/friends/${friendshipId}/reject`,
        { method: 'POST' }
      );

      if (response.ok) {
        // Remove from pending requests
        setPendingRequests((prev) =>
          prev.filter((r) => r._id !== friendshipId)
        );

        // Emit socket event
        const socket = socketManager.getSocket();
        socket?.emit('friend_request_rejected', { friendshipId });
      } else {
        alert('Failed to reject friend request');
      }
    } catch (error) {
      console.error('Reject request error:', error);
      alert('An error occurred');
    } finally {
      setActionInProgress((prev) => {
        const updated = { ...prev };
        delete updated[friendshipId];
        return updated;
      });
    }
  };

  // ========== REMOVE/UNFRIEND ==========
  /**
   * Remove a friend
   * Changes friendship status from 'accepted' to deleted
   */
  const handleRemoveFriend = async (friendshipId: string) => {
    // Confirm with user before unfriending
    if (!confirm('Are you sure you want to unfriend this user?')) {
      return;
    }

    setActionInProgress((prev) => ({ ...prev, [friendshipId]: true }));

    try {
      // API call: POST /api/friends/[friendshipId]/remove
      const response = await fetch(
        `/api/friends/${friendshipId}/remove`,
        { method: 'POST' }
      );

      if (response.ok) {
        // Remove from friends list
        setFriends((prev) =>
          prev.filter((f) => f.friendship._id !== friendshipId)
        );

        // Emit socket event
        const socket = socketManager.getSocket();
        socket?.emit('friend_removed', { friendshipId });
      } else {
        alert('Failed to remove friend');
      }
    } catch (error) {
      console.error('Remove friend error:', error);
      alert('An error occurred');
    } finally {
      setActionInProgress((prev) => {
        const updated = { ...prev };
        delete updated[friendshipId];
        return updated;
      });
    }
  };

  // ========== INITIAL LOAD EFFECT ==========
  /**
   * Load data when component mounts
   * Only run after auth check is complete
   */
  useEffect(() => {
    if (!authLoading) {
      loadPendingRequests();
      loadFriends();
    }
  }, [authLoading]);

  // ========== SOCKET.IO LISTENERS ==========
  /**
   * Listen for real-time friend request updates
   * When someone sends you a friend request via Socket.io
   */
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket) return;

    // Listen for new friend requests
    const handleNewRequest = (data: { friendship: FriendRequest }) => {
      // Add new request to list
      setPendingRequests((prev) => [data.friendship, ...prev]);
    };

    socket.on('new_friend_request', handleNewRequest);

    return () => {
      socket.off('new_friend_request', handleNewRequest);
    };
  }, []);

  // ========== FILTER FRIENDS BY SEARCH ==========
  /**
   * Filter friends list based on search query
   * Case-insensitive username search
   */
  const filteredFriends = friends.filter((friend) =>
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* PAGE HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Friends
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your friend requests and friends list
        </p>
      </div>

      {/* ========== PENDING REQUESTS SECTION ========== */}
      <div className="mb-8">
        {/* Section Header */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Pending Requests
            {pendingRequests.length > 0 && (
              <span className="ml-2 inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium">
                {pendingRequests.length}
              </span>
            )}
          </h2>
        </div>

        {/* Error State */}
        {requestError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
            <p className="text-red-600 dark:text-red-400">{requestError}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoadingRequests ? (
          <div className="text-center py-8">
            <div className="spinner w-6 h-6 mx-auto"></div>
          </div>
        ) : pendingRequests.length === 0 ? (
          /* Empty State */
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400">
              No pending friend requests
            </p>
          </div>
        ) : (
          /* Friend Requests List */
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div
                key={request._id}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                {/* Requester Info */}
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                    {request.requester.username.charAt(0).toUpperCase()}
                  </div>

                  {/* User Details */}
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {request.requester.username}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      @{request.requester.email}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {/* Accept Button */}
                  <button
                    onClick={() => handleAcceptRequest(request._id)}
                    disabled={actionInProgress[request._id]}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {actionInProgress[request._id] ? 'Accepting...' : 'Accept'}
                  </button>

                  {/* Reject Button */}
                  <button
                    onClick={() => handleRejectRequest(request._id)}
                    disabled={actionInProgress[request._id]}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {actionInProgress[request._id] ? 'Rejecting...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DIVIDER */}
      <div className="border-t border-gray-200 dark:border-gray-700 my-8"></div>

      {/* ========== FRIENDS LIST SECTION ========== */}
      <div>
        {/* Section Header with Search */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Friends
            {friends.length > 0 && (
              <span className="ml-2 inline-block px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full text-sm font-medium">
                {filteredFriends.length} / {friends.length}
              </span>
            )}
          </h2>
        </div>

        {/* Search Box */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search friends by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Error State */}
        {friendError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
            <p className="text-red-600 dark:text-red-400">{friendError}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoadingFriends ? (
          <div className="text-center py-8">
            <div className="spinner w-6 h-6 mx-auto"></div>
          </div>
        ) : friends.length === 0 ? (
          /* Empty State */
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You don't have any friends yet
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Search for users and send them friend requests to get started!
            </p>
          </div>
        ) : filteredFriends.length === 0 ? (
          /* No Search Results */
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400">
              No friends found matching "{searchQuery}"
            </p>
          </div>
        ) : (
          /* Friends Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredFriends.map((friend) => (
              <div
                key={friend._id}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition"
              >
                {/* Friend Info */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar Container with Online Status Indicator */}
                  <div className="relative flex-shrink-0">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white font-bold">
                      {friend.username.charAt(0).toUpperCase()}
                    </div>

                    {/* Online Status Dot */}
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                        onlineUsers.has(friend._id)
                          ? 'bg-green-500'
                          : 'bg-gray-400'
                      }`}
                      title={
                        onlineUsers.has(friend._id)
                          ? 'Online'
                          : 'Offline'
                      }
                    />
                  </div>

                  {/* User Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {friend.username}
                      </p>
                      {/* Online Status Badge */}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                          onlineUsers.has(friend._id)
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {onlineUsers.has(friend._id) ? '🟢 Online' : '⚫ Offline'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      @{friend.email.split('@')[0]}
                    </p>
                  </div>
                </div>

                {/* Action Menu */}
                <div className="flex gap-2">
                  {/* Chat Button */}
                  <button
                    onClick={() => {
                      // Open chat modal with this friend
                      handleOpenChat(friend);
                    }}
                    className="px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition font-medium"
                  >
                    💬
                  </button>

                  {/* Unfriend Button */}
                  <button
                    onClick={() => handleRemoveFriend(friend.friendship._id)}
                    disabled={actionInProgress[friend.friendship._id]}
                    title="Unfriend"
                    className="px-3 py-2 text-sm bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {actionInProgress[friend.friendship._id] ? '...' : '✕'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========== CHAT MODAL ========== */}
      {selectedFriendChat && (
        <ChatModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          chatId={selectedFriendChat._id}
          chatName={selectedFriendChat.username}
          isGroup={false}
          participants={[
            { _id: selectedFriendChat._id, username: selectedFriendChat.username },
            { _id: user?._id || '', username: user?.username || '' },
          ]}
        />
      )}
    </div>
  );
}
