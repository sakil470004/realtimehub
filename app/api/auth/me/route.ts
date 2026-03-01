/**
 * Current User API Route
 * ======================
 * GET /api/auth/me
 * 
 * Returns the currently authenticated user's information.
 * Used by frontend to check if user is logged in and get their data.
 * 
 * Response (200 OK) - When logged in:
 * {
 *   "user": {
 *     "id": "...",
 *     "username": "sakil",
 *     "email": "sakil@email.com"
 *   }
 * }
 * 
 * Response (401 Unauthorized) - When not logged in:
 * {
 *   "error": "Not authenticated"
 * }
 * 
 * Usage in Frontend:
 * ------------------
 * // Check if user is logged in on page load
 * const response = await fetch('/api/auth/me');
 * if (response.ok) {
 *   const { user } = await response.json();
 *   setCurrentUser(user);
 * }
 */

import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    // Step 1: Get user from JWT token in cookie
    const tokenPayload = await getCurrentUser();

    // Not authenticated
    if (!tokenPayload) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Step 2: Connect to database and fetch full user data
    // We do this to ensure the user still exists and get fresh data
    await connectDB();

    const user = await User.findById(tokenPayload.userId).select('-password');
    // .select('-password') excludes the password field from results

    if (!user) {
      // User was deleted but still has valid token
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Step 3: Return user info
    return NextResponse.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });

  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
