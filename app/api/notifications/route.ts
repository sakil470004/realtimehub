/**
 * Notifications API Route
 * =======================
 * 
 * GET  /api/notifications - Get current user's notifications
 * PATCH /api/notifications - Mark notifications as read
 * 
 * Notifications are created automatically when:
 * - Someone likes your post
 * - Someone comments on your post
 * 
 * Note: Users don't get notifications for their own actions.
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Notification from '@/models/Notification';
import { getCurrentUser } from '@/lib/auth';

/**
 * GET /api/notifications
 * ======================
 * Retrieves the current user's notifications.
 * 
 * Query Parameters:
 * - unreadOnly: "true" to only get unread notifications
 * - limit: Max notifications to return (default: 20)
 * 
 * Response:
 * {
 *   "notifications": [...],
 *   "unreadCount": 5
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication required
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    await connectDB();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = { recipient: user.userId };
    if (unreadOnly) {
      query.read = false;
    }

    // Fetch notifications and unread count in parallel
    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('sender', 'username')
        .populate('post', 'content')
        .lean(),
      
      Notification.countDocuments({ 
        recipient: user.userId, 
        read: false 
      }),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * ========================
 * Marks notifications as read.
 * 
 * Request Body:
 * {
 *   "notificationIds": ["id1", "id2"]  // Specific IDs
 * }
 * or
 * {
 *   "markAllRead": true  // Mark all as read
 * }
 * 
 * Response:
 * {
 *   "message": "Notifications marked as read",
 *   "modifiedCount": 5
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    // Authentication required
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { notificationIds, markAllRead } = body;

    await connectDB();

    let result;

    if (markAllRead) {
      // Mark all notifications as read for this user
      result = await Notification.updateMany(
        { recipient: user.userId, read: false },
        { $set: { read: true } }
      );
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      // Only update notifications that belong to this user (security)
      result = await Notification.updateMany(
        { 
          _id: { $in: notificationIds }, 
          recipient: user.userId,
          read: false 
        },
        { $set: { read: true } }
      );
    } else {
      return NextResponse.json(
        { error: 'Invalid request. Provide notificationIds array or markAllRead: true' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Notifications marked as read',
      modifiedCount: result.modifiedCount,
    });

  } catch (error) {
    console.error('Update notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}
