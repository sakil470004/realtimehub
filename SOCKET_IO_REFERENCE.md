/**
 * SOCKET.IO EVENT REFERENCE GUIDE
 * ===============================
 * 
 * Quick lookup for all Socket.io events in RealTimeHub.
 * Shows where events are emitted, what they do, and who receives them.
 */

// ========== CONNECTION & AUTHENTICATION ==========

/*
✅ authenticate
   Emitted by: Socket client (lib/socket.ts)
   Sent when: Socket connects
   Data: { userId: string }
   Handler: server.js - socket.on('authenticate')
   Purpose: Tell server which user this socket belongs to
   Result: Server stores userId → socketId mapping
*/

/*
✅ user_online
   Emitted by: AuthContext.tsx (on login/checkAuth)
   Sent when: User logs in
   Data: { userId: string, username: string }
   Handler: server.js - socket.on('user_online')
   Broadcast: io.emit('user_status_changed', {...})
   Received by: All connected clients
   Purpose: Notify everyone user came online
   UI Update: Friends page shows green dot
*/

/*
✅ user_offline
   Emitted by: AuthContext.tsx (on logout)
   Sent when: User logs out
   Data: { userId: string, username: string }
   Handler: server.js - socket.on('user_offline')
   Broadcast: io.emit('user_status_changed', {...})
   Received by: All connected clients
   Purpose: Notify everyone user went offline
   UI Update: Friends page removes green dot
*/

// ========== CHAT ROOM MANAGEMENT ==========

/*
✅ join_chat
   Emitted by: ChatModal.tsx (useEffect when modal opens)
   Sent when: User opens a chat conversation
   Data: { chatId: string, userId: string }
   Handler: server.js - socket.on('join_chat')
   Action: socket.join(`chat_${chatId}`)
   Purpose: Add user's socket to chat room
   Result: User gets all real-time updates for this chat
*/

/*
✅ leave_chat
   Emitted by: ChatModal.tsx (useEffect cleanup)
   Sent when: User closes chat modal
   Data: { chatId: string, userId: string }
   Handler: server.js - socket.on('leave_chat')
   Action: socket.leave(`chat_${chatId}`)
   Purpose: Remove user from chat room
   Result: Stop receiving updates for this chat
*/

// ========== MESSAGE EVENTS ==========

/*
✅ message_sent
   Emitted by: ChatModal.tsx (after message sent to API)
   Sent when: User sends a message in chat
   Data: { chatId: string, message: Message }
   Handler: server.js - socket.on('message_sent')
   Broadcast: io.to(`chat_${chatId}`).emit('message_received', {...})
   Received by: All users in chat_${chatId} room
   Purpose: Synchronize new message across all viewers
   
   Flow:
   1. User types message
   2. ChatModal sends to API (POST /api/chats/[chatId]/messages)
   3. API validates and saves to MongoDB
   4. Client emits 'message_sent' with new message
   5. Server broadcasts 'message_received' to chat room
   6. All ChatModals viewing this chat receive update
   7. Messages array updates, UI re-renders
   8. Message appears on everyone's screen in real-time
*/

/*
✅ message_received
   Emitted by: Socket.io server
   Sent when: Another user sends message or socket.emit('message_sent')
   Data: { chatId: string, message: Message }
   Handler: ChatModal.tsx - socket.on('message_received')
   Purpose: Update chat with new message
   UI Effect: Message appears in messages list
   Auto-triggered: Auto-scroll to newest message
*/

/*
✅ message_edited
   Emitted by: ChatModal.tsx (after API PUT call)
   Sent when: User edits their message
   Data: { chatId: string, messageId: string, content: string }
   Handler: server.js - socket.on('message_edited')
   Broadcast: io.to(`chat_${chatId}`).emit('message_edited', {...})
   Received by: All users in that chat
   Purpose: Sync edited message content
   UI Effect: Message shows new content + "[edited]" indicator
*/

