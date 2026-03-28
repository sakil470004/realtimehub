/**
 * Friend Management API Route
 * ==========================
 * 
 * Routes for friend requests and friend management:
 * GET  /api/friends              - Get all friends of current user
 * POST   /api/friends/request    - Send a friend request
 * GET  /api/friends/requests     - Get pending friend requests for current user
 * POST   /api/friends/accept     - Accept a friend request
 * POST   /api/friends/reject     - Reject a friend request
 * POST   /api/friends/remove     - Remove/unfriend a user
 * GET  /api/friends/:userId      - Get friends of a specific user (public)
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Friendship from '@/models/Friendship';
import User from '@/models/User';
import { getCurrentUser } from '@/lib/auth';
import { objectIdSchema } from '@/lib/validators';

// Define the params type for Next.js 15+ dynamic routes
type RouteParams = {
  params: Promise<{ userId: string }>;
};

/**
 * POST /api/friends/request
 * =========================
 * Send a friend request to another user
 * 
 * Request body:
 * {
 *   "recipientId": "507f1f77bcf86cd799439011"
 * }
 * 
 * Validation:
 * - User must be authenticated
 * - Cannot friend yourself
 * - Cannot friend the same person twice
 * - Both users must exist
 * 
 * Response (201 Created):
 * {
 *   "message": "Friend request sent",
 *   "friendship": { ... }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Authentication check
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Step 2: Parse request and validate
    const body = await request.json();
    const { recipientId } = body;

    // Validate recipient ID format
    const idValidation = objectIdSchema.safeParse(recipientId);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid recipient ID format' },
        { status: 400 }
      );
    }

    // Prevent self-friending
    if (recipientId === user.userId) {
      return NextResponse.json(
        { error: 'You cannot send a friend request to yourself' },
        { status: 400 }
      );
    }

    // Step 3: Connect to database & validate recipient exists
    await connectDB();

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Step 4: Check if friendship already exists
    // Could be:
    // - requester → recipient (original request)
    // - recipient → requester (reverse request - user already requested us)
    const existingFriendship = await Friendship.findOne({
      $or: [
        { requester: user.userId, recipient: recipientId },
        { requester: recipientId, recipient: user.userId },
      ],
    });

    if (existingFriendship) {
      // Friendship exists in some form
      if (existingFriendship.status === 'accepted') {
        return NextResponse.json(
          { error: 'You are already friends with this user' },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: 'A friend request already exists with this user' },
          { status: 400 }
        );
      }
    }

    // Step 5: Create the friendship request
    const friendship = await Friendship.create({
      requester: user.userId,
      recipient: recipientId,
      status: 'pending',
    });

    // Step 6: Return success
    return NextResponse.json(
      {
        message: 'Friend request sent successfully',
        friendship,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Send friend request error:', error);
    return NextResponse.json(
      { error: 'Failed to send friend request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/friends/requests
 * =========================
 * Get all pending friend requests for the current user
 * 
 * Returns array of friend requests WHERE:
 * - Current user is the recipient
 * - Status is 'pending'
 * 
 * Response (200 OK):
 * {
 *   "requests": [
 *     {
 *       "_id": "...",
 *       "requester": { _id, username, email },
 *       "status": "pending"
 *     }
 *   ],
 *   "count": 2
 * }
 */
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

    // Step 3: Get pending friend requests sent TO current user
    const requests = await Friendship.find({
      recipient: user.userId,
      status: 'pending',
    })
      .populate('requester', 'username email') // Get requester's details
      .sort({ createdAt: -1 }); // Newest first

    // Step 4: Return the requests
    return NextResponse.json({
      requests,
      count: requests.length,
    });

  } catch (error) {
    console.error('Get friend requests error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friend requests' },
      { status: 500 }
    );
  }
}
