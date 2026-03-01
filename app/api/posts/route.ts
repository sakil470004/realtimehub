/**
 * Posts API Route
 * ===============
 * 
 * GET  /api/posts - Get paginated list of posts
 * POST /api/posts - Create a new post
 * 
 * This file handles both reading and creating posts.
 * Next.js App Router allows multiple HTTP methods in one route file.
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Post from '@/models/Post';
import Comment from '@/models/Comment';
import { getCurrentUser } from '@/lib/auth';
import { createPostSchema, paginationSchema, formatZodErrors } from '@/lib/validators';

/**
 * GET /api/posts
 * ==============
 * Retrieves paginated posts for the feed.
 * 
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Posts per page (default: 10, max: 50)
 * - user: Filter by username (optional)
 * 
 * Example: GET /api/posts?page=1&limit=10&user=sakil
 * 
 * Response:
 * {
 *   "posts": [...],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 10,
 *     "total": 42,
 *     "totalPages": 5,
 *     "hasMore": true
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Parse query parameters from URL
    const { searchParams } = new URL(request.url);
    
    // Validate pagination params
    const paginationResult = paginationSchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    const { page, limit } = paginationResult.success 
      ? paginationResult.data 
      : { page: 1, limit: 10 };

    // Optional: filter by username
    const username = searchParams.get('user');

    // Build the query
    // If username provided, we need to find the user first
    const query: Record<string, unknown> = {};

    if (username) {
      // Import User model for lookup
      const User = (await import('@/models/User')).default;
      const user = await User.findOne({ username: username.toLowerCase() });
      
      if (user) {
        query.author = user._id;
      } else {
        // User not found, return empty results
        return NextResponse.json({
          posts: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasMore: false,
          },
        });
      }
    }

    // Calculate skip for pagination
    // Page 1 = skip 0, Page 2 = skip 10 (if limit=10), etc.
    const skip = (page - 1) * limit;

    // Execute queries in parallel for efficiency
    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort({ createdAt: -1 })  // Newest first
        .skip(skip)
        .limit(limit)
        .populate('author', 'username')  // Include author's username
        .lean(),  // Return plain objects (faster, less memory)
      
      Post.countDocuments(query),  // Total count for pagination
    ]);

    // Get comment counts for each post
    // We do this separately for efficiency (aggregation is faster)
    const postIds = posts.map((p: { _id: unknown }) => p._id);
    const commentCounts = await Comment.aggregate([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]);

    // Create a map for quick lookup
    const commentCountMap = new Map(
      commentCounts.map((c: { _id: { toString: () => string }; count: number }) => [c._id.toString(), c.count])
    );

    // Transform posts for response
    interface PostDoc {
      _id: { toString: () => string };
      content: string;
      author: unknown;
      likes: unknown[];
      createdAt: Date;
    }
    const transformedPosts = posts.map((post: PostDoc) => ({
      _id: post._id,
      content: post.content,
      author: post.author,
      likes: post.likes,
      likesCount: post.likes.length,
      commentsCount: commentCountMap.get(post._id.toString()) || 0,
      createdAt: post.createdAt,
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      posts: transformedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    });

  } catch (error) {
    console.error('Get posts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/posts
 * ===============
 * Creates a new post. Requires authentication.
 * 
 * Request Body:
 * {
 *   "content": "Hello world! 🚀"
 * }
 * 
 * Response (201 Created):
 * {
 *   "message": "Post created successfully",
 *   "post": { ... }
 * }
 * 
 * This endpoint also emits a 'new_post' socket event
 * for real-time feed updates (handled by server.js).
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

    // Step 2: Validate input
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

    // Step 3: Connect to database and create post
    await connectDB();

    const newPost = await Post.create({
      content,
      author: user.userId,
      likes: [],
    });

    // Step 4: Fetch the created post with populated author
    // This gives us the full data to return and emit via socket
    const populatedPost = await Post.findById(newPost._id)
      .populate('author', 'username')
      .lean();

    // Step 5: Return success
    // Note: Socket emission for 'new_post' is handled by the custom server
    // when it receives this response or via a separate mechanism
    return NextResponse.json(
      {
        message: 'Post created successfully',
        post: {
          ...populatedPost,
          likesCount: 0,
          commentsCount: 0,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Create post error:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
