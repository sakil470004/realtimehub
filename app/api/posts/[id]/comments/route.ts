/**
 * Comments API Route
 * ==================
 * 
 * GET  /api/posts/[id]/comments - Get comments for a post
 * POST /api/posts/[id]/comments - Add a comment to a post
 * 
 * Parameters:
 * - id: Post ID (from URL)
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Post from '@/models/Post';
import Comment from '@/models/Comment';
import Notification from '@/models/Notification';
import { getCurrentUser } from '@/lib/auth';
import { createCommentSchema, objectIdSchema, formatZodErrors } from '@/lib/validators';

// Define the params type for Next.js 15+ dynamic routes
type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/posts/[id]/comments
 * ============================
 * Retrieves all comments for a specific post.
 * 
 * Response:
 * {
 *   "comments": [
 *     {
 *       "_id": "...",
 *       "text": "Great post!",
 *       "author": { "_id": "...", "username": "john" },
 *       "createdAt": "2024-01-15T10:30:00.000Z"
 *     }
 *   ]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Validate post ID
    const { id: postId } = await params;
    const idValidation = objectIdSchema.safeParse(postId);

    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if post exists
    const postExists = await Post.exists({ _id: postId });
    if (!postExists) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Fetch comments sorted by newest first
    const comments = await Comment.find({ post: postId })
      .sort({ createdAt: -1 })
      .populate('author', 'username')
      .lean();

    return NextResponse.json({ comments });

  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/posts/[id]/comments
 * =============================
 * Adds a comment to a post. Requires authentication.
 * 
 * Request Body:
 * {
 *   "text": "This is awesome!"
 * }
 * 
 * Response (201 Created):
 * {
 *   "message": "Comment added successfully",
 *   "comment": { ... }
 * }
 * 
 * Real-time:
 * - Emits 'post_commented' event to post owner via Socket.io
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

    // Step 2: Validate post ID
    const { id: postId } = await params;
    const idValidation = objectIdSchema.safeParse(postId);

    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    // Step 3: Validate comment text
    const body = await request.json();
    const validationResult = createCommentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatZodErrors(validationResult.error),
        },
        { status: 400 }
      );
    }

    const { text } = validationResult.data;

    // Step 4: Connect and verify post exists
    await connectDB();

    const post = await Post.findById(postId);
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Step 5: Create the comment
    const newComment = await Comment.create({
      post: postId,
      author: user.userId,
      text,
    });

    // Step 6: Create notification for post owner
    // Don't notify if user comments on their own post
    const postAuthorId = post.author.toString();
    if (postAuthorId !== user.userId) {
      await Notification.create({
        recipient: postAuthorId,
        sender: user.userId,
        type: 'comment',
        post: postId,
        read: false,
      });
    }

    // Step 7: Fetch the comment with populated author
    const populatedComment = await Comment.findById(newComment._id)
      .populate('author', 'username')
      .lean();

    // Step 8: Return success
    return NextResponse.json(
      {
        message: 'Comment added successfully',
        comment: populatedComment,
        postAuthorId: postAuthorId, // For socket emission
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Create comment error:', error);
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}
