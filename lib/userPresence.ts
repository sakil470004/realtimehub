/**
 * User Presence Service
 * =====================
 * 
 * Manages real-time user online/offline status.
 * 
 * Architecture:
 * - Server maintains in-memory map of userId → socket connections
 * - When user goes online/offline, broadcast status to all users
 * - Clients maintain local state of who's online
 * - Updates via Socket.io in real-time
 * 
 * Why in-memory?
 * - Status is temporary (not needed on server restart)
 * - Real-time updates require fast access
 * - Database would cause unnecessary I/O
 * - Perfect use case for in-memory data structure
 * 
 * Tracking Methods:
 * 1. On Login: User authenticates → Socket connects → Status = online
 * 2. On Logout: User logs out → Socket disconnects → Status = offline
 * 3. On Disconnect: Network issue → Auto-reconnect → Status stays online during brief outage
 * 4. On Long Disconnect: > 30 sec → Status = offline
 * 
 * The Server Tracks:
 * - userId (who)
 * - socketId list (which connections)
 * - connectedAt timestamp
 * 
 * This file documents the server-side implementation.
 * See server.js for actual implementation.
 */

// ========== SERVER-SIDE IMPLEMENTATION (in server.js) ==========

/**
 * Step 1: Create User Presence Store
 * ==================================
 * 
 * Map to track all online users and their socket connections
 * 
 * Structure:
 * {
 *   userId: {
 *     username: string,
 *     sockets: Set<socketId>,    // Multiple tabs/browsers
 *     connectedAt: timestamp,
 *     lastSeen: timestamp
 *   }
 * }
 * 
 * Why Set for sockets?
 * - User can open multiple browser tabs
 * - Each tab = separate socket connection
 * - Set automatically prevents duplicates
 * - If all sockets disconnect, user is offline
 */

const userPresence = new Map();

/**
 * Step 2: On User Authentication
 * ===============================
 * 
 * When socket connects and user authenticates:
 * 
 * socket.on('authenticate', ({ userId, username }) => {
 *   if (!userPresence.has(userId)) {
 *     userPresence.set(userId, {
 *       username,
 *       sockets: new Set(),
 *       connectedAt: new Date(),
 *       lastSeen: new Date()
 *     });
 *   }
 *   
 *   // Add this socket to user's socket list
 *   userPresence.get(userId).sockets.add(socket.id);
 *   
 *   // Broadcast user is online
 *   io.emit('user_status_changed', {
 *     userId,
 *     username,
 *     isOnline: true,
 *     timestamp: new Date()
 *   });
 * });
 */

/**
 * Step 3: On Socket Disconnect
 * =============================
 * 
 * When socket disconnects (user closes tab or loses connection):
 * 
 * socket.on('disconnect', () => {
 *   // Find user that owns this socket
 *   for (const [userId, presence] of userPresence.entries()) {
 *     if (presence.sockets.has(socket.id)) {
 *       // Remove this socket
 *       presence.sockets.delete(socket.id);
 *       
 *       // If no more sockets, user is fully offline
 *       if (presence.sockets.size === 0) {
 *         userPresence.delete(userId);
 *         
 *         // Broadcast user is offline
 *         io.emit('user_status_changed', {
 *           userId,
 *           username: presence.username,
 *           isOnline: false,
 *           timestamp: new Date()
 *         });
 *       }
 *       break;
 *     }
 *   }
 * });
 */

/**
 * Step 4: Get Online Users Endpoint
 * =================================
 * 
 * API Route: GET /api/users/online
 * Purpose: Get list of all currently online users
 * Returns: Array of { userId, username, connectedAt }
 * 
 * Usage:
 * - Load on app startup
 * - Show initial online status
 * - Fallback if Socket.io events missed
 * 
 * Implementation in server.js or in Next.js API route:
 * 
 * // In server.js, expose endpoint or
 * // In /app/api/users/online/route.ts:
 * 
 * export async function GET() {
 *   const onlineUsers = [];
 *   for (const [userId, presence] of userPresence.entries()) {
 *     if (presence.sockets.size > 0) {
 *       onlineUsers.push({
 *         userId,
 *         username: presence.username,
 *         connectedAt: presence.connectedAt
 *       });
 *     }
 *   }
 *   return NextResponse.json({ users: onlineUsers });
 * }
 */

