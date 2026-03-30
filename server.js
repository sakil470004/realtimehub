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
      // Store the mapping of userId to socket.id
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
    // console.log("all users:", userSockets);
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

  // ========== CHAT SYSTEM EVENTS ==========

  /**
   * Join Chat Room Event
   * --------------------
   * When user opens a chat, they join a room specific to that chat.
   * This allows us to broadcast messages to only users in that chat.
   * 
   * Room Structure:
   * - chat_<chatId>: All users in this chat
   * - user_<userId>: All connections of this user (multi-tab support)
   * 
   * Example:
   * socket.on('join_chat', { chatId: 'chat_123' })
   * -> socket joins room 'chat_123'
   * -> All messages in chat_123 go to this room
   */
  socket.on('join_chat', ({ chatId, userId }) => {
    if (chatId && userId) {
      // Step 1: User joins the chat room
      socket.join(`chat_${chatId}`);
      console.log(`👁️ User ${userId} joined chat ${chatId}`);

      // Step 2: Notify others in chat that user came online
      socket.broadcast.to(`chat_${chatId}`).emit('user_joined_chat', {
        userId,
        chatId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Leave Chat Room Event
   * --------------------
   * When user closes the chat modal, they leave the room.
   * Notifies others that they left.
   */
  socket.on('leave_chat', ({ chatId, userId }) => {
    if (chatId && userId) {
      // Step 1: User leaves the chat room
      socket.leave(`chat_${chatId}`);
      console.log(`👋 User ${userId} left chat ${chatId}`);

      // Step 2: Notify others in chat that user went offline
      socket.broadcast.to(`chat_${chatId}`).emit('user_left_chat', {
        userId,
        chatId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Message Sent Event
   * ------------------
   * When a user sends a message, broadcast it to all users in the chat.
   * 
   * Flow:
   * 1. User types message and clicks Send
   * 2. Client sends 'message_sent' event with message data
   * 3. Server broadcasts to all users in chat_<chatId> room
   * 4. All clients receive 'message_received' event with message
   * 5. UI updates to show new message in real-time
   * 
   * Why broadcast and not direct?
   * - Multi-device support: User might have multiple tabs/devices open
   * - Read receipts: Need to track who read it
   * - Group chats: Multiple recipients
   */
  socket.on('message_sent', ({ chatId, message }) => {
    if (chatId && message) {
      console.log(`💌 Message sent to chat ${chatId}`);
      
      // Broadcast to all users in this chat (including sender)
      // Includes full message object with metadata
      io.to(`chat_${chatId}`).emit('message_received', {
        chatId,
        message,
      });
    }
  });

  /**
   * Message Edited Event
   * --------------------
   * When a user edits their message, broadcast the updated content
   * to all users in the chat so they see the changes.
   * 
   * Example flow:
   * 1. User clicks Edit on their message
   * 2. Modal shows current content
   * 3. User modifies text and clicks Save
   * 4. Client sends 'message_edited' with new content
   * 5. All users see "[edited]" indicator and updated text
   */
  socket.on('message_edited', ({ chatId, messageId, content }) => {
    if (chatId && messageId && content) {
      console.log(`✏️ Message ${messageId} edited in chat ${chatId}`);
      
      // Broadcast edited message to all users in chat
      io.to(`chat_${chatId}`).emit('message_edited', {
        chatId,
        messageId,
        content,
        editedAt: new Date().toISOString(),
      });
    }
  });

  /**
   * Message Deleted Event
   * ---------------------
   * When a user deletes their message, broadcast the deletion
   * so all users see it marked as "[message deleted]".
   * 
   * Note: This is a SOFT delete - message still exists in DB
   * but is marked as deleted for timeline integrity.
   */
  socket.on('message_deleted', ({ chatId, messageId }) => {
    if (chatId && messageId) {
      console.log(`🗑️ Message ${messageId} deleted in chat ${chatId}`);
      
      // Broadcast deletion to all users in chat
      io.to(`chat_${chatId}`).emit('message_deleted', {
        chatId,
        messageId,
        deletedAt: new Date().toISOString(),
      });
    }
  });

  /**
   * Start Typing Event
   * ------------------
   * When a user starts typing, show a typing indicator to others.
   * Throttled on client side (broadcast every 1-2 seconds, not every keystroke).
   * 
   * Visual feedback:
   * - Shows "John is typing..." below the message list
   * - Auto-disappears after 3 seconds of no typing
   * 
   * Why important?
   * - Improves conversation feel (know other person is responding)
   * - Prevents waiting confusion ("Is they coming back?")
   * - Standard in all modern chat apps
   */
  socket.on('start_typing', ({ chatId, username }) => {
    if (chatId && username) {
      console.log(`⌨️ ${username} is typing in chat ${chatId}`);
      
      // Broadcast to all OTHER users in chat (not the typer)
      socket.broadcast.to(`chat_${chatId}`).emit('user_typing', {
        chatId,
        username,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Stop Typing Event
   * -----------------
   * When user stops typing (pauses > 2 sec or sends message),
   * broadcast this to remove typing indicator.
   */
  socket.on('stop_typing', ({ chatId, username }) => {
    if (chatId && username) {
      console.log(`⌨️ ${username} stopped typing in chat ${chatId}`);
      
      // Notify all other users
      socket.broadcast.to(`chat_${chatId}`).emit('user_stopped_typing', {
        chatId,
        username,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Mark Message as Read Event
   * --------------------------
   * When user reads a message, broadcast read receipt to others.
   * Read receipts show who has seen the message and when.
   * 
   * Example:
   * - Message shows checkmarks: ✓ (sent), ✓✓ (delivered), ✓✓ (read)
   * - Only for message sender's own messages
   * - Helps confirm message was received
   */
  socket.on('message_read', ({ chatId, messageId, userId }) => {
    if (chatId && messageId && userId) {
      console.log(`👁️ User ${userId} read message ${messageId}`);
      
      // Broadcast read receipt to all users in chat
      io.to(`chat_${chatId}`).emit('message_read', {
        chatId,
        messageId,
        userId,
        readAt: new Date().toISOString(),
      });
    }
  });

  // ========== FRIEND SYSTEM EVENTS ==========

  /**
   * Friend Request Sent Event
   * -------------------------
   * Notify recipient when they receive a friend request.
   * 
   * Flow:
   * 1. User A clicks "Add Friend" on User B's profile
   * 2. Friend request created in DB with status='pending'
   * 3. Socket event sent to notify User B in real-time
   * 4. User B sees badge update without page refresh
   */
  socket.on('friend_request_sent', ({ recipientId, requesterUsername }) => {
    if (recipientId && requesterUsername) {
      console.log(`🤝 Friend request sent to ${recipientId} from ${requesterUsername}`);
      
      // Send notification to specific user (using their userId room)
      io.to(recipientId).emit('new_friend_request', {
        requesterUsername,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Friend Request Accepted Event
   * ----------------------------
   * Notify requester when their friend request is accepted.
   * Updates both users' friend lists in real-time.
   */
  socket.on('friend_request_accepted', ({ requesterId, recipientUsername }) => {
    if (requesterId && recipientUsername) {
      console.log(`✅ Friend request accepted for ${requesterId}`);
      
      // Notify requester that their request was accepted
      io.to(requesterId).emit('friend_request_accepted', {
        username: recipientUsername,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Friend Removed Event
   * --------------------
   * When a user unfriends someone, notify the other user.
   */
  socket.on('friend_removed', ({ otherId, username }) => {
    if (otherId && username) {
      console.log(`👋 Friend removed by ${username}`);
      
      // Notify the other user they were unfriended
      io.to(otherId).emit('friend_removed', {
        username,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ========== CHAT CREATION EVENT ==========

  /**
   * Chat Created Event
   * ------------------
   * When a new DM or group chat is created, notify all participants.
   * One participant is the creator, others should see it in their chat list.
   */
  socket.on('chat_created', ({ chat, participantIds }) => {
    if (chat && participantIds) {
      console.log(`💬 New chat created: ${chat._id}`);
      
      // Notify all participants about the new chat
      // Each participant receives the chat in their list
      participantIds.forEach((userId) => {
        io.to(userId).emit('chat_created', {
          chat,
          timestamp: new Date().toISOString(),
        });
      });
    }
  });

  // ========== USER PRESENCE EVENTS ==========

  /**
   * User Online Event
   * -----------------
   * When user opens the app, they broadcast their online status.
   * Friends can see if they're available for chatting.
   */
  socket.on('user_online', ({ userId, username }) => {
    if (userId && username) {
      console.log(`🟢 ${username} is online`);
      
      // Broadcast to all connected users
      io.emit('user_status_changed', {
        userId,
        username,
        isOnline: true,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * User Offline Event
   * ------------------
   * When user leaves the app or disconnects, broadcast offline status.
   */
  socket.on('user_offline', ({ userId, username }) => {
    if (userId && username) {
      console.log(`🔴 ${username} is offline`);
      
      // Broadcast to all connected users
      io.emit('user_status_changed', {
        userId,
        username,
        isOnline: false,
        timestamp: new Date().toISOString(),
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

  // ========== WEBRTC CALL EVENTS ==========

  /**
   * SDP Offer Event
   * ---------------
   * WebRTC signaling: Caller sends their connection offer (SDP) to receiver.
   * SDP = Session Description Protocol (describes media capabilities).
   * 
   * Example flow:
   * 1. Caller initiates call via API
   * 2. Both connect to WebRTC
   * 3. Caller creates offer (peer connection description)
   * 4. This event sends offer to receiver
   * 5. Receiver creates answer
   * 6. They exchange ICE candidates
   * 7. Direct P2P connection establishes
   */
  socket.on('sdp_offer', ({ callId, offer, receiverId }) => {
    if (callId && offer && receiverId) {
      console.log(`📡 SDP Offer sent for call ${callId}`);
      
      // Forward the offer to the receiver
      io.to(receiverId).emit('sdp_offer', {
        callId,
        offer,
      });
    }
  });

  /**
   * SDP Answer Event
   * ----------------
   * WebRTC signaling: Receiver responds with their connection answer (SDP).
   * This completes the handshake for establishing the P2P connection.
   */
  socket.on('sdp_answer', ({ callId, answer, callerId }) => {
    if (callId && answer && callerId) {
      console.log(`📡 SDP Answer sent for call ${callId}`);
      
      // Forward the answer back to the caller
      io.to(callerId).emit('sdp_answer', {
        callId,
        answer,
      });
    }
  });

  /**
   * ICE Candidate Event
   * -------------------
   * WebRTC signaling: Exchange ICE (Interactive Connectivity Establishment) candidates.
   * ICE candidates are potential network routes for the peer connection.
   * 
   * Why needed:
   * - Users might be behind firewalls/NAT
   * - ICE tries multiple connection paths
   * - This is how P2P connection actually routes through the internet
   */
  socket.on('ice_candidate', ({ callId, candidate, targetUserId }) => {
    if (callId && candidate && targetUserId) {
      console.log(`📡 ICE Candidate sent for call ${callId}`);
      
      // Forward ICE candidate to the other party
      io.to(targetUserId).emit('ice_candidate', {
        callId,
        candidate,
      });
    }
  });
});

// Start the server
const PORT = process.env.SOCKET_PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 Socket.io Server Running                                 ║
║   📡 Port: ${PORT}                                               ║
║                                                               ║
║   📝 POST EVENTS:                                             ║
║   • new_post      - Broadcast new posts                       ║
║   • post_liked    - Handle likes & notifications              ║
║   • post_commented - Handle comments & notifications          ║
║                                                               ║
║   💬 CHAT EVENTS:                                             ║
║   • join_chat, leave_chat       - Chat room management        ║
║   • message_sent, message_edited, message_deleted             ║
║   • start_typing, stop_typing   - Typing indicators           ║
║   • message_read                - Read receipts               ║
║                                                               ║
║   🤝 FRIEND EVENTS:                                           ║
║   • friend_request_sent, friend_request_accepted              ║
║   • friend_removed              - Unfriend notifications      ║
║                                                               ║
║   � CALL EVENTS (WebRTC):                                    ║
║   • sdp_offer, sdp_answer       - Connection handshake        ║
║   • ice_candidate               - Network routing info        ║
║                                                               ║
║   �👁️ PRESENCE EVENTS:                                          ║
║   • user_online, user_offline   - User status tracking        ║
║   • user_status_changed         - Broadcast status            ║
║                                                               ║
║   🔌 CONNECTION EVENTS:                                       ║
║   • authenticate  - User identification at login              ║
║   • disconnect    - Cleanup on disconnect                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
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
