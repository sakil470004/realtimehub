/**
 * Check Friendship Status API Route
 * =================================
 * 
 * GET /api/friends/status/[userId]
 * 
 * Check friendship status between current user and another user
 * Returns whether they are friends, have pending requests, etc.
 * 
 * Response (200 OK):
 * {
 *   "isFriend": true,
 *   "hasPendingRequest": false,
 *   "hasPendingReceived": false,
 *   "friendshipId": "507f..."
 * }
 * 
 * Status Meanings:
 * - isFriend: Users have accepted friendship (can chat)
 * - hasPendingRequest: Current user sent request, awaiting response
 * - hasPendingReceived: Other user sent request, awaiting current user's response
 * - friendshipId: Required for accepting/rejecting/unfriending
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Friendship from '@/models/Friendship';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Step 0: Await params (Next.js 15+ requirement)
    const { userId } = await params;

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

    // Step 3: Find friendship between current user and target user
    // Check all possible relationships:
    // 1. Current user is requester, target user is recipient
    // 2. Target user is requester, current user is recipient
    const friendship = await Friendship.findOne({
      $or: [
        {
          requester: user.userId,
          recipient: userId,
        },
        {
          requester: userId,
          recipient: user.userId,
        },
      ],
    });

    // Step 4: Determine friendship status
    if (!friendship) {
      // No relationship at all
      return NextResponse.json({
        isFriend: false,
        hasPendingRequest: false,
        hasPendingReceived: false,
      });
    }

    // Step 5: Check the status and direction of the relationship
    if (friendship.status === 'accepted') {
      // Already friends
      return NextResponse.json({
        isFriend: true,
        hasPendingRequest: false,
        hasPendingReceived: false,
        friendshipId: friendship._id,
      });
    }

    // Step 6: Pending friendship - check who sent the request
    if (friendship.requester.toString() === user.userId) {
      // Current user sent the request (waiting for response)
      return NextResponse.json({
        isFriend: false,
        hasPendingRequest: true, // Sent by current user
        hasPendingReceived: false,
        friendshipId: friendship._id,
      });
    } else {
      // Other user sent the request (waiting for current user to respond)
      return NextResponse.json({
        isFriend: false,
        hasPendingRequest: false,
        hasPendingReceived: true, // Received by current user
        friendshipId: friendship._id,
      });
    }
  } catch (error) {
    console.error('Check friendship status error:', error);
    return NextResponse.json(
      { error: 'Failed to check friendship status' },
      { status: 500 }
    );
  }
}
