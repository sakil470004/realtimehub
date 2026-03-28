/**
 * Remove Friend API Route
 * =======================
 * 
 * POST /api/friends/[friendshipId]/remove
 * 
 * Remove/unfriend a user
 * Deletes the accepted friendship
 * Can be called by either user in the friendship
 * 
 * Parameters:
 * - friendshipId: The friendship document ID
 * 
 * Validation:
 * - User must be authenticated
 * - Friendship must exist
 * - User must be either requester or recipient
 * - Friendship must be accepted (can't remove pending requests)
 * 
 * Response (200 OK):
 * {
 *   "message": "Friendship removed",
 *   "friendshipId": "507f1f77bcf86cd799439011"
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
        { error: 'Friendship not found' },
        { status: 404 }
      );
    }

    // Step 4: Verify user is part of this friendship
    // Both requester and recipient can remove the friendship
    const userIdStr = user.userId;
    const requesterIdStr = friendship.requester.toString();
    const recipientIdStr = friendship.recipient.toString();

    if (userIdStr !== requesterIdStr && userIdStr !== recipientIdStr) {
      return NextResponse.json(
        { error: 'You are not part of this friendship' },
        { status: 403 }
      );
    }

    // Step 5: Verify friendship is accepted
    // You can't "remove" a pending request, only reject it
    if (friendship.status !== 'accepted') {
      return NextResponse.json(
        { error: 'You can only remove accepted friendships' },
        { status: 400 }
      );
    }

    // Step 6: Delete the friendship document
    // Removing the friendship breaks the connection both ways
    await Friendship.findByIdAndDelete(friendshipId);

    // Step 7: Return success
    return NextResponse.json({
      message: 'Friendship removed',
      friendshipId,
    });

  } catch (error) {
    console.error('Remove friend error:', error);
    return NextResponse.json(
      { error: 'Failed to remove friendship' },
      { status: 500 }
    );
  }
}
