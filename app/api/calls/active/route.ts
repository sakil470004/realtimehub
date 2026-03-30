/**
 * GET /api/calls/active
 * ====================
 * 
 * Gets all incoming calls (ringing state) for the current user.
 * Called when user opens the app - shows notifications for incoming calls.
 * 
 * Response: { calls: ICall[] } - array of incoming calls
 */

import { getCurrentUser } from '@/lib/auth';
import connectDB from '@/lib/db';
import Call from '@/models/Call';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // 1. Verify user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Connect to MongoDB
    await connectDB();

    // 3. Find all incoming calls (calls where current user is the receiver and status is 'ringing')
    // These are calls that are waiting for user to answer
    const calls = await Call.find({
      receiver: user.userId,
      status: 'ringing',
    })
      .populate('caller', '_id username')
      .sort({ startedAt: -1 }) // Most recent first
      .lean(); // Return plain objects (faster) since we're not modifying

    return NextResponse.json({ calls });
  } catch (error: any) {
    console.error('Error fetching incoming calls:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch calls' },
      { status: 500 }
    );
  }
}