/*
✅ message_deleted
   Emitted by: ChatModal.tsx (after API DELETE call)
   Sent when: User deletes their message
   Data: { chatId: string, messageId: string }
   Handler: server.js - socket.on('message_deleted')
   Broadcast: io.to(`chat_${chatId}`).emit('message_deleted', {...})
   Received by: All users in that chat
   Purpose: Sync deleted message status
   UI Effect: Message shows "[message deleted]" placeholder
   Note: Soft delete - message stays in DB, just marked deleted
*/

/*
✅ message_read
   Emitted by: ChatModal.tsx (after API POST /messages/[id]/read)
   Sent when: User reads a message
   Data: { chatId: string, messageId: string, userId: string }
   Handler: server.js - socket.on('message_read')
   Broadcast: io.to(`chat_${chatId}`).emit('message_read', {...})
   Received by: All users in that chat
   Purpose: Sync read receipt
   UI Effect: Message shows ✓✓ instead of ✓
   Use case: Show other user message was actually read
*/

// ========== TYPING INDICATORS ==========

/*
✅ start_typing
   Emitted by: ChatModal.tsx (handleTyping on input change)
   Sent when: User starts typing a message
   Data: { chatId: string, username: string }
   Handler: server.js - socket.on('start_typing')
   Broadcast: socket.broadcast.to(`chat_${chatId}`).emit('user_typing', {...})
   Received by: All OTHER users in that chat (NOT sender)
   Purpose: Show typing indicator
   
   Throttling:
   - Emit once on keystroke
   - Set 2-second timeout
   - If more keystrokes within 2s, restart timer
   - After 2s inactivity, assume stopped typing
   - Reduces event spam from 100+ typing events to 1-2
   
   UI Effect: Shows "John is typing..." below message list
*/

/*
✅ stop_typing
   Emitted by: ChatModal.tsx (when typing timeout expires or message sent)
   Sent when: User stops typing or sends message
   Data: { chatId: string, username: string }
   Handler: server.js - socket.on('stop_typing')
   Broadcast: socket.broadcast.to(`chat_${chatId}`).emit('user_stopped_typing', {...})
   Received by: All OTHER users in that chat
   Purpose: Remove typing indicator
   UI Effect: "John is typing..." disappears
*/

/*
✅ user_typing
   Emitted by: Socket.io server
   Received by: ChatModal.tsx listeners
   Purpose: Display typing indicator
   State: usersTyping array tracks who's typing
   Display: Shown below message area
*/

/*
✅ user_stopped_typing
   Emitted by: Socket.io server
   Received by: ChatModal.tsx listeners
   Purpose: Hide typing indicator
   Effect: Remove user from usersTyping array
*/

// ========== FRIEND SYSTEM EVENTS ==========

/*
✅ friend_request_sent
   Emitted by: Friends/Discovery page (after API POST /api/friends)
   Sent when: User sends friend request to another user
   Data: { recipientId: string, requesterUsername: string }
   Handler: server.js - socket.on('friend_request_sent')
   Target: io.to(recipientId).emit('new_friend_request', {...})
   Received by: Recipient's sockets only
   Purpose: Notify recipient of new friend request
   UI Effect: FriendsPage updates pending requests count (no refresh)
*/

/*
✅ friend_request_accepted
   Emitted by: FriendsPage.tsx (after API POST /api/friends/[id]/accept)
   Sent when: User accepts friend request
   Data: { requesterId: string, recipientUsername: string }
   Handler: server.js - socket.on('friend_request_accepted')
   Target: io.to(requesterId).emit('friend_request_accepted', {...})
   Received by: Requester's sockets only
   Purpose: Notify requester their request was accepted
   UI Effect: Requester's FriendsPage shows new person in friends list
*/

/*
✅ friend_removed
   Emitted by: FriendsPage.tsx (after API POST /api/friends/[id]/remove)
   Sent when: User unfriends someone
   Data: { otherId: string, username: string }
   Handler: server.js - socket.on('friend_removed')
   Target: io.to(otherId).emit('friend_removed', {...})
   Received by: Other user's sockets only
   Purpose: Notify other user they were unfriended
   UI Effect: Updates friends list
*/

