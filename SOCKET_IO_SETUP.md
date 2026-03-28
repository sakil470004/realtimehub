/**
 * SOCKET.IO SETUP & TROUBLESHOOTING GUIDE
 * =======================================
 * 
 * Complete guide to running and debugging Socket.io in RealTimeHub.
 * Follow this if Socket.io events aren't working.
 */

// ========== PREREQUISITES ==========

/*
✅ MongoDB running
   Command: mongod
   Status: Check with mongo shell or MongoDB Compass
   
✅ Node.js and npm installed
   Command: node --version && npm --version
   Required: Node 16+ for Socket.io 4
   
✅ Environment variables set
   File: .env.local
   Required variables:
   - MONGODB_URI="mongodb://localhost:27017/realtimehub"
   - JWT_SECRET="your-secret-key-here"
   - NEXT_PUBLIC_APP_URL="http://localhost:3000"
   - NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
*/

// ========== RUNNING THE APPLICATION ==========

/*
STEP 1: Start MongoDB
─────────────────────
# Terminal 1
mongod

# Or use MongoDB Docker container (alternative)
docker run -d -p 27017:27017 --name mongodb mongo

# Verify with
mongo
> show dbs


STEP 2: Install Dependencies
──────────────────────────────
# In project directory
npm install

# Verify Socket.io installed
npm list socket.io
# Should show: socket.io@4.x.x (or later)


STEP 3: Start Socket.io Server
────────────────────────────────
# Terminal 2
npm run socket

# Expected output:
# 🚀 Socket.io Server Running
# 📡 Port: 3001
# [list of events]

# Note: Server must be running BEFORE Next.js app
# Otherwise clients can't connect to it


STEP 4: Start Next.js Dev Server
──────────────────────────────────
# Terminal 3
npm run dev

# Expected output:
# ▲ Next.js 14.x.x
# - ready started server on 0.0.0.0:3000


STEP 5: Verify Everything Works
─────────────────────────────────
✅ Open http://localhost:3000
✅ Log in with test account
✅ Open DevTools → Network → WS (WebSocket)
   Should see: "socket.io" connection
✅ Check socket server terminal for: "🔌 New connection"
✅ Check socket server terminal for: "✅ User ... authenticated"

ALL CHECKS PASS? → Socket.io is working!
*/

// ========== PORT CONFIGURATION ==========

/*
DEFAULT PORTS:
- Next.js App:     3000
- Socket.io Server: 3001
- MongoDB:         27017

IF PORTS ARE IN USE:

Change Next.js Port:
  npx next dev -p 3001  (runs on 3001 instead of 3000)
  
Change Socket.io Port:
  npm run socket -- --port 3002
  Then update .env.local: NEXT_PUBLIC_SOCKET_URL="http://localhost:3002"
  
Find what's using a port:
  # macOS/Linux
  lsof -i :3001
  kill -9 <PID>
  
  # Windows
  netstat -ano | findstr :3001
  taskkill /PID <PID> /F


Check if port is available:
  # macOS/Linux
  nc -zv localhost 3001
  
  # If connection refused = port is free
  # If connection succeeded = port is in use
*/

// ========== ENVIRONMENT SETUP ==========

/*
FILE: .env.local
─────────────────
Required:
MONGODB_URI=mongodb://localhost:27017/realtimehub
JWT_SECRET=your-secret-key-for-jwt
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

Optional:
NODE_ENV=development
SOCKET_PORT=3001

Example .env.local:
─────────────────
MONGODB_URI=mongodb://localhost:27017/realtimehub
JWT_SECRET=mysecretkey123456789
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NODE_ENV=development
SOCKET_PORT=3001
*/

// ========== QUICK VERIFICATION CHECKLIST ==========

/*
Run these checks to verify Socket.io is working:

✅ STEP 1: Socket server running?
   Check terminal: npm run socket running?
   Check output: Should show "🚀 Socket.io Server Running"
   
✅ STEP 2: NextJS running?
   Check terminal: npm run dev running?
   Open http://localhost:3000
   
✅ STEP 3: MongoDB running?
   Command: mongo (should connect)
   Or check MongoDB Compass
   
✅ STEP 4: App loads?
   Browser shows app (no errors)
   
✅ STEP 5: Can log in?
   Log in with test account
   Check server logs for "User authenticated"
   
✅ STEP 6: WebSocket connected?
   DevTools → Network tab
   Filter by "WS" (WebSocket)
   Should see "socket.io" connection
   
✅ STEP 7: Events working?
   Open /chats page
   Send message in DM
   Check: Does message appear immediately?
   
✅ STEP 8: Server logs show events?
   Check socket server terminal
   Should show event logs:
   "💬 Message sent to chat ..."
   
ALL 8 CHECKS PASS? ✅ Ready to use!
*/

