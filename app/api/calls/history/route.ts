/**
 * GET /api/calls/history
 * ======================
 * 
 * Gets all past calls (ended, declined, missed) for the current user.
 * Shows call history with durations, who called, etc.
 * Supports pagination to handle many calls efficiently.
 * 
 * Query params: ?limit=20&skip=0
 * Response: { calls: ICall[], total: number }
 */

import { getCurrentUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
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

    // 3. Get pagination parameters from URL
    // Pagination: split large result sets into pages (e.g., 20 calls per page)
    // This prevents loading 10,000 calls at once
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const skip = parseInt(url.searchParams.get('skip') || '0');

    // 4. Find all completed calls where current user was involved
    // A user is involved if they're either the caller or receiver
    const calls = await Call.find({
      $or: [{ caller: user._id }, { receiver: user._id }],
      status: { $in: ['ended', 'declined', 'missed'] }, // Only completed calls
    })
      .populate('caller', '_id username')
      .populate('receiver', '_id username')
      .sort({ endedAt: -1 }) // Most recent first
      .limit(limit)
      .skip(skip)
      .lean(); // Return plain objects (faster read-only)

    // 5. Get total count for pagination UI
    const total = await Call.countDocuments({
      $or: [{ caller: user._id }, { receiver: user._id }],
      status: { $in: ['ended', 'declined', 'missed'] },
    });

    return NextResponse.json({ calls, total });
  } catch (error: any) {
    console.error('Error fetching call history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch history' },
      { status: 500 }
    );
  }
}
