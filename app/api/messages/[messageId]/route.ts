/**
 * Message Edit/Delete API Route
 * =============================
 * 
 * PUT    /api/messages/[messageId]      - Edit a message
 * DELETE /api/messages/[messageId]      - Delete a message (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Message from '@/models/Message';
import { getCurrentUser } from '@/lib/auth';
import { objectIdSchema } from '@/lib/validators';
import { z } from 'zod';

// Validation schema for message content
const messageContentSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message cannot exceed 1000 characters')
    .trim(),
});

type RouteParams = {
  params: Promise<{ messageId: string }>;
};

/**
 * PUT /api/messages/[messageId]
 * =============================
 * Edit a message
 * 
 * Request body:
 * {
 *   "content": "Updated message content"
 * }
 * 
 * Validation:
 * - User must be authenticated
 * - Message must exist
 * - User must be the sender of the message
 * - Message cannot be deleted
 * - Content: 1-1000 characters
 * 
 * Response (200 OK):
 * {
 *   "message": "Message updated",
 *   "message": { ...updated message }
 * }
 * 
 * Note: Marks message as edited with timestamp
 */
export async function PUT(
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

    // Step 3: Parse and validate message content
    const body = await request.json();
    const contentValidation = messageContentSchema.safeParse(body);

    if (!contentValidation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: contentValidation.error.issues },
        { status: 400 }
      );
    }

    const { content } = contentValidation.data;

    // Step 4: Connect to database and find the message
    await connectDB();

    const message = await Message.findById(messageId);

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Step 5: Verify user is the sender
    if (message.sender.toString() !== user.userId) {
      return NextResponse.json(
        { error: 'You can only edit your own messages' },
        { status: 403 }
      );
    }

    // Step 6: Verify message is not deleted
    if (message.isDeleted) {
      return NextResponse.json(
        { error: 'Cannot edit a deleted message' },
        { status: 400 }
      );
    }

    // Step 7: Update the message
    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    // Step 8: Populate sender info for response
    await message.populate('sender', '_id username');

    // Step 9: Return success
    // Socket event will notify other users of the edit
    return NextResponse.json({
      message: 'Message updated',
      data: message,
    });

  } catch (error) {
    console.error('Edit message error:', error);
    return NextResponse.json(
      { error: 'Failed to edit message' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messages/[messageId]
 * =================================
 * Delete a message (soft delete)
 * 
 * Soft delete means:
 * - Don't actually remove from database
 * - Mark as deleted with isDeleted flag
 * - Show "[message deleted]" placeholder
 * - Preserve message ID and timeline
 * 
 * Validation:
 * - User must be authenticated
 * - Message must exist
 * - User must be the sender of the message
 * - Message cannot already be deleted
 * 
 * Response (200 OK):
 * {
 *   "message": "Message deleted",
 *   "messageId": "507f..."
 * }
 */
export async function DELETE(
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

    // Step 4: Verify user is the sender
    if (message.sender.toString() !== user.userId) {
      return NextResponse.json(
        { error: 'You can only delete your own messages' },
        { status: 403 }
      );
    }

    // Step 5: Verify message is not already deleted
    if (message.isDeleted) {
      return NextResponse.json(
        { error: 'Message is already deleted' },
        { status: 400 }
      );
    }

    // Step 6: Soft delete the message
    message.isDeleted = true;
    message.content = '[message deleted]'; // Clear the content
    await message.save();

    // Step 7: Return success
    // Socket event will notify other users of the deletion
    return NextResponse.json({
      message: 'Message deleted',
      messageId,
    });

  } catch (error) {
    console.error('Delete message error:', error);
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}