// ========== COMMON ISSUES & SOLUTIONS ==========

/*
╔════════════════════════════════════════════════════════╗
║ ISSUE: Socket.io connection fails                      ║
╚════════════════════════════════════════════════════════╝

Symptoms:
- DevTools Network tab: No "socket.io" connection
- Console error: "Failed to connect to socket server"
- Socket server logs: No "New connection" message

Debug Steps:
1. Check socket server running:
   - Is "npm run socket" running in Terminal 2?
   - Check for "[Port]: 3001" in output
   
2. Check port 3001 is open:
   netstat -an | grep 3001
   If nothing shown, port available but server not listening
   
3. Check CORS configuration:
   In server.js, verify cors settings:
   cors: { origin: 'http://localhost:3000' }
   
4. Check environment variable:
   In .env.local, verify:
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
   
5. Hard refresh browser:
   Cmd+Shift+R (macOS) or Ctrl+Shift+F5 (Windows)
   Clears browser cache that might have old URL
   
6. Check browser console for CORS errors:
   If error mentions CORS, Socket.io server's CORS origin doesn't match
   
7. Try different port:
   Kill socket server: lsof -i :3001 | kill <PID>
   Start on different port: npm run socket -- --port 3002
   Update .env.local: NEXT_PUBLIC_SOCKET_URL="http://localhost:3002"


╔════════════════════════════════════════════════════════╗
║ ISSUE: Messages not syncing across browsers            ║
╚════════════════════════════════════════════════════════╝

Symptoms:
- Send message in Browser A
- Message doesn't appear in Browser B
- But message exists in database (checked MongoDB)

Debug Steps:
1. Verify both browsers connected:
   Socket server logs should show 2 "New connection" messages
   
2. Check both in same chat:
   Both should join same room: socket.join('chat_123')
   Check server logs for "User X joined chat"
   
3. Verify message_sent event emitted:
   Add console.log in ChatModal.tsx:
   socket?.emit('message_sent', { chatId, message });
   console.log('Emitted message_sent');
   
4. Check server received event:
   In server.js, add logging:
   socket.on('message_sent', (data) => {
     console.log('🔥 Received message_sent:', data);
     ...
   });
   
5. Verify broadcast happening:
   Check server logs show broadcast to room
   
6. Check client listener:
   Verify ChatModal has:
   socket.on('message_received', (data) => { ... });
   
7. Check for race condition:
   Message might be added to UI immediately (optimistic update)
   Then added again from Socket event
   Fix: Check if message already in array before adding:
   
   const handleNewMessage = (data: { message: Message }) => {
     setMessages((prev) => {
       const exists = prev.some((m) => m._id === data.message._id);
       return exists ? prev : [...prev, data.message];
     });
   };


╔════════════════════════════════════════════════════════╗
║ ISSUE: Typing indicator not showing                    ║
╚════════════════════════════════════════════════════════╝

Symptoms:
- Another user types but no "User is typing..." indicator
- Or indicator shows but never disappears

Debug Steps:
1. Verify typing event emitted:
   In ChatModal.tsx, check handleTyping called on input
   Add console.log('Typing...');
   
2. Check throttling working:
   Should emit once per 2 seconds, not every keystroke
   Open DevTools Network filter by WS
   Type in message box
   Should see only 1-2 events, not 20+
   
3. Verify server receives:
   server.js logs should show "⌨️ username is typing"
   
4. Check broadcast to others:
   socket.broadcast.to() should send to other users only
   
5. Verify clients listening:
   CheckChatModal has listener:
   socket.on('user_typing', (data) => { ... });
   
6. Check timeout working:
   Stop typing for 3 seconds
   Indicator should disappear
   If not, listener for 'user_stopped_typing' not working


╔════════════════════════════════════════════════════════╗
║ ISSUE: Read receipts (✓✓) not showing                 ║
╚════════════════════════════════════════════════════════╝

Debug Steps:
1. Verify API call:
   ChatModal calls: POST /api/messages/[id]/read
   Check in DevTools Network tab
   
2. Check message_read event emitted:
   After API call, should emit:
   socket?.emit('message_read', { chatId, messageId, userId });
   
3. Verify server receives and broadcasts:
   server.js should log "👁️ User ... read message"
   
4. Check message object updated:
   Log the message to console before/after read
   readBy array should include userId


╔════════════════════════════════════════════════════════╗
║ ISSUE: Friend requests not notifying                   ║
╚════════════════════════════════════════════════════════╝

Debug Steps:
1. Verify API call succeeded:
   POST /api/friends in DevTools Network
   
2. Check socket.emit in code:
   After API success, check:
   socket?.emit('friend_request_sent', { recipientId, requesterUsername });
   
3. Verify server receives:
   server.js logs should show "🤝 Friend request sent to"
   
4. Check target socket exists:
   Replace userSockets.get(recipientId) with logging:
   console.log('Sending to:', recipientId, 'Socket:', userSockets.get(recipientId));
   
5. Check recipient listening:
   FriendsPage.tsx should have:
   socket.on('new_friend_request', (data) => { ... });


╔════════════════════════════════════════════════════════╗
║ ISSUE: Server crashes when Socket.io runs              ║
╚════════════════════════════════════════════════════════╝

Debug Steps:
1. Check Node version:
   node --version (should be 16+)
   
2. Check dependencies installed:
   npm install socket.io
   
3. Check for syntax errors:
   npm run socket 2>&1 | head -20
   Look for "SyntaxError" or "Cannot find module"
   
4. Try different port:
   npm run socket -- --port 3003
   
5. Check for infinite loops:
   Look for while(true) or recursive calls
   
6. Check memory:
   Socket.io servers can use lots of memory
   Monitor with: top (macOS/Linux)
   
7. Enable detailed errors:
   Add DEBUG=socket.io:* npm run socket
   Shows detailed debugging info
*/

