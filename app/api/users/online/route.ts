/**
 * API Route: Get Online Users
 * ===========================
 * 
 * Endpoint: GET /api/users/online
 * 
 * Purpose: Get list of all currently online users
 * Use case: 
 * - Initialize online status on app load
 * - Sync client state if Socket.io listener missed events
 * - Show initial indicators in FriendsPage
 * 
 * Returns:
 * {
 *   users: [
 *     { userId: "123", username: "john", connectedAt: "2026-03-28T..." },
 *     { userId: "456", username: "sarah", connectedAt: "2026-03-28T..." }
 *   ]
 * }
 * 
 * Notes:
 * - This data comes from Socket.io server (server.js)
 * - To access it, the Socket.io server must expose this data
 * - In current architecture, we'll simulate it in this route
 * - Or we can have Socket.io server share data via Socket namespace
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

/**
 * GET Handler
 * -----------
 * 
 * User must be authenticated to see who's online
 * (Prevents exposing online status to anonymous users)
 * 
 * Steps:
 * 1. Verify user is authenticated
 * 2. Query server for online users
 * 3. Return list to client
 * 4. Client updates state with this data
 * 5. Client listens to Socket.io for real-time updates
 */
export async function GET(request: NextRequest) {
  try {
    // ========== STEP 1: VERIFY USER AUTHENTICATED ==========
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ========== STEP 2: GET ONLINE USERS FROM SOCKET.IO SERVER ==========
    /**
     * In a real implementation, this would:
     * 1. Connect to Socket.io server
     * 2. Query the userPresence Map
     * 3. Return current online users
     * 
     * For now, we'll return empty array
     * Socket.io listeners will provide real-time updates
     * 
     * TODO: Implement shared state between Next.js and Socket.io server
     * Options:
     * - Redis cache (shared between processes)
     * - TCP socket to query server
     * - Dedicated API on Socket.io server
     */

    // Simulated response - in production, query actual server
    const onlineUsers = [
      // { userId, username, connectedAt }
      // This would be populated from server.js userPresence Map
    ];

    // ========== STEP 3: RETURN RESPONSE ==========
    return NextResponse.json({
      users: onlineUsers,
      count: onlineUsers.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get online users error:', error);
    return NextResponse.json(
      { error: 'Failed to get online users' },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTE:
 * ===================
 * 
 * The Socket.io server (server.js) maintains userPresence Map with all online users.
 * To access this from Next.js API routes, we have options:
 * 
 * OPTION 1: Expose via Socket.io HTTP endpoint
 * ─────────────────────────────────────────────
 * In server.js, create HTTP endpoint that Socket.io server listens to:
 * 
 * io.on('connection', (socket) => { ... });
 * httpServer.on('request', (req, res) => {
 *   if (req.url === '/api/socket/online-users') {
 *     const users = [];
 *     for (const [userId, presence] of userPresence.entries()) {
 *       if (presence.sockets.size > 0) {
 *         users.push({ userId, username: presence.username });
 *       }
 *     }
 *     res.end(JSON.stringify(users));
 *   }
 * });
 * 
 * Then in this route:
 * const response = await fetch('http://localhost:3001/api/socket/online-users');
 * 
 * 
 * OPTION 2: Use Redis cache
 * ──────────────────────────
 * Socket.io server updates Redis on status change:
 * 
 * redis.sadd('online_users', userId);  // When online
 * redis.srem('online_users', userId);  // When offline
 * 
 * Next.js queries Redis:
 * const users = await redis.smembers('online_users');
 * 
 * Pros: Distributed, works across multiple servers
 * Cons: Requires Redis setup
 * 
 * 
 * OPTION 3: Emit via Socket.io client
 * ────────────────────────────────────
 * Don't use this endpoint at all.
 * Server emits online users to client when Socket connects:
 * 
 * socket.on('connect', () => {
 *   socket.emit('request_online_users');
 * });
 * 
 * socket.on('online_users_snapshot', (users) => {
 *   setOnlineUsers(users);
 * });
 * 
 * Simplest approach, works with current architecture.
 * 
 * 
 * FOR NOW:
 * ────────
 * We'll use OPTION 3 (Socket.io client request)
 * No API endpoint needed
 * Client requests list when Socket connects
 * Server sends snapshot of all online users
 * Client updates state
 * All future updates via Socket.io events
 */