/**
 * Step 5: Socket.io Event Broadcasting
 * ====================================
 * 
 * Event: user_status_changed
 * Emitted by: Server (on authenticate, disconnect, etc.)
 * Sent to: All connected users (io.emit)
 * 
 * Data:
 * {
 *   userId: string,
 *   username: string,
 *   isOnline: boolean,
 *   timestamp: ISO string
 * }
 * 
 * Received by: All components listening to Socket.io
 * - FriendsPage.tsx will update friend list status
 * - ChatModal.tsx will update participant status indicators
 */

// ========== CLIENT-SIDE IMPLEMENTATION ==========

/**
 * Client State Management Pattern
 * ===============================
 * 
 * Each component maintains local state of online users.
 * 
 * State structure:
 * {
 *   [userId]: {
 *     isOnline: boolean,
 *     lastSeen: timestamp      // For "last seen X minutes ago"
 *   }
 * }
 * 
 * Or simplified map:
 * Set<userId> of currently online users
 * 
 * Initialization flow:
 * 1. Component mounts (useEffect)
 * 2. Call API: GET /api/users/online
 * 3. Build initial onlineUsers state
 * 4. Set up Socket.io listener: user_status_changed
 * 5. On status change, update state
 */

/**
 * Step 1: Initialize Online Status (useEffect in FriendsPage)
 * ==========================================================
 * 
 * useEffect(() => {
 *   const loadOnlineUsers = async () => {
 *     const response = await fetch('/api/users/online');
 *     const data = await response.json();
 *     
 *     // Create map of online users
 *     const onlineMap = {};
 *     data.users.forEach((user) => {
 *       onlineMap[user.userId] = true;
 *     });
 *     setOnlineUsers(onlineMap);
 *   };
 *   
 *   loadOnlineUsers();
 * }, []);
 */

/**
 * Step 2: Listen to Real-Time Updates (useEffect in FriendsPage)
 * ============================================================
 * 
 * useEffect(() => {
 *   const socket = socketManager.getSocket();
 *   if (!socket) return;
 *   
 *   const handleStatusChange = (data: {
 *     userId: string,
 *     username: string,
 *     isOnline: boolean
 *   }) => {
 *     setOnlineUsers((prev) => {
 *       const updated = { ...prev };
 *       updated[data.userId] = data.isOnline;
 *       return updated;
 *     });
 *   };
 *   
 *   socket.on('user_status_changed', handleStatusChange);
 *   
 *   return () => {
 *     socket.off('user_status_changed', handleStatusChange);
 *   };
 * }, []);
 */

/**
 * Step 3: Display Online Indicator (in JSX)
 * ========================================
 * 
 * For each friend in list:
 * 
 * {onlineUsers[friend._id] ? (
 *   <span className="inline-block w-3 h-3 bg-green-500 rounded-full" />  // Green dot
 * ) : (
 *   <span className="inline-block w-3 h-3 bg-gray-400 rounded-full" />   // Gray dot
 * )}
 * {friend.username}
 */

// ========== DETAILED IMPLEMENTATION GUIDE ==========

/**
 * File-by-File Implementation
 * ===========================
 * 
 * 1. server.js
 *    - Add userPresence Map at top
 *    - Update authenticate event handler
 *    - Update disconnect event handler
 *    - User online/offline info available to any endpoint
 * 
 * 2. app/api/users/online/route.ts (NEW)
 *    - Export current online users
 *    - Called on app load for initial status
 *    - Called occasionally for sync
 * 
 * 3. app/friends/page.tsx
 *    - Add onlineUsers state
 *    - Load initial users via API
 *    - Listen to user_status_changed events
 *    - Show green/gray dots
 * 
 * 4. components/ChatModal.tsx
 *    - Add onlineUsers prop or state
 *    - Show status next to participant names
 *    - "Online" vs "Offline" text
 *    - Last seen time if offline
 */

// ========== STATUS DISPLAY PATTERNS ==========

