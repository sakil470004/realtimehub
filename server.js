/**
 * Custom Socket.io Server
 * =======================
 * 
 * This is a standalone Socket.io server that runs alongside Next.js.
 * It handles real-time communication for the application.
 * 
 * Why a Separate Server?
 * ----------------------
 * Next.js API routes are serverless/stateless - they spin up for each
 * request and shut down after. Socket.io needs persistent connections,
 * so we need a separate long-running server.
 * 
 * Architecture:
 * -------------
 * [Browser] <--WebSocket--> [Socket.io Server :3001]
 * [Browser] <--HTTP------> [Next.js :3000]
 * 
 * Both servers share the same MongoDB database.
 * 
 * Running the App:
 * ----------------
 * Terminal 1: npm run dev          (Next.js on port 3000)
 * Terminal 2: npm run socket       (Socket.io on port 3001)
 * 
 * Or in production: npm run start:all
 */

const { createServer } = require('http');
const { Server } = require('socket.io');

// Create HTTP server (Socket.io needs an HTTP server to attach to)
const httpServer = createServer();

// Initialize Socket.io with CORS configuration
const io = new Server(httpServer, {
  cors: {
    // Allow connections from Next.js app
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,  // Allow cookies to be sent
  },
});

/**
 * User-Socket Mapping
 * -------------------
 * Maps userId to socketId for targeted message delivery.
 * When we need to send a notification to a specific user,
 * we look up their socketId in this map.
 * 
 * Example:
 * userSockets = {
 *   'user123': 'socket_abc',
 *   'user456': 'socket_def'
 * }
 */
const userSockets = new Map();

/**
 * Socket Connection Handler
 * -------------------------
 * Runs when a client connects to the Socket.io server.
 */
io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  /**
   * Authentication Event
   * --------------------
   * Client sends this after connecting to identify themselves.
   * We store the userId -> socketId mapping.
   */
  socket.on('authenticate', ({ userId }) => {
    if (userId) {
      // Store the mapping
      userSockets.set(userId, socket.id);
      console.log(`✅ User ${userId} authenticated with socket ${socket.id}`);
      
      // Join a room with their userId for easy targeting
      socket.join(userId);
    }
  });

  /**
   * New Post Event
   * --------------
   * When a user creates a post, the client emits this event.
   * We broadcast it to all connected users for live feed updates.
   */
  socket.on('new_post', (data) => {
    console.log('📝 New post received:', data.post?._id);
    
    // Broadcast to all other clients (not the sender)
    socket.broadcast.emit('new_post', data);
  });

  /**
   * Post Liked Event
   * ----------------
   * When a user likes a post, the client emits this event.
   * We send a notification to the post owner and broadcast
   * the like update to all users (for real-time like counts).
   */
  socket.on('post_liked', (data) => {
    const { postId, postAuthorId, likerId, likerUsername, liked, likesCount } = data;
    
    console.log(`❤️ Post ${postId} ${liked ? 'liked' : 'unliked'} by ${likerUsername}`);

    // Broadcast like update to all users (for UI updates)
    io.emit('like_update', {
      postId,
      likerId,
      liked,
      likesCount,
    });

    // Send notification to post owner (if not self-like)
    if (liked && postAuthorId !== likerId) {
      // Send to the specific user's room
      io.to(postAuthorId).emit('notification', {
        type: 'like',
        sender: { _id: likerId, username: likerUsername },
        postId,
        createdAt: new Date().toISOString(),
      });
    }
  });

  /**
   * Post Commented Event
   * --------------------
   * When a user comments on a post, the client emits this event.
   * We send a notification to the post owner and broadcast
   * the comment to all users viewing that post.
   */
  socket.on('post_commented', (data) => {
    const { postId, postAuthorId, comment, commenterId } = data;
    
    console.log(`💬 New comment on post ${postId} by ${comment?.author?.username}`);

    // Broadcast comment to all users (for real-time comment updates)
    io.emit('new_comment', {
      postId,
      comment,
    });

    // Send notification to post owner (if not self-comment)
    if (postAuthorId !== commenterId) {
      io.to(postAuthorId).emit('notification', {
        type: 'comment',
        sender: comment.author,
        postId,
        text: comment.text,
        createdAt: new Date().toISOString(),
      });
    }
  });

  /**
   * Disconnect Handler
   * ------------------
   * Runs when a client disconnects (closes browser, network issue, etc.)
   * We remove them from our userId -> socketId mapping.
   */
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Disconnected: ${socket.id} (${reason})`);
    
    // Find and remove the user from our mapping
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        console.log(`❌ Removed user ${userId} from socket map`);
        break;
      }
    }
  });
});

// Start the server
const PORT = process.env.SOCKET_PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Socket.io Server Running                         ║
║   📡 Port: ${PORT}                                       ║
║                                                       ║
║   Events:                                             ║
║   • authenticate  - User identification               ║
║   • new_post      - Broadcast new posts               ║
║   • post_liked    - Handle likes & notifications      ║
║   • post_commented - Handle comments & notifications  ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

/**
 * Graceful Shutdown
 * -----------------
 * Handle process termination signals to close connections cleanly.
 */
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down...');
  io.close();
  httpServer.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down...');
  io.close();
  httpServer.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});
