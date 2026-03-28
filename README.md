# RealTimeHub

A comprehensive real-time social media application with live messaging, friendships, and instant updates. Built with Next.js 16, MongoDB, Socket.io, and TypeScript.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![MongoDB](https://img.shields.io/badge/MongoDB-7-green?logo=mongodb)
![Socket.io](https://img.shields.io/badge/Socket.io-4-black?logo=socket.io)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwindcss)

## ✨ Features

### Core Social Features
- **📝 Posts** - Create, edit, delete posts with soft delete
- **❤️ Likes** - Real-time like/unlike with live counters
- **💬 Comments** - Add, edit, delete comments on posts
- **🔔 Notifications** - Real-time notifications for likes, comments, friend requests

### Chat & Messaging
- **💌 Direct Messages** - 1-on-1 conversations between users
- **👥 Group Chats** - Create and manage group conversations
- **✏️ Message Editing** - Edit sent messages (shows edit indicator 📝)
- **🗑️ Message Deletion** - Soft delete messages with placeholders
- **✓✓ Read Receipts** - See who has read your messages
- **⌨️ Typing Indicators** - Show when others are typing
- **🟢 Online Status** - Real-time online/offline indicators
- **📱 Full-Screen Chat** - Dedicated chat pages for better UX

### Friend System
- **👤 Friend Requests** - Send, accept, reject friend requests
- **👥 Friends List** - Manage friends with online status
- **🔍 Search** - Find friends by username
- **👤 User Profiles** - Public profiles with user statistics
- **📊 Profile Stats** - View friends count, posts count, mutual friends

### User Experience
- **🔐 Authentication** - Secure JWT-based auth with HTTP-only cookies
- **🌙 Dark Mode** - Automatic system preference detection
- **📱 Responsive Design** - Works on desktop, tablet, mobile
- **⚡ Real-time Updates** - Socket.io for instant communication
- **🔄 Optimistic UI** - UI updates before API response

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16 (App Router), React 18, TypeScript |
| **Styling** | Tailwind CSS, Dark Mode Support |
| **Backend** | Next.js API Routes, Node.js |
| **Database** | MongoDB, Mongoose 6+ |
| **Real-time** | Socket.io 4.x |
| **Auth** | JWT, bcrypt, HTTP-only Cookies |
| **Validation** | Zod |
| **Environment** | Environment variables, .env.local |

## 📁 Project Structure

```
realtimehub/
├── app/                           # Next.js App Router
│   ├── api/                       # API endpoints
│   │   ├── auth/                  # Authentication
│   │   │   ├── login/route.ts
│   │   │   ├── signup/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── me/route.ts
│   │   ├── posts/                 # Post operations
│   │   │   ├── route.ts
│   │   │   └── [id]/              # Post-specific endpoints
│   │   │       ├── comments/route.ts
│   │   │       └── like/route.ts
│   │   ├── chats/                 # Chat management
│   │   │   ├── route.ts
│   │   │   └── [chatId]/messages/route.ts
│   │   ├── messages/              # Message operations
│   │   │   └── [messageId]/route.ts
│   │   ├── friends/               # Friend system
│   │   │   ├── route.ts
│   │   │   ├── list/route.ts
│   │   │   └── [id]/              # Friendship operations
│   │   ├── users/                 # User endpoints
│   │   │   ├── [userId]/route.ts
│   │   │   └── online/route.ts
│   │   └── notifications/         # Notifications
│   │       └── route.ts
│   ├── pages/                     # UI Pages
│   │   ├── feed/page.tsx
│   │   ├── create/page.tsx
│   │   ├── chats/page.tsx
│   │   ├── chats/[chatId]/page.tsx  # ✨ NEW: Full-screen chat
│   │   ├── friends/page.tsx
│   │   ├── profile/[userId]/page.tsx
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── layout.tsx
│   ├── globals.css
├── components/                    # Reusable Components
│   ├── Navbar.tsx
│   ├── PostCard.tsx
│   ├── CommentSection.tsx
│   └── ChatModal.tsx              # Modal for quick chat (legacy)
├── contexts/                      # React Context
│   └── AuthContext.tsx
├── lib/                           # Utilities
│   ├── db.ts                      # MongoDB connection
│   ├── auth.ts                    # JWT utilities
│   ├── socket.ts                  # Socket.io client
│   ├── validators.ts              # Zod schemas
│   └── userPresence.ts            # Online status tracking
├── models/                        # Mongoose Schemas
│   ├── User.ts
│   ├── Post.ts
│   ├── Comment.ts
│   ├── Chat.ts                    # ✨ NEW: Chat model
│   ├── Message.ts                 # ✨ NEW: Message model
│   ├── Friendship.ts              # ✨ NEW: Friend request workflow
│   ├── Notification.ts
│   └── UserPresence.ts            # ✨ NEW: Online status tracking
├── server.js                      # Socket.io Server (port 3001)
├── middleware.ts                  # Route protection
├── package.json
├── tsconfig.json
├── next.config.ts
└── .env.local                     # Environment variables
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed ([Download](https://nodejs.org))
- MongoDB (Choose one):
  - Local: Install [MongoDB Community](https://docs.mongodb.com/manual/installation/)
  - Cloud: Free account on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

### Installation Steps

#### 1. Clone & Setup
```bash
git clone <your-repo-url>
cd realtimehub
npm install
```

#### 2. Configure Environment Variables

Create `.env.local`:
```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/realtimehub
# OR for local MongoDB:
# MONGODB_URI=mongodb://localhost:27017/realtimehub

# JWT Secret (generate a strong random string, min 32 chars)
JWT_SECRET=your-super-secret-key-min-32-characters-long-12345678

# Socket.io URLs
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### 3. Start Services

**Terminal 1 - MongoDB** (if using local):

If you installed MongoDB using Homebrew:
```bash
brew services start mongodb-community
```

Or alternatively, start MongoDB directly:
```bash
mongod
```

**Terminal 2 - Socket.io Server**:
```bash
npm run socket
```

**Terminal 3 - Next.js Development Server**:
```bash
npm run dev
```

#### 4. Open Application
- Visit `http://localhost:3000`
- Create account or use test credentials

#### Stop Services (when done)
```bash
# Stop MongoDB (if using brew)
brew services stop mongodb-community

# Or kill mongod process if running directly
# Stop Next.js: Ctrl+C in terminal
# Stop Socket.io: Ctrl+C in terminal
```

## 📡 API Documentation

### Authentication APIs

#### Sign Up
```http
POST /api/auth/signup
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securePassword123"
}

Response: 201 Created
{
  "message": "User created successfully",
  "user": { "id": "...", "username": "john_doe", "email": "john@example.com" }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}

Response: 200 OK
{
  "message": "Login successful",
  "user": { "id": "...", "username": "john_doe" }
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "user": { "id": "...", "username": "john_doe", "email": "john@example.com" }
}
```

#### Logout
```http
POST /api/auth/logout

Response: 200 OK
{
  "message": "Logged out successfully"
}
```

### Posts APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/posts` | GET | Get paginated posts (with pagination params: page, limit) |
| `/api/posts` | POST | Create new post |
| `/api/posts/:id` | PUT | Edit post (soft update) |
| `/api/posts/:id` | DELETE | Delete post (soft delete) |
| `/api/posts/:id/like` | POST | Toggle like on post |
| `/api/posts/:id/comments` | GET | Get post comments |
| `/api/posts/:id/comments` | POST | Add comment to post |

#### Create Post Request
```json
{
  "content": "Hello RealTimeHub! 🚀"
}
```

#### Edit Post Request
```json
{
  "content": "Updated content"
}
```

#### Add Comment Request
```json
{
  "text": "Great post!"
}
```

### Chat APIs

#### Get All Chats
```http
GET /api/chats
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "chats": [
    {
      "_id": "chat_123",
      "participants": [{ "_id": "user1", "username": "alice" }, ...],
      "name": null,
      "isGroup": false,
      "lastMessage": { "content": "Hey!", "_id": "msg_123", ... },
      "lastMessageAt": "2026-03-28T10:30:00Z"
    }
  ],
  "count": 5
}
```

#### Create Chat (DM)
```http
POST /api/chats
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "recipientId": "user_456",
  "isGroup": false
}

Response: 201 Created
{
  "message": "Direct message created",
  "chat": { "_id": "chat_123", ... }
}
```

#### Create Group Chat
```http
POST /api/chats
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Project Team",
  "participantIds": ["user_456", "user_789"],
  "isGroup": true
}

Response: 201 Created
{
  "message": "Group chat created",
  "chat": { "_id": "chat_123", ... }
}
```

#### Get Chat Messages
```http
GET /api/chats/{chatId}/messages?page=1&limit=50
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "messages": [
    {
      "_id": "msg_123",
      "sender": { "_id": "user_1", "username": "alice" },
      "content": "Hello!",
      "isEdited": false,
      "isDeleted": false,
      "readBy": [{ "user": "user_2", "readAt": "2026-03-28T10:31:00Z" }],
      "createdAt": "2026-03-28T10:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 100, "hasMore": true }
}
```

#### Send Message
```http
POST /api/chats/{chatId}/messages
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "content": "Hi there!"
}

Response: 201 Created
{
  "message": "Message sent",
  "message": { "_id": "msg_123", "sender": {...}, "content": "Hi there!", ... }
}
```

#### Edit Message
```http
PUT /api/messages/{messageId}
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "content": "Hi there! (edited)"
}

Response: 200 OK
{
  "message": "Message updated",
  "message": { "_id": "msg_123", "isEdited": true, "editedAt": "...", ... }
}
```

#### Delete Message
```http
DELETE /api/messages/{messageId}
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "message": "Message deleted",
  "message": { "_id": "msg_123", "isDeleted": true }
}
```

#### Mark Messages as Read
```http
POST /api/messages/{messageId}/read
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "message": "Messages marked as read"
}
```

### Friend APIs

#### Get Pending Friend Requests
```http
GET /api/friends
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "requests": [
    {
      "_id": "friendship_123",
      "requester": { "_id": "user_456", "username": "bob", "email": "bob@example.com" },
      "status": "pending"
    }
  ],
  "count": 2
}
```

#### Get Friends List
```http
GET /api/friends/list
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "friends": [
    {
      "_id": "user_456",
      "username": "alice",
      "email": "alice@example.com",
      "friendship": { "_id": "friendship_123", "acceptedAt": "2026-03-28T10:00:00Z" }
    }
  ],
  "count": 12
}
```

#### Send Friend Request
```http
POST /api/friends/send
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "recipientId": "user_456"
}

Response: 201 Created
{
  "message": "Friend request sent",
  "friendship": { "_id": "friendship_123", "status": "pending" }
}
```

#### Accept Friend Request
```http
POST /api/friends/{friendshipId}/accept
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "message": "Friend request accepted",
  "friendship": { "_id": "friendship_123", "status": "accepted" }
}
```

#### Reject Friend Request
```http
POST /api/friends/{friendshipId}/reject
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "message": "Friend request rejected"
}
```

#### Remove Friend
```http
DELETE /api/friends/{friendshipId}
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "message": "Friend removed"
}
```

#### Check Friendship Status
```http
GET /api/friends/status/{userId}
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "isFriend": true,
  "hasPendingRequest": false,
  "hasPendingReceived": false,
  "friendshipId": "friendship_123"
}
```

### User Profile APIs

#### Get User Profile
```http
GET /api/users/{userId}
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "user": {
    "_id": "user_123",
    "username": "john_doe",
    "email": "john@example.com",
    "createdAt": "2026-03-28T10:00:00Z"
  },
  "stats": {
    "postsCount": 15,
    "friendsCount": 42,
    "mutualFriendsCount": 8
  }
}
```

### Notifications APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications` | GET | Get user notifications |
| `/api/notifications` | PATCH | Mark notifications as read |

#### Get Notifications
```http
GET /api/notifications
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "notifications": [
    {
      "_id": "notif_123",
      "type": "like",
      "sender": { "_id": "user_456", "username": "alice" },
      "post": "post_789",
      "read": false,
      "createdAt": "2026-03-28T10:30:00Z"
    }
  ]
}
```

## 🔄 Socket.io Events

### Connection Flow
```
1. Browser connects to Socket.io (port 3001)
   ↓
2. Emit 'authenticate' event with userId
   ↓
3. Server stores userId → socketId mapping
   ↓
4. Stay connected for real-time updates
```

### Chat Events

#### join_chat (Client → Server)
Emitted when user opens a chat:
```javascript
socket.emit('join_chat', { 
  chatId: 'chat_123', 
  userId: 'user_456' 
});
```

#### leave_chat (Client → Server)
Emitted when user closes a chat:
```javascript
socket.emit('leave_chat', { 
  chatId: 'chat_123', 
  userId: 'user_456' 
});
```

#### message_sent (Client → Server)
Emitted when user sends a message:
```javascript
socket.emit('message_sent', {
  chatId: 'chat_123',
  message: {
    _id: 'msg_123',
    sender: { _id: 'user_456', username: 'alice' },
    content: 'Hello!',
    isEdited: false,
    isDeleted: false,
    readBy: [],
    createdAt: '2026-03-28T10:30:00Z'
  }
});
```

#### message_received (Server → Client)
Broadcast to all users in chat when message is sent:
```javascript
socket.on('message_received', (data) => {
  const { chatId, message } = data;
  // Add to messages array, UI updates in real-time
});
```

#### message_edited (Server → Client)
Broadcast when message is edited:
```javascript
socket.on('message_edited', (data) => {
  const { messageId, content, editedAt } = data;
  // Update message in UI
});
```

#### message_deleted (Server → Client)
Broadcast when message is deleted:
```javascript
socket.on('message_deleted', (data) => {
  const { messageId } = data;
  // Mark message as deleted in UI
});
```

#### user_typing (Client → Server)
Emit when user starts typing:
```javascript
socket.emit('user_typing', { 
  chatId: 'chat_123', 
  username: 'alice' 
});
```

#### user_typing (Server → Client)
Broadcast to other users in chat:
```javascript
socket.on('user_typing', (data) => {
  // Show "alice is typing..."
});
```

### User Status Events

#### authenticate (Client → Server)
Emit on connection to register user:
```javascript
socket.emit('authenticate', { userId: 'user_456' });
```

#### user_online (Server → Client)
Broadcast when user comes online:
```javascript
socket.on('user_online', (data) => {
  const { userId, username } = data;
  // Update online indicators
});
```

#### user_offline (Server → Client)
Broadcast when user goes offline:
```javascript
socket.on('user_offline', (data) => {
  const { userId, username } = data;
  // Update offline indicators
});
```

#### user_status_changed (Server → Client)
Broadcast real-time status updates:
```javascript
socket.on('user_status_changed', (data) => {
  const { userId, username, isOnline } = data;
  // Update presence in UI
});
```

### Post Events

#### new_post (Client → Server)
Emit when user creates a post:
```javascript
socket.emit('new_post', {
  post: {
    _id: 'post_123',
    author: { _id: 'user_456', username: 'alice' },
    content: 'My new post!',
    likes: [],
    createdAt: '2026-03-28T10:30:00Z'
  }
});
```

#### new_post (Server → Client)
Broadcast new post to all users:
```javascript
socket.on('new_post', (data) => {
  // Add post to feed in real-time
});
```

#### post_liked (Client → Server)
Emit when user likes a post:
```javascript
socket.emit('post_liked', {
  postId: 'post_123',
  postAuthorId: 'author_456',
  likerId: 'user_789',
  likerUsername: 'alice',
  liked: true,
  likesCount: 5
});
```

#### like_update (Server → Client)
Broadcast like updates:
```javascript
socket.on('like_update', (data) => {
  const { postId, likerId, liked, likesCount } = data;
  // Update like count on post
});
```

#### post_commented (Client → Server)
Emit when user comments on post:
```javascript
socket.emit('post_commented', {
  postId: 'post_123',
  postAuthorId: 'author_456',
  comment: {
    _id: 'comment_123',
    author: { _id: 'user_789', username: 'bob' },
    text: 'Great post!',
    createdAt: '2026-03-28T10:35:00Z'
  },
  commenterId: 'user_789'
});
```

#### new_comment (Server → Client)
Broadcast new comment:
```javascript
socket.on('new_comment', (data) => {
  const { postId, comment } = data;
  // Add comment to post in real-time
});
```

### Notification Events

#### notification (Server → Client)
Broadcast notifications:
```javascript
socket.on('notification', (data) => {
  const { type, sender, postId, createdAt } = data;
  // type: "like" | "comment" | "friend_request"
  // Add to notification center
});
```

## 📚 Database Models

### User Model
```typescript
{
  _id: ObjectId,
  username: String,
  email: String,
  password: String (hashed with bcrypt),
  createdAt: Date,
  updatedAt: Date
}
```

### Post Model
```typescript
{
  _id: ObjectId,
  content: String,
  author: ObjectId,          // Reference to User
  likes: [ObjectId],         // Array of User IDs
  createdAt: Date,
  updatedAt: Date,
  isDeleted: Boolean         // Soft delete
}
```

### Comment Model
```typescript
{
  _id: ObjectId,
  post: ObjectId,            // Reference to Post
  author: ObjectId,          // Reference to User
  text: String,
  createdAt: Date,
  updatedAt: Date,
  isDeleted: Boolean         // Soft delete
}
```

### Chat Model (✨ NEW)
```typescript
{
  _id: ObjectId,
  participants: [ObjectId],  // Array of User IDs
  name: String | null,       // null for DMs, name for group chats
  isGroup: Boolean,
  createdBy: ObjectId,       // Creator (null for DMs)
  lastMessage: ObjectId,     // Reference to Message
  lastMessageAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Message Model (✨ NEW)
```typescript
{
  _id: ObjectId,
  chat: ObjectId,            // Reference to Chat
  sender: ObjectId,          // Reference to User
  content: String,
  isEdited: Boolean,
  editedAt: Date,
  isDeleted: Boolean,        // Soft delete
  readBy: [
    {
      user: ObjectId,        // User who read
      readAt: Date           // When they read
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### Friendship Model (✨ NEW)
```typescript
{
  _id: ObjectId,
  requester: ObjectId,       // User who sent request (Reference to User)
  recipient: ObjectId,       // User who received request (Reference to User)
  status: 'pending' | 'accepted',
  acceptedAt: Date,         // When accepted
  createdAt: Date,
  updatedAt: Date
}
```

### Notification Model
```typescript
{
  _id: ObjectId,
  recipient: ObjectId,       // Who receives notification
  sender: ObjectId,          // Who triggered it
  type: 'like' | 'comment' | 'friend_request',
  post: ObjectId,
  read: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## 💬 Chat System

### Chat Types

1. **Direct Messages (DMs)**
   - Between 2 users only
   - Automatically created when needed
   - No custom name
   - One-to-one encrypted feel

2. **Group Chats**
   - 2+ participants
   - Custom name required
   - Creator is tracked
   - Can have multiple participants

### Message Features

| Feature | Description |
|---------|-------------|
| **Edit** | Edit sent messages (shows 📝 indicator) |
| **Delete** | Soft delete (shows [message deleted]) |
| **Read Receipts** | See who read with ✓✓ indicator |
| **Typing Indicator** | Show when others are typing |
| **Online Status** | 🟢 Online / ⚫ Offline indicators |
| **Timestamps** | Time or date on each message |

### Create Chat Flow

**From Friends Page:**
```
Click 💬 button on friend
  ↓
POST /api/chats { recipientId, isGroup: false }
  ↓
Created or fetched existing DM
  ↓
Navigate to /chats/[chatId]
  ↓
Full-screen chat page opens
  ↓
Socket.io join_chat emitted
  ↓
Real-time messages received
```

**From Chat Tab:**
```
Click "+ DM"
  ↓
Modal: Select friend
  ↓
POST /api/chats
  ↓
Navigate to /chats/[chatId]
  ↓
Chat opens with messaging
```

## 👥 Friend System

### Friend Request Workflow

```
1. Visit user profile: /profile/[userId]
2. Click "Send Friend Request"
3. Request sent to user
4. User receives notification
5. User visits /friends page
6. Sees pending request
7. Clicks "Accept" or "Reject"
8. If accepted → added as friend
9. Both can now create DMs
```

### Friends Page Features

- **Pending Requests** - Accept/Reject incoming requests
- **Friends List** - All accepted friends
- **Online Status** - Who's online (🟢) / offline (⚫)
- **Search** - Find friends by username
- **Chat Button** - Quick message friend (💬)
- **Unfriend** - Remove friend (✕)

## 👤 User Profiles

### Profile Page (`/profile/[userId]`)

Shows user information:
- Avatar and username
- Friend request button (if not friends)
- User statistics:
  - **Posts** - How many posts user created
  - **Friends** - Total friend count
  - **Mutual Friends** - Friends you both have
- Recent activity

### Profile Actions

- **Send Friend Request** - If not already friends
- **Accept/Reject** - Manage pending requests
- **View Posts** - See user's published posts
- **Visit Profile** - Click on post author names

## 🔐 Authentication & Security

### Password Security
- Passwords hashed with bcrypt (salt rounds: 10)
- Never sent or stored in plain text
- Minimum 6 characters recommended

### JWT Tokens
- Stored in HTTP-only cookies (secure)
- Not accessible via JavaScript
- Protects against XSS attacks
- Expires after 7 days
- Sent automatically with requests

### Protected Routes
- Middleware checks authentication on all pages
- Redirects to login if not authenticated
- API routes require valid JWT

## 🌙 Dark Mode

- **Auto-detection** - Follows system preferences
- **Manual toggle** - Can be toggled in navbar
- **Persistent** - Preference saved in settings
- **Smooth transition** - CSS transitions for comfort

## ✅ Recent Updates (March 28-29, 2026)

### New Features Added Today

#### 1. ✨ Full-Screen Chat Pages
- **New Path**: `/chats/[chatId]`
- Dedicated full-screen chat interface
- Better Socket.io connection stability
- Improved message rendering
- Online status updates in real-time

#### 2. 🔧 Fixed Socket.io Integration
- Fixed `user._id` vs `user.id` issues in useAuth()
- Added proper `join_chat` and `leave_chat` events
- Implemented duplicate message prevention
- Real-time room-based broadcasting works correctly

#### 3. 🎯 Message Differentiation
- Messages show on correct side (sender vs receiver)
- Blue bubbles for own messages (right side)
- Gray bubbles for received messages (left side)
- Sender name shown in group chats

#### 4. 🟢 Online Status Indicators
- Live online/offline dots
- Initialize with all participants online
- Real-time updates via Socket.io
- Shows in chat header and friends list

#### 5. 🔍 Fixed User ID Comparison
- Changed all `user?._id` to `user?.id` from useAuth()
- Fixed message sender comparison logic
- Fixed Socket.io event emissions
- All user comparisons now work correctly

#### 6. 🚫 Removed Modal Implementation
- Removed ChatModal from chat navigation
- Moved to full pages for better state management
- Improved navigation flow
- Better performance with page routing

## 🐛 Known Issues & Solutions

### Chat Messages Not Updating on 2nd Device
**Cause**: Not joining chat room
**Solution**: `join_chat` event emitted on chat open ✅

### Messages Showing Same Side
**Cause**: `user._id` vs `user.id` mismatch
**Solution**: Changed to `user?.id` from useAuth() ✅

### Online Status Not Updating
**Cause**: Empty online users Set on initialization
**Solution**: Initialize with all participants ✅

### Duplicate Messages in Chat
**Cause**: Both API response and Socket.io broadcast
**Solution**: Check if message exists before adding ✅

## 🛠️ Development

### Available Scripts

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start

# Socket.io server
npm run socket

# Lint
npm run lint
```

### Environment Variables

Create `.env.local` with:
```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_min_32_chars
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Deployment

### Vercel (Next.js)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy

### Socket.io Server

The Socket.io server needs to be deployed separately on a platform that supports long-running Node.js processes:

- [Railway](https://railway.app)
- [Render](https://render.com)
- [Fly.io](https://fly.io)
- [DigitalOcean](https://digitalocean.com)

Update `NEXT_PUBLIC_SOCKET_URL` to point to your deployed socket server.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues or questions:
1. Check the [known issues](#-known-issues--solutions) section
2. Review API documentation above
3. Check Socket.io events references
4. Open an issue with detailed description

## License

This project is licensed under the MIT License.

---

**Last Updated**: March 29, 2026  
**Version**: 2.0.0 (Chat System & Friend System Complete)  
**Status**: ✅ Production Ready

Built with ❤️ by Mynul Islam using Next.js 16, MongoDB, Socket.io, and TypeScript