// ========== PRODUCTION DEPLOYMENT ==========

/*
DEPLOYING TO PRODUCTION:

Socket.io runs on separate server from Next.js.
Both need to be deployed and accessible.

Changes needed:
1. Update NEXT_PUBLIC_SOCKET_URL
   Development: http://localhost:3001
   Production: https://socket.yourdomain.com
   
2. Update CORS origin in server.js
   cors: {
     origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
   }
   
3. Use environment-specific ports
   Development: :3001
   Production: :443 or use nginx reverse proxy
   
4. Enable HTTPS for Socket.io
   Socket.io works with HTTP or HTTPS
   Recommended: Use HTTPS in production
   
5. Deploy socket server to separate instance
   Example: Deploy to Heroku or AWS
   - Next.js on Vercel
   - Socket.io on Heroku
   - Both should connect via secured WebSocket
   
6. Use reverse proxy (optional but recommended)
   nginx can proxy Socket.io connections
   Provides SSL termination and load balancing

Example nginx config:
──────────────────
upstream socket_server {
  server localhost:3001;
}

server {
  listen 443 ssl;
  server_name socket.yourdomain.com;
  
  ssl_certificate ...;
  ssl_certificate_key ...;
  
  location / {
    proxy_pass http://socket_server;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
*/

// ========== TESTING IN PRODUCTION ==========

/*
Verify Socket.io in production:

1. Open app on production URL
2. Log in with test account
3. Open DevTools → Network → WS
4. Should see WebSocket connection to socket.yourdomain.com
5. Open another browser window (or incognito)
6. Send message
7. Should appear in first browser immediately
8. Check server logs for event confirmations

Common production issues:
- Firewall blocking port 3001
  Solution: Use nginx reverse proxy on port 443
  
- CORS failing
  Solution: Update cors origin to production URL
  
- SSL certificate issues
  Solution: Use Let's Encrypt for free certificates
  
- WebSocket upgrade failing
  Solution: Ensure reverse proxy supports WebSocket upgrade
*/

// ========== MONITORING & LOGGING ==========

/*
Monitor Socket.io in production:

1. Server logs:
   Watch socket server output for:
   - Connection count
   - Event frequency
   - Error rates
   
   Example command:
   tail -f socket-server.log | grep -i error
   
2. Prometheus metrics (advanced):
   Can export Socket.io metrics to monitoring system
   
3. Application Performance:
   Monitor memory usage
   Monitor message latency
   Monitor connection count
   
4. Real-time debugging:
   Enable debug mode:
   DEBUG=socket.io:* npm run socket
   Shows every event in real-time

Production checklist:
✅ HTTPS/SSL enabled
✅ CORS origin set correctly
✅ Firewall allows connections
✅ Error logging configured
✅ Load balancing (optional)
✅ Database backups configured
✅ Monitoring alerts set up
*/

export {};
