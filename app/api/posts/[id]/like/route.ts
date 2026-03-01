/**
 * Like Post API Route
 * ===================
 * POST /api/posts/[id]/like
 * 
 * Toggles like on a post. If user already liked, removes the like.
 * Creates a notification for the post owner (if not self-like).
 * 
 * Parameters:
 * - id: Post ID (from URL)
 * 
 * Response (200 OK):
 * {
 *   "message": "Post liked" | "Post unliked",
 *   "liked": true | false,
 *   "likesCount": 42
 * }
 * 
 * Real-time:
 * - Emits 'post_liked' event to post owner via Socket.io
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Post from '@/models/Post';
import Notification from '@/models/Notification';
import { getCurrentUser } from '@/lib/auth';
import { objectIdSchema } from '@/lib/validators';

// Define the params type for Next.js 15+ dynamic routes
type RouteParams = {
  params: Promise<{ id: string }>;
};

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

    // Step 2: Validate post ID format
    const { id: postId } = await params;
    const idValidation = objectIdSchema.safeParse(postId);

    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    // Step 3: Connect and find the post
    await connectDB();

    const post = await Post.findById(postId);

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Step 4: Toggle like
    // Check if user already liked this post
    const userIdStr = user.userId;
    const alreadyLiked = post.likes.some(
      (likeId: { toString: () => string }) => likeId.toString() === userIdStr
    );

    let liked: boolean;
    let message: string;

    if (alreadyLiked) {
      // Unlike: Remove user from likes array
      post.likes = post.likes.filter(
        (likeId: { toString: () => string }) => likeId.toString() !== userIdStr
      );
      liked = false;
      message = 'Post unliked';
    } else {
      // Like: Add user to likes array
      post.likes.push(user.userId as unknown as typeof post.likes[0]);
      liked = true;
      message = 'Post liked';

      // Step 5: Create notification (only for likes, not unlikes)
      // Don't notify if user likes their own post
      const postAuthorId = post.author.toString();
      if (postAuthorId !== userIdStr) {
        await Notification.create({
          recipient: postAuthorId,
          sender: userIdStr,
          type: 'like',
          post: postId,
          read: false,
        });

        // Note: Socket emission is handled by the custom server
        // The server listens for DB changes or API can call it
      }
    }

    // Step 6: Save the updated post
    await post.save();

    // Step 7: Return response
    return NextResponse.json({
      message,
      liked,
      likesCount: post.likes.length,
      postId: post._id,
      // Include post author ID for socket emission (handled by frontend or server)
      postAuthorId: post.author.toString(),
    });

  } catch (error) {
    console.error('Like post error:', error);
    return NextResponse.json(
      { error: 'Failed to like post' },
      { status: 500 }
    );
  }
}
