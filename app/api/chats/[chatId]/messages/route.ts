/**
 * Message Management API Route
 * ============================
 * 
 * Routes for managing messages in chats:
 * GET  /api/chats/[chatId]/messages           - Get messages in a chat (paginated)
 * POST   /api/chats/[chatId]/messages         - Send a message
 * PUT  /api/messages/[messageId]              - Edit a message
 * DELETE /api/messages/[messageId]            - Delete a message (soft delete)
 * POST   /api/messages/[messageId]/read       - Mark message as read
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Chat from '@/models/Chat';
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
  params: Promise<{ chatId?: string; messageId?: string }>;
};

/**
 * POST /api/chats/[chatId]/messages
 * ==================================
 * Send a message in a chat
 * 
 * Request body:
 * {
 *   "content": "Hello! How are you?"
 * }
 * 
 * Validation:
 * - User must be authenticated
 * - Chat must exist
 * - User must be a participant in the chat
 * - Content: 1-1000 characters
 * 
 * Response (201 Created):
 * {
 *   "message": "Message sent",
 *   "message": {
 *     "_id": "...",
 *     "chat": "...",
 *     "sender": {...},
 *     "content": "Hello! How are you?",
 *     "isEdited": false,
 *     "isDeleted": false,
 *     "readBy": [{...}],
 *     "createdAt": "2024-03-28..."
 *   }
 * }
 * 
 * Note: This will be emitted to other users via Socket.io
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

    // Step 2: Parse route params
    const { chatId } = await params;

    // Validate chat ID format
    const chatIdValidation = objectIdSchema.safeParse(chatId);
    if (!chatIdValidation.success) {
      return NextResponse.json(
        { error: 'Invalid chat ID format' },
        { status: 400 }
      );
    }

    // Step 3: Parse and validate message content
    const body = await request.json();
    const contentValidation = messageContentSchema.safeParse(body);

    if (!contentValidation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: contentValidation.error.errors },
        { status: 400 }
      );
    }

    const { content } = contentValidation.data;

    // Step 4: Connect to database and find the chat
    await connectDB();

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Step 5: Verify user is a participant in this chat
    const isParticipant = chat.participants.some(
      (p: any) => p.toString() === user.userId
    );

    if (!isParticipant) {
      return NextResponse.json(
        { error: 'You are not a participant in this chat' },
        { status: 403 }
      );
    }

    // Step 6: Create the message
    const message = await Message.create({
      chat: chatId,
      sender: user.userId,
      content,
      readBy: [
        {
          user: user.userId,
          readAt: new Date(),
        },
      ], // Sender has read their own message
    });

    // Step 7: Update chat's lastMessage reference
    chat.lastMessage = message._id;
    chat.lastMessageAt = new Date();
    await chat.save();

    // Step 8: Populate sender info for response
    await message.populate('sender', '_id username');

    // Step 9: Return success
    // Note: Socket event will be emitted from frontend or via server handler
    return NextResponse.json(
      {
        message: 'Message sent',
        message: message,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chats/[chatId]/messages
 * =================================
 * Get messages in a chat (paginated)
 * 
 * Query params:
 * - page=1    (which page of messages)
 * - limit=50  (messages per page, max: 100)
 * 
 * Logic:
 * - Load messages newest first
 * - So when user scrolls "up", they load older messages
 * - Page 1 = most recent messages
 * - Page 2 = older messages
 * 
 * Response (200 OK):
 * {
 *   "messages": [...],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 50,
 *     "total": 250,
 *     "hasMore": true
 *   }
 * }
 */
export async function GET(
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

    // Step 2: Parse route params and query params
    const { chatId } = await params;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50', 10),
      100
    );

    // Validate pagination
    if (page < 1) {
      return NextResponse.json(
        { error: 'Page must be 1 or greater' },
        { status: 400 }
      );
    }

    // Validate chat ID format
    const chatIdValidation = objectIdSchema.safeParse(chatId);
    if (!chatIdValidation.success) {
      return NextResponse.json(
        { error: 'Invalid chat ID format' },
        { status: 400 }
      );
    }

    // Step 3: Connect to database and verify chat exists
    await connectDB();

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Step 4: Verify user is a participant
    const isParticipant = chat.participants.some(
      (p: any) => p.toString() === user.userId
    );

    if (!isParticipant) {
      return NextResponse.json(
        { error: 'You are not a participant in this chat' },
        { status: 403 }
      );
    }

    // Step 5: Get messages (newest first for pagination)
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ chat: chatId })
        .populate('sender', '_id username')
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(limit),

      Message.countDocuments({ chat: chatId }),
    ]);

    // Step 6: Reverse the array so they display oldest→newest in UI
    // (This is optional depending on UI design)
    messages.reverse();

    // Step 7: Return messages with pagination
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    });

  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
