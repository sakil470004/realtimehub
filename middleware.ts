/**
 * Next.js Middleware
 * ==================
 * 
 * Middleware runs BEFORE a request is completed. It's used to:
 * - Protect routes (redirect unauthenticated users)
 * - Redirect authenticated users away from auth pages
 * 
 * How it works:
 * -------------
 * 1. User requests a page
 * 2. Middleware runs (this file)
 * 3. We check the auth cookie
 * 4. Redirect or allow access based on auth status
 * 5. Page loads
 * 
 * Protected Routes:
 * -----------------
 * - /feed - Main feed page
 * - /create - Create post page
 * - /notifications - Notifications page
 * 
 * Auth Routes (redirect if already logged in):
 * ---------------------------------------------
 * - /login
 * - /signup
 * 
 * Note on JWT Verification:
 * -------------------------
 * Middleware runs on the Edge runtime, which doesn't support all
 * Node.js APIs. We do basic token presence check here. Full
 * verification happens in API routes on the Node.js runtime.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Cookie name (must match auth.ts)
const COOKIE_NAME = 'auth_token';

// Routes that require authentication
const protectedRoutes = ['/feed', '/create'];

// Routes only for unauthenticated users
const authRoutes = ['/login', '/signup'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get the auth token from cookies
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isAuthenticated = !!token;

  /**
   * Protected Route Check
   * ---------------------
   * If user tries to access a protected route without auth,
   * redirect them to login page.
   */
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      // Store the intended destination for redirect after login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      
      return NextResponse.redirect(loginUrl);
    }
  }

  /**
   * Auth Route Check
   * ----------------
   * If authenticated user tries to access login/signup,
   * redirect them to the feed.
   */
  if (authRoutes.includes(pathname)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/feed', request.url));
    }
  }

  /**
   * Root Redirect
   * -------------
   * Redirect root path based on auth status.
   */
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/feed', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Allow the request to continue
  return NextResponse.next();
}

/**
 * Middleware Configuration
 * ------------------------
 * The `matcher` config specifies which routes the middleware runs on.
 * We exclude:
 * - API routes (handled separately)
 * - Static files (_next/static, images, etc.)
 * - favicon
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
