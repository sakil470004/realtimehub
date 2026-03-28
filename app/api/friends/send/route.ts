/**
 * Send Friend Request API Route
 * =============================
 * 
 * POST /api/friends/send
 * 
 * Send a friend request to another user
 * Creates a new Friendship document with status 'pending'
 * 
 * Request Body:
 * {
 *   "recipientId": "507f..." // User ID to send request to
 * }
 * 
 * Response (200 OK):
 * {
 *   "message": "Friend request sent",
 *   "friendshipId": "507f..."
 * }
 * 
 * Error Responses:
 * - 400: User not found, already friends, request already sent
 * - 401: Authentication required
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Friendship from '@/models/Friendship';
import User from '@/models/User';
import { getCurrentUser } from '@/lib/auth';

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

    // Step 2: Parse request body
    const { recipientId } = await request.json();

    if (!recipientId) {
      return NextResponse.json(
        { error: 'Recipient ID is required' },
        { status: 400 }
      );
    }

    // Step 3: Cannot send request to yourself
    if (user.userId === recipientId) {
      return NextResponse.json(
        { error: 'Cannot send friend request to yourself' },
        { status: 400 }
      );
    }

    // Step 4: Connect to database
    await connectDB();

    // Step 5: Check if recipient exists
    const recipient = await User.findById(recipientId);

    if (!recipient) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Step 6: Check if friendship already exists (in either direction)
    const existingFriendship = await Friendship.findOne({
      $or: [
        {
          requester: user.userId,
          recipient: recipientId,
        },
        {
          requester: recipientId,
          recipient: user.userId,
        },
      ],
    });

    if (existingFriendship) {
      if (existingFriendship.status === 'accepted') {
        return NextResponse.json(
          { error: 'Already friends with this user' },
          { status: 400 }
        );
      } else {
        // Pending request already exists
        return NextResponse.json(
          { error: 'Friend request already sent or pending' },
          { status: 400 }
        );
      }
    }

    // Step 7: Create new friendship document
    const friendship = new Friendship({
      requester: user.userId,
      recipient: recipientId,
      status: 'pending',
    });

    await friendship.save();

    // Step 8: Return success response
    return NextResponse.json({
      message: 'Friend request sent successfully',
      friendshipId: friendship._id,
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    return NextResponse.json(
      { error: 'Failed to send friend request' },
      { status: 500 }
    );
  }
}
