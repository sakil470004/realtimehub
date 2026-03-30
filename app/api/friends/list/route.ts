/**
 * Get Friends API Route
 * =====================
 * 
 * GET /api/friends/list
 * 
 * Get all accepted friends of the current user
 * Returns array of friend user objects
 * 
 * Logic:
 * A user is a friend if there's an ACCEPTED friendship where:
 * - User is the requester, OR
 * - User is the recipient
 * 
 * We need to query both directions and deduplicate
 * 
 * Response (200 OK):
 * {
 *   "friends": [
 *     {
 *       "_id": "507f...",
 *       "username": "jake_smith",
 *       "email": "jake@example.com",
 *       "friendship": {
 *         "id": "507f...",
 *         "acceptedAt": "2024-03-28..."
 *       }
 *     }
 *   ],
 *   "count": 15
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Friendship from '@/models/Friendship';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Step 1: Authentication check
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Step 2: Connect to database
    await connectDB();

    // Step 3: Find all friendships where current user is involved
    // This returns friendships where:
    // 1. User sent the request (requester field) AND status is accepted
    // 2. User received the request (recipient field) AND status is accepted
    const friendships = await Friendship.find({
      $or: [
        {
          requester: user.userId,
          status: 'accepted',
        },
        {
          recipient: user.userId,
          status: 'accepted',
        },
      ],
    })
      // Get friend info with only necessary fields
      .populate({
        path: 'requester',
        select: '_id username email', // Explicitly include _id
      })
      .populate({
        path: 'recipient',
        select: '_id username email', // Explicitly include _id
      });

    // Step 4: Extract friend objects from friendships
    // We need to figure out which user in the friendship is the FRIEND
    // (i.e., not the current user)
    const friends = friendships.map((friendship) => {
      // If current user is the requester, then the friend is the recipient
      // If current user is the recipient, then the friend is the requester
      const friendUser = (
        (friendship.requester as any)._id?.toString() === user.userId
          ? (friendship.recipient as any)
          : (friendship.requester as any)
      );

      // Explicitly construct the friend object to ensure all fields are included
      // This fixes search by username issue (username field must be present)
      return {
        _id: friendUser._id?.toString() || '', // Convert ObjectId to string
        username: friendUser.username || '', // Username for search/display
        email: friendUser.email || '', // Email for display
        friendship: {
          _id: friendship._id.toString(), // Friendship ID for unfriend action
          acceptedAt: friendship.updatedAt, // When the friendship was accepted
        },
      };
    });

    // Step 5: Sort by name for consistency
    friends.sort((a, b) => a.username.localeCompare(b.username));

    // Step 6: Return the friends list
    return NextResponse.json({
      friends,
      count: friends.length,
    });

  } catch (error) {
    console.error('Get friends error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friends' },
      { status: 500 }
    );
  }
}
