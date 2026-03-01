/**
 * Authentication Utility
 * ======================
 * 
 * Handles JWT (JSON Web Token) authentication for the application.
 * 
 * How JWT Authentication Works:
 * -----------------------------
 * 1. User logs in with username/password
 * 2. Server verifies credentials
 * 3. Server creates a JWT containing user info (payload)
 * 4. Server sends JWT to client in an HTTP-only cookie
 * 5. Client sends cookie with every request
 * 6. Server verifies JWT on protected routes
 * 
 * Why HTTP-only Cookies?
 * ----------------------
 * - JavaScript cannot access the token (prevents XSS attacks)
 * - Automatically sent with every request (convenient)
 * - Secure flag ensures cookie only sent over HTTPS in production
 * 
 * Security Notes:
 * ---------------
 * - Never store sensitive data in JWT payload (it's base64 encoded, not encrypted)
 * - Keep JWT_SECRET in environment variables
 * - Set reasonable expiration times
 */

import jwt, { JwtPayload } from 'jsonwebtoken';
import { cookies } from 'next/headers';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';  // Token expires in 7 days
const COOKIE_NAME = 'auth_token';  // Name of the cookie storing the JWT

/**
 * JWT Payload Interface
 * Custom data we store in the token
 */
export interface TokenPayload {
  userId: string;
  username: string;
}

/**
 * Creates a JWT token for a user
 * 
 * @param payload - User data to encode in the token
 * @returns The signed JWT string
 * 
 * Example:
 * const token = createToken({ userId: '123', username: 'john' });
 * // Returns: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 */
export function createToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verifies and decodes a JWT token
 * 
 * @param token - The JWT string to verify
 * @returns The decoded payload or null if invalid
 * 
 * This function:
 * 1. Checks if the token's signature is valid (hasn't been tampered with)
 * 2. Checks if the token hasn't expired
 * 3. Returns the decoded payload if valid
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    // jwt.verify throws an error if token is invalid or expired
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & TokenPayload;
    return {
      userId: decoded.userId,
      username: decoded.username,
    };
  } catch (error) {
    // Token is invalid or expired
    // Common errors: TokenExpiredError, JsonWebTokenError
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Sets the JWT cookie in the response
 * 
 * @param token - The JWT to store in the cookie
 * 
 * Cookie options explained:
 * - httpOnly: JavaScript cannot access (security)
 * - secure: Only send over HTTPS in production
 * - sameSite: 'lax' prevents CSRF while allowing normal navigation
 * - path: Cookie available on all routes
 * - maxAge: When cookie expires (matches JWT expiration)
 */
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,  // Cannot be accessed by JavaScript
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
    sameSite: 'lax',  // Protects against CSRF
    path: '/',  // Available on all routes
    maxAge: 60 * 60 * 24 * 7,  // 7 days in seconds
  });
}

/**
 * Removes the auth cookie (logout)
 * 
 * Setting maxAge to 0 tells the browser to delete the cookie immediately
 */
export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,  // Expires immediately = delete
  });
}

/**
 * Gets the current user from the auth cookie
 * 
 * @returns The user payload if logged in, null otherwise
 * 
 * Use this in API routes to:
 * 1. Check if user is authenticated
 * 2. Get current user's ID and username
 * 
 * Example:
 * const user = await getCurrentUser();
 * if (!user) {
 *   return Response.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 * // user.userId, user.username available here
 */
export async function getCurrentUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

/**
 * Gets just the auth token from cookies
 * Useful when you need the raw token (e.g., for socket authentication)
 */
export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

// Export cookie name for use in middleware
export { COOKIE_NAME };
