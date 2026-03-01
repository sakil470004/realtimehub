/**
 * Login API Route
 * ===============
 * POST /api/auth/login
 * 
 * Authenticates a user and creates a session.
 * 
 * Request Body:
 * {
 *   "email": "sakil@email.com",
 *   "password": "123456"
 * }
 * 
 * Response (200 OK):
 * {
 *   "message": "Login successful",
 *   "user": {
 *     "id": "...",
 *     "username": "sakil",
 *     "email": "sakil@email.com"
 *   }
 * }
 * 
 * Flow:
 * 1. Validate input format
 * 2. Find user by email
 * 3. Compare password with hash
 * 4. Create JWT token
 * 5. Set HTTP-only cookie
 * 6. Return user info
 * 
 * Security Notes:
 * - Use generic error messages ("Invalid credentials")
 *   to prevent user enumeration attacks
 * - bcrypt.compare is timing-safe
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { loginSchema, formatZodErrors } from '@/lib/validators';
import { createToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Step 1: Parse and validate input
    const body = await request.json();
    const validationResult = loginSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatZodErrors(validationResult.error),
        },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Step 2: Connect to database
    await connectDB();

    // Step 3: Find user by email
    const user = await User.findOne({ email });

    // User not found - use generic message for security
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }  // 401 Unauthorized
      );
    }

    // Step 4: Compare passwords
    // bcrypt.compare handles the salt extraction from the hash
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Step 5: Create JWT token
    const token = createToken({
      userId: user._id.toString(),
      username: user.username,
    });

    // Step 6: Set auth cookie
    await setAuthCookie(token);

    // Step 7: Return success
    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
