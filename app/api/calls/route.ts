/**
 * POST /api/calls
 * ===============
 * 
 * Initiates a new call between two users.
 * Creates a Call document and sends a Socket.io event to notify the receiver.
 * 
 * Body: { receiverId: string, callType: 'audio' | 'video' }
 * Response: { call: ICall } with caller and receiver populated
 */

import { getCurrentUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import Call from '@/models/Call';
import User from '@/models/User';
import { NextRequest, NextResponse } from 'next/server';
import { getIO } from '@/lib/socket';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify user is authenticated (get their ID from JWT)
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

    // 4. Check if receiver is calling themselves
    if (receiverId === user._id.toString()) {
      return NextResponse.json(
        { error: 'Cannot call yourself' },
        { status: 400 }
      );
    }

    // 5. Check for any ongoing calls between these two users
    // WebRTC limitation: Can only have one active peer connection at a time
    const activeCall = await Call.findOne({
      $or: [
        { caller: user._id, receiver: receiverId, status: { $ne: 'ended' } },
        { caller: receiverId, receiver: user._id, status: { $ne: 'ended' } },
      ],
    });

    if (activeCall) {
      return NextResponse.json(
        { error: 'You already have an ongoing call with this user' },
        { status: 400 }
      );
    }

    // 6. Create the Call document
    // This sets status='ringing' (receiver hasn't answered yet)
    const call = new Call({
      caller: user._id,
      receiver: receiverId,
      callType,
      status: 'ringing',
      startedAt: new Date(),
    });

    await call.save();

    // 7. Populate caller and receiver user data (for response)
    // Populate brings in the full User document instead of just ID
    await call.populate('caller', '_id username');
    await call.populate('receiver', '_id username');

    // 8. Send Socket.io event to receiver in real-time
    // This notifies receiver's browser immediately that someone is calling
    const io = getIO();
    io.to(`user_${receiverId}`).emit('incoming_call', {
      callId: call._id,
      caller: {
        _id: user._id,
        username: user.username,
      },
      callType,
    });

    return NextResponse.json({ call }, { status: 201 });
  } catch (error: any) {
    console.error('Error initiating call:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate call' },
      { status: 500 }
    );
  }
}
