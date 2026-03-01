/**
 * Logout API Route
 * ================
 * POST /api/auth/logout
 * 
 * Logs out the current user by removing the auth cookie.
 * 
 * Response (200 OK):
 * {
 *   "message": "Logged out successfully"
 * }
 * 
 * Note: This is a simple cookie deletion - JWT tokens are stateless
 * and can't be "invalidated" on the server without additional
 * infrastructure (like a token blacklist). For most apps, cookie
 * deletion is sufficient.
 * 
 * For high-security apps, consider:
 * - Token blacklist in Redis
 * - Short token expiration + refresh tokens
 * - Database session storage
 */

import { NextResponse } from 'next/server';
import { removeAuthCookie } from '@/lib/auth';

export async function POST() {
  try {
    // Remove the auth cookie
    await removeAuthCookie();

    return NextResponse.json({
      message: 'Logged out successfully',
    });

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
