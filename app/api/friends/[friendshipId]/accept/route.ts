/**
 * Accept Friend Request API Route
 * ================================
 * 
 * POST /api/friends/[friendshipId]/accept
 * 
 * Accept a pending friend request
 * Changes the friendship status from 'pending' to 'accepted'
 * 
 * Parameters:
 * - friendshipId: The friendship document ID (from the request record)
 * 
 * Validation:
 * - User must be authenticated
 * - Friendship must exist
 * - User must be the recipient of the request
 * - Friendship must be in pending status
 * 
 * Response (200 OK):
 * {
 *   "message": "Friend request accepted",
 *   "friendship": { ... }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Friendship from '@/models/Friendship';
import { getCurrentUser } from '@/lib/auth';
import { objectIdSchema } from '@/lib/validators';

type RouteParams = {
  params: Promise<{ friendshipId: string }>;
};

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Step 1: Authentication check
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Step 2: Validate friendship ID format
    const { friendshipId } = await params;
    const idValidation = objectIdSchema.safeParse(friendshipId);

    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid friendship ID format' },
        { status: 400 }
      );
    }

    // Step 3: Connect to database and find the friendship
    await connectDB();

    const friendship = await Friendship.findById(friendshipId);

    if (!friendship) {
      return NextResponse.json(
        { error: 'Friend request not found' },
        { status: 404 }
      );
    }

    // Step 4: Verify user is the recipient of this request
    // Only the person who RECEIVED the request can accept it
    if (friendship.recipient.toString() !== user.userId) {
      return NextResponse.json(
        { error: 'You can only accept friend requests sent to you' },
        { status: 403 }
      );
    }

    // Step 5: Verify friendship is still pending
    if (friendship.status !== 'pending') {
      return NextResponse.json(
        { error: `This friendship is already ${friendship.status}` },
        { status: 400 }
      );
    }

    // Step 6: Update status to accepted
    friendship.status = 'accepted';
    await friendship.save();

    // Step 7: Return success
    // Populate both users for rich response data
    await friendship.populate('requester', 'username');
    await friendship.populate('recipient', 'username');

    return NextResponse.json({
      message: 'Friend request accepted',
      friendship,
    });

  } catch (error) {
    console.error('Accept friend request error:', error);
    return NextResponse.json(
      { error: 'Failed to accept friend request' },
      { status: 500 }
    );
  }
}
