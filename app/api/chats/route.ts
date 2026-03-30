/**
 * Chat Management API Route
 * =========================
 * 
 * Routes for managing conversations:
 * GET  /api/chats             - Get all chats for current user
 * POST   /api/chats           - Create new DM or group chat
 * GET  /api/chats/[chatId]   - Get chat details with messages
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Chat from '@/models/Chat';
import Message from '@/models/Message';
import Friendship from '@/models/Friendship';
import User from '@/models/User';
import { getCurrentUser } from '@/lib/auth';
import { objectIdSchema } from '@/lib/validators';
import { z } from 'zod';

/**
 * POST /api/chats
 * ===============
 * Create a new direct message chat or group chat
 * 
 * Request body (DM):
 * {
 *   "participantIds": ["userId1"],  // For DM: just the other person's ID
 *   "name": null                     // null for DMs
 * }
 * 
 * Request body (Group):
 * {
 *   "participantIds": ["userId1", "userId2"],
 *   "name": "Project Team"
 * }
 * 
 * Validation:
 * - Must be friends with participants (for DM)
 * - Only one participant for DM (the other person, current user is auto-added)
 * - Group must have name and 2+ participants
 * 
 * Response (201 Created):
 * All endpoints return a chat document
 * {
 *   "_id": "...",
 *   "participants": [],
 *   "isGroup": false,
 *   "name": null
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Authentication check
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Step 2: Parse and validate request
    const body = await request.json();
    let { participantIds, name, recipientId, isGroup } = body;

    // Handle both old and new request formats
    // New format (from friends page DM creation): { recipientId, isGroup }
    // Old format (from group creation): { participantIds, name }
    if (recipientId && !participantIds) {
      participantIds = [recipientId];
      isGroup = isGroup === true; // Ensure boolean
    }

    // Basic validation
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json(
        { error: 'participantIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Step 3: Connect to database
    await connectDB();

    // Step 4: Determine if this is a DM or group chat
    // If isGroup is explicitly provided in request, use that
    // Otherwise determine based on participant count and name
    const chatIsGroup = isGroup !== undefined 
      ? isGroup 
      : (participantIds.length > 1 || name !== null);

    // Step 5: Validate based on chat type
    if (!chatIsGroup) {
      // Direct Message validation
      if (participantIds.length !== 1) {
        return NextResponse.json(
          { error: 'Direct messages must have exactly one other participant' },
          { status: 400 }
        );
      }

      const otherUserId = participantIds[0];

      // Validate user ID format
      const idValidation = objectIdSchema.safeParse(otherUserId);
      if (!idValidation.success) {
        return NextResponse.json(
          { error: 'Invalid participant ID format' },
          { status: 400 }
        );
      }

      // Check if other user exists
      const otherUser = await User.findById(otherUserId);
      if (!otherUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Check if users are friends
      // Query: Are these two users friends?
      const friendship = await Friendship.findOne({
        $or: [
          { requester: user.userId, recipient: otherUserId, status: 'accepted' },
          { requester: otherUserId, recipient: user.userId, status: 'accepted' },
        ],
      });

      if (!friendship) {
        return NextResponse.json(
          { error: 'You must be friends to start a direct message' },
          { status: 403 }
        );
      }

      // Check if DM already exists with this user
      const existingChat = await Chat.findOne({
        participants: { $all: [user.userId, otherUserId] },
        isGroup: false,
      });

      if (existingChat) {
        // DM already exists, return it
        return NextResponse.json({
          message: 'Chat already exists',
          chat: existingChat,
        });
      }

      // Create DM with both participants
      const chat = await Chat.create({
        participants: [user.userId, otherUserId],
        isGroup: false,
        name: null,
      });

      return NextResponse.json(
        {
          message: 'Direct message created',
          chat: await chat.populate('participants', 'username'),
        },
        { status: 201 }
      );
    } else {
      // Group Chat validation
      if (!name || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Group chat must have a name' },
          { status: 400 }
        );
      }

      // Ensure current user is in the participants list
      const allParticipants = Array.from(
        new Set([user.userId, ...participantIds])
      );

      // Group must have at least 3 people (including creator) or 2+ others
      if (allParticipants.length < 2) {
        return NextResponse.json(
          { error: 'Group chat must have at least 2 participants' },
          { status: 400 }
        );
      }

      // Validate all participant IDs format
      for (const id of allParticipants) {
        const idValidation = objectIdSchema.safeParse(id);
        if (!idValidation.success) {
          return NextResponse.json(
            { error: `Invalid participant ID format: ${id}` },
            { status: 400 }
          );
        }
      }

      // Create group chat
      const chat = await Chat.create({
        participants: allParticipants,
        isGroup: true,
        name: name.trim(),
        createdBy: user.userId,
      });

      // Populate participant details
      await chat.populate('participants', 'username');
      await chat.populate('createdBy', 'username');

      return NextResponse.json(
        {
          message: 'Group chat created',
          chat,
        },
        { status: 201 }
      );
    }

  } catch (error) {
    console.error('Create chat error:', error);
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chats
 * ==============
 * Get all chats for the current user
 * Sorted by most recent message
 * 
 * Optional query params:
 * - limit=50  (default: 50, max: 100)
 * - page=1    (for pagination)
 * 
 * Response (200 OK):
 * {
 *   "chats": [
 *     {
 *       "_id": "...",
 *       "participants": [{_id, username}],
 *       "name": "Project Team" or null,
 *       "isGroup": true/false,
 *       "lastMessage": {...},
 *       "lastMessageAt": "2024-03-28..."
 *     }
 *   ],
 *   "count": 12
 * }
 */
export async function GET(request: NextRequest) {
  try {
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

    // Step 3: Get all chats where user is a participant
    // Sorted by most recent message first
    // console.log(user)
    const chats = await Chat.find({
      participants: user.userId, // User is in the participants array
    })
      .populate('participants', 'username') // Get participant usernames
      .populate({
        path: 'lastMessage',
        model: 'Message',
        select: '_id sender content isEdited isDeleted createdAt',
      }) // Get the last message object
      .sort({ lastMessageAt: -1 }) // Newest conversations first
      .limit(50);

    // Step 4: Return the chats
    return NextResponse.json({
      chats,
      count: chats.length,
    });

  } catch (error) {
    console.error('Get chats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}
