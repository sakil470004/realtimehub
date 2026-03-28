/**
 * Post Detail API Route
 * ====================
 * 
 * PUT /api/posts/[id] - Update a post
 * DELETE /api/posts/[id] - Delete a post
 * 
 * Allows users to edit and delete their own posts.
 * Parameters:
 * - id: Post ID (from URL)
 * 
 * Request Body (PUT):
 * {
 *   "content": "Updated post content"
 * }
 * 
 * Response (200 OK):
 * {
 *   "message": "Post updated/deleted successfully",
 *   "post": { ... }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Post from '@/models/Post';
import Comment from '@/models/Comment';
import Notification from '@/models/Notification';
import { getCurrentUser } from '@/lib/auth';
import { createPostSchema, objectIdSchema, formatZodErrors } from '@/lib/validators';

// Define the params type for Next.js 15+ dynamic routes
type RouteParams = {
  params: Promise<{ id: string }>;
};

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

    // Step 2: Validate post ID format
    const { id: postId } = await params;
    const idValidation = objectIdSchema.safeParse(postId);

    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    // Step 3: Validate request body
    const body = await request.json();
    const validationResult = createPostSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatZodErrors(validationResult.error),
        },
        { status: 400 }
      );
    }

    const { content } = validationResult.data;

    // Step 4: Connect to database and find the post
    await connectDB();

    const post = await Post.findById(postId);

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Step 5: Check if user is the post author
    const postAuthorId = post.author.toString();
    if (postAuthorId !== user.userId) {
      return NextResponse.json(
        { error: 'You can only edit your own posts' },
        { status: 403 }
      );
    }

    // Step 6: Update the post content
    post.content = content;
    await post.save();

    // Step 7: Fetch the updated post with populated author
    const updatedPost = await Post.findById(postId)
      .populate('author', 'username')
      .lean();

    // Step 8: Return success
    return NextResponse.json({
      message: 'Post updated successfully',
      post: updatedPost ? {
        ...updatedPost,
        likesCount: updatedPost.likes.length,
        commentsCount: 0,  // Will be fetched separately on client if needed
      } : {
        _id: postId,
        content,
        author: post.author,
        likes: post.likes,
        likesCount: post.likes.length,
        commentsCount: 0,
        createdAt: post.createdAt,
      },
    });

  } catch (error) {
    console.error('Update post error:', error);
    return NextResponse.json(
      { error: 'Failed to update post' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/posts/[id]
 * ======================
 * Deletes a post and all associated data.
 * 
 * Only the post author can delete their post.
 * 
 * Cascade delete:
 * - All comments on the post
 * - All notifications related to the post
 * 
 * Response (200 OK):
 * {
 *   "message": "Post deleted successfully",
 *   "postId": "507f1f77bcf86cd799439011"
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

    // Step 2: Validate post ID format
    const { id: postId } = await params;
    const idValidation = objectIdSchema.safeParse(postId);

    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid post ID' },
        { status: 400 }
      );
    }

    // Step 3: Connect to database and find the post
    await connectDB();

    const post = await Post.findById(postId);

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Step 4: Check if user is the post author
    const postAuthorId = post.author.toString();
    if (postAuthorId !== user.userId) {
      return NextResponse.json(
        { error: 'You can only delete your own posts' },
        { status: 403 }
      );
    }

    // Step 5: Delete all cascading data
    // Delete all comments on this post
    await Comment.deleteMany({ post: postId });

    // Delete all notifications related to this post
    await Notification.deleteMany({ post: postId });

    // Step 6: Delete the post itself
    await Post.findByIdAndDelete(postId);

    // Step 7: Return success
    return NextResponse.json({
      message: 'Post deleted successfully',
      postId,
    });

  } catch (error) {
    console.error('Delete post error:', error);
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}