/**
 * Pattern 1: Green Dot (Most Common)
 * ==================================
 * Simple visual indicator:
 * - Green dot: User online
 * - Gray dot: User offline
 * - Next to user's name/avatar
 * 
 * Usage:
 * - FriendsPage: Next to each friend
 * - ChatModal, next to participant names
 * - Navbar next to username if applicable
 * 
 * CSS:
 * w-3 h-3 rounded-full
 * bg-green-500 (online)
 * bg-gray-400 (offline)
 */

/**
 * Pattern 2: Status Text
 * =====================
 * Show text indicator:
 * - "Online" - Currently online
 * - "Offline" - Not currently online
 * - "Last seen 5 minutes ago" - Better UX when offline
 * 
 * When to use: Chat modal showing participant details
 * 
 * For "Last seen":
 * - If online: return "Online"
 * - If offline: return "Last seen X minutes ago"
 * - Requires tracking lastSeen timestamp
 */

/**
 * Pattern 3: Status Badge
 * ======================
 * Combined indicator:
 * - Avatar with green dot badge
 * - Show in chat list, friends list
 * 
 * Implementation:
 * <div className="relative">
 *   <img className="w-10 h-10 rounded-full" src={avatar} />
 *   {isOnline && (
 *     <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
 *   )}
 * </div>
 */

// ========== EDGE CASES & HANDLING ==========

/**
 * Edge Case 1: User with Multiple Tabs
 * ====================================
 * 
 * User opens app in Tab 1 (online)
 * User opens app in Tab 2 (same user, new socket)
 * User closes Tab 1 (but still online in Tab 2!)
 * User closes Tab 2 (now offline)
 * 
 * Solution: Use Set of sockets
 * - When Tab 1 connects: sockets = {socket_1}
 * - When Tab 2 connects: sockets = {socket_1, socket_2}
 * - When Tab 1 closes: sockets = {socket_2} → Still online!
 * - When Tab 2 closes: sockets = {} → Now offline
 * 
 * This is why we delete user from map only when Set is empty.
 */

/**
 * Edge Case 2: Network Disconnection & Reconnection
 * ==================================================
 * 
 * User loses WiFi (socket disconnects)
 * ↓ Socket.io auto-reconnects within 10 seconds
 * ↓ User still appears online (no status change emitted)
 * ↓ If reconnect fails after 30 seconds, mark offline
 * 
 * Current implementation: marks offline immediately
 * Better implementation: Add reconnect grace period
 */

/**
 * Edge Case 3: Stale Status
 * ========================
 * 
 * Network issue causes disconnect without notification
 * User's status still shows "online" but they're not
 * ↓ Solution 1: Heartbeat/ping every 30 seconds
 * ↓ Solution 2: Websocket natural keep-alive (Socket.io does this)
 * ↓ Solution 3: Last activity timestamp
 * 
 * Current Socket.io automatically handles this with ping/pong
 */

/**
 * Edge Case 4: Concurrent Updates
 * ===============================
 * 
 * Status changes happening while data loading
 * User goes online before we finish loading friends list
 * ↓ Solution: Combine API data with Socket listener
 * 1. Load friends via API
 * 2. Get online status via API
 * 3. Set up Socket listener for updates
 * 4. Updates after step 2 override API data
 * 
 * Order ensures: latest data always wins
 */

// ========== PERFORMANCE CONSIDERATIONS ==========

/**
 * Broadcasting to All Users
 * ==========================
 * 
 * Using: io.emit('user_status_changed', ...)
 * Broadcasts to ALL connected users
 * 
 * Impact:
 * - For 100 users: 100 messages sent
 * - Unavoidable: Everyone needs to know if someone goes online
 * 
 * Optimization if thousands of users:
 * - Only broadcast to friends of user
 * - io.to('friends_of_user_123').emit(...)
 * - Requires maintaining friend relationship rooms
 * - Trade-off: More complex, less data sent
 */

/**
 * Memory Usage
 * ============
 * 
 * Per online user:
 * - userId string: ~40 bytes (MongoDB ObjectId)
 * - username string: ~20-50 bytes
 * - socket IDs: ~40 bytes each, typically 1-2 sockets
 * - metadata: ~200 bytes
 * ≈ 300-400 bytes per user
 * 
 * For 10,000 users:
 * 10,000 × 400 bytes = 4 MB
 * 
 * Typically not an issue, very efficient.
 */

export {};