/*
✅ new_friend_request
   Emitted by: Socket.io server
   Received by: FriendsPage.tsx listeners
   Triggers: Badge update in Navbar (pending requests count)
*/

// ========== CHAT CREATION EVENTS ==========

/*
✅ chat_created
   Emitted by: ChatsPage.tsx (after API POST /api/chats)
   Sent when: User creates new DM or group chat
   Data: { chat: Chat, participantIds: string[] }
   Handler: server.js - socket.on('chat_created')
   Target: Loop through participantIds, emit to each
   Received by: All chat participants
   Purpose: Add new chat to everyone's chat list
   
   For DMs:
   - Emitted to recipient only
   - Recipient sees DM in chat list
   - Can start messaging immediately
   
   For Groups:
   - Emitted to all members except creator
   - Creator already has chat in list
   - All members see same group
*/

// ========== ALL EVENTS SUMMARY TABLE ==========

/*
┌─────────────────────────────────────────────────────────────┐
│ EVENT SOURCE       │ EVENT NAME           │ BROADCAST TO    │
├─────────────────────────────────────────────────────────────┤
│ AuthContext        │ user_online          │ All (io.emit)   │
│ AuthContext        │ user_offline         │ All (io.emit)   │
├─────────────────────────────────────────────────────────────┤
│ ChatModal          │ join_chat            │ Server only     │
│ ChatModal          │ leave_chat           │ Server only     │
│ ChatModal          │ message_sent         │ Chat room       │
│ ChatModal          │ message_edited       │ Chat room       │
│ ChatModal          │ message_deleted      │ Chat room       │
│ ChatModal          │ message_read         │ Chat room       │
│ ChatModal          │ start_typing         │ Other users     │
│ ChatModal          │ stop_typing          │ Other users     │
├─────────────────────────────────────────────────────────────┤
│ FriendsPage        │ friend_request_sent  │ Recipient       │
│ FriendsPage        │ friend_request_accept│ Requester       │
│ FriendsPage        │ friend_removed       │ Other user      │
├─────────────────────────────────────────────────────────────┤
│ ChatsPage          │ chat_created         │ Participants    │
└─────────────────────────────────────────────────────────────┘

BROADCAST STRATEGIES:
✅ Chat room:   io.to(`chat_${chatId}`).emit(...)
   → Only users actively viewing this chat
   
✅ Specific user: io.to(userId).emit(...)
   → User's all devices/tabs
   
✅ All users:    io.emit(...)
   → Broadcast to everyone connected
   
✅ Others only:  socket.broadcast.to(...).emit(...)
   → All except sender
*/

// ========== FILE LOCATIONS ==========

/*
Server-side handlers:
  /server.js - Lines 100-280
  All socket.on() event listeners defined here
  Broadcasting logic in each handler

Client-side emission:
  /components/ChatModal.tsx      - Lines 200-300 (message events)
  /app/chats/page.tsx            - Lines 150-250 (chat events)
  /app/friends/page.tsx          - Lines 150-200 (friend events)
  /contexts/AuthContext.tsx      - Lines 90-150 (presence events)

Client-side listeners:
  /components/ChatModal.tsx      - Lines 350-450 (socket.on())
  /app/chats/page.tsx            - Lines 300-350
  /app/friends/page.tsx          - Lines 250-300

Socket setup:
  /lib/socket.ts                 - Socket manager connection
*/

// ========== ONE-MINUTE TEST ==========

/*
Quick test to verify Socket.io is working:

1. Open http://localhost:3000/chats in Browser A
2. Open http://localhost:3000/chats in Browser B
3. Create DM from A → B
4. Verify chat appears in B's list (no refresh needed)
5. Send message from A to B
6. Verify message appears in B immediately
7. Close DevTools Network tab to see it's Socket.io, not polling

All working? ✅ Socket.io integration complete!
*/

export {};
