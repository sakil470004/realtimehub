/**
 * User Profile Page
 * ==================
 * 
 * Path: /profile/[userId]
 * 
 * Displays a user's profile information and enables:
 * - Viewing user details (username, email, join date, friend count)
 * - Sending friend requests
 * - Viewing mutual friends
 * - Viewing user's recent posts
 * 
 * Features:
 * - Check if already friends
 * - Check if friend request already sent
 * - Accept/Reject pending friend requests
 * - View user's posts
 * - Real-time updates via Socket.io
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { socketManager } from '@/lib/socket';
import Link from 'next/link';

// ========== TYPES ==========

interface UserProfile {
  _id: string;
  username: string;
  email: string;
  createdAt: string;
}

interface FriendshipStatus {
  isFriend: boolean; // Already accepted friends
  hasPendingRequest: boolean; // Request already sent by current user
  hasPendingReceived: boolean; // Request received from this user
  friendshipId?: string; // ID for accepting/rejecting
}

interface UserStats {
  friendsCount: number;
  postsCount: number;
  mutualFriendsCount: number;
}

// ========== COMPONENT ==========

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, isLoading: authLoading } = useAuth();

  // Extract userId from URL params
  const userId = params.userId as string;

  // ========== STATE ==========
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>({
    isFriend: false,
    hasPendingRequest: false,
    hasPendingReceived: false,
  });
  const [userStats, setUserStats] = useState<UserStats>({
    friendsCount: 0,
    postsCount: 0,
    mutualFriendsCount: 0,
  });

  // Loading & Error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // ========== LOAD USER PROFILE ==========
  /**
   * Fetch user profile information
   * Called on component mount or when userId changes
   */
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setIsLoading(true);
        setError('');

        // API call: GET /api/users/[userId]
        // Returns: User profile with statistics
        const response = await fetch(`/api/users/${userId}`);

        if (response.ok) {
          const data = await response.json();
          setUserProfile(data.user);
          setUserStats(data.stats);

          console.log('User profile loaded:', data.user); // Debug
        } else if (response.status === 404) {
          setError('User not found');
        } else {
          setError('Failed to load user profile');
        }
      } catch (error) {
        console.error('Load profile error:', error);
        setError('Failed to load user profile');
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      loadUserProfile();
    }
  }, [userId]);

  // ========== CHECK FRIENDSHIP STATUS ==========
  /**
   * Check if current user is already friends with profile user
   * or if there's a pending friend request
   */
  useEffect(() => {
    const checkFriendshipStatus = async () => {
      if (!currentUser || !userId) return;

      try {
        // API call: GET /api/friends/status/[userId]
        // Returns: Friendship status information
        const response = await fetch(`/api/friends/status/${userId}`);

        if (response.ok) {
          const data = await response.json();
          setFriendshipStatus(data);

          console.log('Friendship status:', data); // Debug
        }
      } catch (error) {
        console.error('Check friendship status error:', error);
      }
    };

    checkFriendshipStatus();
  }, [currentUser, userId]);

  // ========== SEND FRIEND REQUEST ==========
  /**
   * Send a friend request to this user
   * Changes friendship status to 'pending'
   */
  const handleSendFriendRequest = async () => {
    if (!currentUser) {
      alert('Please log in to send friend requests');
      return;
    }

    setActionLoading(true);

    try {
      // API call: POST /api/friends/send
      // Request: { recipientId: string }
      const response = await fetch('/api/friends/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: userId }),
      });

      if (response.ok) {
        const data = await response.json();

        // Update friendship status
        setFriendshipStatus({
          isFriend: false,
          hasPendingRequest: true,
          hasPendingReceived: false,
          friendshipId: data.friendshipId,
        });

        alert('Friend request sent!');

        // Emit socket event for real-time notification
        const socket = socketManager.getSocket();
        socket?.emit('friend_request_sent', {
          recipientId: userId,
          requesterUsername: currentUser.username,
        });
      } else if (response.status === 400) {
        const data = await response.json();
        alert(data.error || 'Cannot send friend request');
      } else {
        alert('Failed to send friend request');
      }
    } catch (error) {
      console.error('Send friend request error:', error);
      alert('An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  // ========== ACCEPT/REJECT REQUEST ==========
  /**
   * Accept a friend request from this user
   */
  const handleAcceptRequest = async () => {
    if (!friendshipStatus.friendshipId) return;

    setActionLoading(true);

    try {
      // API call: POST /api/friends/[friendshipId]/accept
      const response = await fetch(
        `/api/friends/${friendshipStatus.friendshipId}/accept`,
        { method: 'POST' }
      );

      if (response.ok) {
        setFriendshipStatus({
          isFriend: true,
          hasPendingRequest: false,
          hasPendingReceived: false,
          friendshipId: friendshipStatus.friendshipId,
        });

        alert('Friend request accepted!');
      } else {
        alert('Failed to accept friend request');
      }
    } catch (error) {
      console.error('Accept request error:', error);
      alert('An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Reject a friend request from this user
   */
  const handleRejectRequest = async () => {
    if (!friendshipStatus.friendshipId) return;

    if (!confirm('Reject this friend request?')) return;

    setActionLoading(true);

    try {
      // API call: POST /api/friends/[friendshipId]/reject
      const response = await fetch(
        `/api/friends/${friendshipStatus.friendshipId}/reject`,
        { method: 'POST' }
      );

      if (response.ok) {
        setFriendshipStatus({
          isFriend: false,
          hasPendingRequest: false,
          hasPendingReceived: false,
        });

        alert('Friend request rejected');
      } else {
        alert('Failed to reject friend request');
      }
    } catch (error) {
      console.error('Reject request error:', error);
      alert('An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  // ========== RENDER: LOADING ==========
  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  // ========== RENDER: ERROR ==========
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Link
            href="/feed"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  // ========== RENDER: NOT OWN PROFILE ==========
  const isOwnProfile = currentUser?._id === userId;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* ========== PROFILE HEADER ========== */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-8">
        {/* Cover Image Placeholder */}
        <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-500 opacity-80"></div>

        {/* Profile Info */}
        <div className="px-6 pb-6 relative">
          {/* Avatar */}
          <div className="flex items-end gap-4 -mt-12 mb-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white text-4xl font-bold border-4 border-white dark:border-gray-800">
              {userProfile?.username.charAt(0).toUpperCase()}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 ml-auto mb-2">
              {isOwnProfile ? (
                <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                  Edit Profile
                </button>
              ) : friendshipStatus.isFriend ? (
                <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
                  👥 Friends
                </button>
              ) : friendshipStatus.hasPendingRequest ? (
                <button
                  disabled
                  className="px-6 py-2 bg-yellow-600 text-white rounded-lg opacity-70 cursor-not-allowed font-medium"
                >
                  ⏱️ Request Sent
                </button>
              ) : friendshipStatus.hasPendingReceived ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleAcceptRequest}
                    disabled={actionLoading}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-medium"
                  >
                    {actionLoading ? 'Loading...' : 'Accept'}
                  </button>
                  <button
                    onClick={handleRejectRequest}
                    disabled={actionLoading}
                    className="px-6 py-2 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition disabled:opacity-50 font-medium"
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSendFriendRequest}
                  disabled={actionLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {actionLoading ? 'Loading...' : '➕ Add Friend'}
                </button>
              )}
            </div>
          </div>

          {/* User Info */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {userProfile?.username}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              @{userProfile?.email.split('@')[0]}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Joined {new Date(userProfile?.createdAt || '').toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {userStats.friendsCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Friends</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {userStats.postsCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Posts</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {userStats.mutualFriendsCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Mutual Friends</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========== BACK TO FEED ========== */}
      <div className="mb-8">
        <Link
          href="/feed"
          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
        >
          ← Back to Feed
        </Link>
      </div>
    </div>
  );
}
