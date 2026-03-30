/**
 * POST /api/calls
 * ===============
 * 
 * Initiates a new call between two users.
 * Creates a Call document in MongoDB.
 * Frontend handles Socket.io notification to receiver.
 * 
 * Body: { receiverId: string, callType: 'audio' | 'video' }
 * Response: { call: ICall } with caller and receiver populated
 */

import { getCurrentUser } from '@/lib/auth';
import connectDB from '@/lib/db';
import Call from '@/models/Call';
import User from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
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

    const { receiverId, callType = 'audio' } = await req.json();

    // 3. Validate receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return NextResponse.json(
        { error: 'Receiver not found' },
        { status: 404 }
      );
    }

    // 4. Check if calling themselves
    if (receiverId === user.userId) {
      return NextResponse.json(
        { error: 'Cannot call yourself' },
        { status: 400 }
      );
    }

    // 5. Check for ongoing calls between these two users
    const activeCall = await Call.findOne({
      $or: [
        { caller: user.userId, receiver: receiverId, status: { $ne: 'ended' } },
        { caller: receiverId, receiver: user.userId, status: { $ne: 'ended' } },
      ],
    });

    if (activeCall) {
      return NextResponse.json(
        { error: 'You already have an ongoing call with this user' },
        { status: 400 }
      );
    }

    // 6. Create Call document with status='ringing'
    const call = new Call({
      caller: user.userId,
      receiver: receiverId,
      callType,
      status: 'ringing',
      startedAt: new Date(),
    });

    await call.save();

    // 7. Populate user data for response
    await call.populate('caller', '_id username');
    await call.populate('receiver', '_id username');

    return NextResponse.json({ call }, { status: 201 });
  } catch (error: any) {
    console.error('Error initiating call:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate call' },
      { status: 500 }
    );
  }
}
