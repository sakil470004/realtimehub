/**
 * Get User Profile API Route
 * ==========================
 * 
 * GET /api/users/[userId]
 * 
 * Get a user's profile information along with statistics
 * 
 * Response (200 OK):
 * {
 *   "user": {
 *     "_id": "507f...",
 *     "username": "jake_smith",
 *     "email": "jake@example.com",
 *     "createdAt": "2024-03-28..."
 *   },
 *   "stats": {
 *     "friendsCount": 15,
 *     "postsCount": 42,
 *     "mutualFriendsCount": 5
 *   }
 * }
 * 
 * Error Response (404 Not Found):
 * { "error": "User not found" }
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import Post from '@/models/Post';
import Friendship from '@/models/Friendship';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Step 1: Connect to database
    await connectDB();

    // Step 2: Find the user profile
    const user = await User.findById(params.userId).select(
      '_id username email createdAt'
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Step 3: Count user's friends
    // A user's friends are all ACCEPTED friendships where they are either requester or recipient
    const friendships = await Friendship.countDocuments({
      $or: [
        { requester: params.userId, status: 'accepted' },
        { recipient: params.userId, status: 'accepted' },
      ],
    });

    // Step 4: Count user's posts
    const postsCount = await Post.countDocuments({ author: params.userId });

    // Step 5: Count mutual friends (optional - for current logged in user)
    let mutualFriendsCount = 0;
    const currentUser = await getCurrentUser();

    if (currentUser && currentUser.userId !== params.userId) {
      // Get current user's friends
      const currentUserFriendships = await Friendship.find({
        $or: [
          { requester: currentUser.userId, status: 'accepted' },
          { recipient: currentUser.userId, status: 'accepted' },
        ],
      });

      const currentUserFriendsIds = currentUserFriendships.map((f) =>
        f.requester.toString() === currentUser.userId
          ? f.recipient.toString()
          : f.requester.toString()
      );

      // Get profile user's friends
      const profileUserFriendships = await Friendship.find({
        $or: [
          { requester: params.userId, status: 'accepted' },
          { recipient: params.userId, status: 'accepted' },
        ],
      });

      const profileUserFriendsIds = profileUserFriendships.map((f) =>
        f.requester.toString() === params.userId
          ? f.recipient.toString()
          : f.requester.toString()
      );

      // Find mutual friends (intersection of both arrays)
      mutualFriendsCount = currentUserFriendsIds.filter((id) =>
        profileUserFriendsIds.includes(id)
      ).length;
    }

    // Step 6: Return user profile and stats
    return NextResponse.json({
      user: user.toObject(),
      stats: {
        friendsCount: friendships,
        postsCount,
        mutualFriendsCount,
      },
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
