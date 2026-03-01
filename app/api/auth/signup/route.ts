/**
 * Signup API Route
 * ================
 * POST /api/auth/signup
 * 
 * Creates a new user account.
 * 
 * Request Body:
 * {
 *   "username": "sakil",
 *   "email": "sakil@email.com",
 *   "password": "123456"
 * }
 * 
 * Response (201 Created):
 * {
 *   "message": "User created successfully",
 *   "user": {
 *     "id": "...",
 *     "username": "sakil",
 *     "email": "sakil@email.com"
 *   }
 * }
 * 
 * Flow:
 * 1. Validate input with Zod schema
 * 2. Check if username/email already exists
 * 3. Hash password with bcrypt
 * 4. Save user to database
 * 5. Create JWT token
 * 6. Set HTTP-only cookie
 * 7. Return success response
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { signupSchema, formatZodErrors } from '@/lib/validators';
import { createToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Step 1: Parse and validate input
    const body = await request.json();
    const validationResult = signupSchema.safeParse(body);

    // If validation fails, return detailed errors
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatZodErrors(validationResult.error),
        },
        { status: 400 }
      );
    }

    const { username, email, password } = validationResult.data;

    // Step 2: Connect to database
    await connectDB();

    // Step 3: Check if user already exists
    // Check both username and email in one query for efficiency
    const existingUser = await User.findOne({
      $or: [
        { username: username },
        { email: email },
      ],
    });

    if (existingUser) {
      // Determine which field is duplicate
      const field = existingUser.username === username ? 'username' : 'email';
      return NextResponse.json(
        {
          error: `This ${field} is already registered`,
          field: field,
        },
        { status: 409 }  // 409 Conflict
      );
    }

    // Step 4: Hash password
    // bcrypt.hash(password, saltRounds)
    // saltRounds of 12 provides good security vs speed tradeoff
    const hashedPassword = await bcrypt.hash(password, 12);

    // Step 5: Create user in database
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    // Step 6: Create JWT token
    const token = createToken({
      userId: newUser._id.toString(),
      username: newUser.username,
    });

    // Step 7: Set auth cookie
    await setAuthCookie(token);

    // Step 8: Return success (don't include password in response!)
    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
        },
      },
      { status: 201 }  // 201 Created
    );

  } catch (error) {
    // Log the error for debugging (in production, use proper logging)
    console.error('Signup error:', error);

    // Return generic error to client (don't expose internal details)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
