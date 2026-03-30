/**
 * PATCH /api/calls/[callId]
 * =========================
 * 
 * Updates call status (answer, decline, end call).
 * Called when receiver answers call, declines it, or either ends it.
 * 
 * Body: { action: 'answer' | 'decline' | 'end' }
 * Response: { call: ICall } with updated status
 */

import { getCurrentUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import Call from '@/models/Call';
import { NextRequest, NextResponse } from 'next/server';
import { getIO } from '@/lib/socket';

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

    // 4. Permission check: Only caller or receiver can update the call
    // Prevents random users from modifying other people's calls
    const isCallerOrReceiver =
      call.caller.toString() === user._id.toString() ||
      call.receiver.toString() === user._id.toString();

    if (!isCallerOrReceiver) {
      return NextResponse.json(
        { error: 'You do not have permission to update this call' },
        { status: 403 }
      );
    }

    const io = getIO();
    const callerId = call.caller.toString();
    const receiverId = call.receiver.toString();

    // 5. Handle different actions
    if (action === 'answer') {
      // Receiver clicked "Answer" button
      // Set status to 'active' because WebRTC connection established
      // connectedAt marks when both users actually heard/saw each other
      if (call.status !== 'ringing') {
        return NextResponse.json(
          { error: 'Call is not in ringing state' },
          { status: 400 }
        );
      }

      call.status = 'active';
      call.connectedAt = new Date();
      await call.save();

      // Notify both users that call is now active (can start WebRTC)
      io.to(`user_${callerId}`).emit('call_answered', { callId });
      io.to(`user_${receiverId}`).emit('call_answered', { callId });
    } else if (action === 'decline') {
      // Receiver clicked "Decline" or let it timeout
      // Call ends without ever being answered
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

      // Notify caller that their call was declined
      io.to(`user_${callerId}`).emit('call_declined', { callId });
    } else if (action === 'end') {
      // Either user hangs up during active call
      // Calculate how long they were actually connected
      if (call.status !== 'active') {
        return NextResponse.json(
          { error: 'Call is not active' },
          { status: 400 }
        );
      }

      call.status = 'ended';
      call.endedAt = new Date();

      // Duration = time between connection and hangup
      // Convert milliseconds to seconds
      if (call.connectedAt) {
        call.duration = Math.floor(
          (call.endedAt.getTime() - call.connectedAt.getTime()) / 1000
        );
      }

      await call.save();

      // Notify both users that call ended
      io.to(`user_${callerId}`).emit('call_ended', { callId, duration: call.duration });
      io.to(`user_${receiverId}`).emit('call_ended', { callId, duration: call.duration });
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
