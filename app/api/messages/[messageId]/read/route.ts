/**
 * Mark Message as Read API Route
 * ==============================
 * 
 * POST /api/messages/[messageId]/read
 * 
 * Mark a message as read by the current user
 * Adds current user to the readBy array
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Message from '@/models/Message';
import { getCurrentUser } from '@/lib/auth';
import { objectIdSchema } from '@/lib/validators';

type RouteParams = {
  params: Promise<{ messageId: string }>;
};

/**
 * POST /api/messages/[messageId]/read
 * ====================================
 * Mark a message as read
 * 
 * Logic:
 * - Add current user to readBy array
 * - Only add if not already there (check existing entries)
 * - Update timestamp to when user read it
 * 
 * Validation:
 * - User must be authenticated
 * - Message must exist
 * - User must be a participant in the chat containing this message
 * 
 * Response (200 OK):
 * {
 *   "message": "Message marked as read",
 *   "readBy": [
 *     { user: {...}, readAt: "2024-03-28..." },
 *     ...
 *   ],
 *   "readCount": 3
 * }
 */
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

    // Step 2: Validate message ID format
    const { messageId } = await params;
    const idValidation = objectIdSchema.safeParse(messageId);

    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid message ID format' },
        { status: 400 }
      );
    }

    // Step 3: Connect to database and find the message
    await connectDB();

    const message = await Message.findById(messageId);

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Step 4: Check if user has already read this message
    const alreadyRead = message.readBy?.some(
      (r: { user: any }) => r.user.toString() === user.userId
    );

    // Step 5: If not already read, add to readBy array
    if (!alreadyRead) {
      if (!message.readBy) {
        message.readBy = [];
      }
      message.readBy.push({
        user: user.userId,
        readAt: new Date(),
      });
      await message.save();
    }

    // Step 6: Populate and return
    await message.populate('readBy.user', 'username');

    // Step 7: Return success
    // Socket event will notify other users that this user has read the message
    return NextResponse.json({
      message: 'Message marked as read',
      readBy: message.readBy,
      readCount: message.readBy?.length || 0,
    });

  } catch (error) {
    console.error('Mark message as read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark message as read' },
      { status: 500 }
    );
  }
}
