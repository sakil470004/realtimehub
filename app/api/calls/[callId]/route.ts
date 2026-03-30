/**
 * PATCH /api/calls/[callId]
 * =========================
 * 
 * Updates call status (answer, decline, end call).
 * Updates the Call document in MongoDB.
 * Frontend handles Socket.io notifications.
 * 
 * Body: { action: 'answer' | 'decline' | 'end' }
 * Response: { call: ICall } with updated status
 */

import { getCurrentUser } from '@/lib/auth';
import connectDB from '@/lib/db';
import Call from '@/models/Call';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { callId: string } }
) {
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

    const { callId } = params;
    const { action } = await req.json();

    // 3. Get the Call document
    const call = await Call.findById(callId);
    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    // 4. Permission check: Only caller or receiver can update call
    const isCallerOrReceiver =
      call.caller.toString() === user.userId ||
      call.receiver.toString() === user.userId;

    if (!isCallerOrReceiver) {
      return NextResponse.json(
        { error: 'You do not have permission to update this call' },
        { status: 403 }
      );
    }

    // 5. Handle different actions
    if (action === 'answer') {
      if (call.status !== 'ringing') {
        return NextResponse.json(
          { error: 'Call is not in ringing state' },
          { status: 400 }
        );
      }

      call.status = 'active';
      call.connectedAt = new Date();
      await call.save();
    } else if (action === 'decline') {
      if (call.status !== 'ringing') {
        return NextResponse.json(
          { error: 'Call is not in ringing state' },
          { status: 400 }
        );
      }

      call.status = 'declined';
      call.endedAt = new Date();
      call.duration = 0;
      await call.save();
    } else if (action === 'end') {
      if (call.status !== 'active') {
        return NextResponse.json(
          { error: 'Call is not active' },
          { status: 400 }
        );
      }

      call.status = 'ended';
      call.endedAt = new Date();

      // Calculate duration in seconds
      if (call.connectedAt) {
        call.duration = Math.floor(
          (call.endedAt.getTime() - call.connectedAt.getTime()) / 1000
        );
      }

      await call.save();
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'answer', 'decline', or 'end'" },
        { status: 400 }
      );
    }

    // 6. Return updated call with user data populated
    await call.populate('caller', '_id username');
    await call.populate('receiver', '_id username');

    return NextResponse.json({ call });
  } catch (error: any) {
    console.error('Error updating call:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update call' },
      { status: 500 }
    );
  }
}
