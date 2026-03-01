# RealTimeHub

A real-time social media application with live updates, built with modern web technologies.

![RealTimeHub](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![MongoDB](https://img.shields.io/badge/MongoDB-green?logo=mongodb)
![Socket.io](https://img.shields.io/badge/Socket.io-black?logo=socket.io)
![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript)

## Features

- **Real-time Feed**: See new posts instantly without refreshing
- **User Authentication**: Secure JWT-based auth with HTTP-only cookies
- **Like & Comment**: Interact with posts in real-time
- **Notifications**: Get instant notifications when someone likes or comments on your posts
- **Responsive Design**: Works great on desktop and mobile
- **Dark Mode Support**: Automatic dark mode based on system preferences

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router) |
| Backend | Next.js API Routes |
| Database | MongoDB + Mongoose |
| Real-time | Socket.io |
| Authentication | JWT + HTTP-only cookies |
| Styling | Tailwind CSS |
| Validation | Zod |

## Project Structure

```
realtimehub/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── posts/         # Post CRUD & interactions
│   │   └── notifications/ # Notification endpoints
│   ├── feed/              # Main feed page
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   └── create/            # Create post page
├── components/            # Reusable React components
├── contexts/              # React contexts (AuthContext)
├── lib/                   # Utility functions
│   ├── db.ts             # MongoDB connection
│   ├── auth.ts           # JWT utilities
│   ├── validators.ts     # Zod schemas
│   └── socket.ts         # Socket.io client
├── models/                # Mongoose models
│   ├── User.ts
│   ├── Post.ts
│   ├── Comment.ts
│   └── Notification.ts
├── server.js              # Socket.io server
└── middleware.ts          # Route protection
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- MongoDB database (local or [MongoDB Atlas](https://cloud.mongodb.com) - free tier available)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd realtimehub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy the example file and update with your values:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local`:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/realtimehub
   JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
   NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Start the development servers**

   You need to run two servers: Next.js and Socket.io

   **Terminal 1 - Next.js:**
   ```bash
   npm run dev
   ```

   **Terminal 2 - Socket.io:**
   ```bash
   npm run socket
   ```

   Or install `concurrently` and run both:
   ```bash
   npm install -D concurrently
   npm run dev:all
   ```

5. **Open the app**
   
   Visit [http://localhost:3000](http://localhost:3000)

## API Documentation

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Create new account |
| `/api/auth/login` | POST | Login to account |
| `/api/auth/logout` | POST | Logout (clear cookie) |
| `/api/auth/me` | GET | Get current user |

#### Signup Request
```json
{
  "username": "sakil",
  "email": "sakil@email.com",
  "password": "123456"
}
```

#### Login Request
```json
{
  "email": "sakil@email.com",
  "password": "123456"
}
```

### Posts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/posts` | GET | Get paginated posts |
| `/api/posts` | POST | Create new post |
| `/api/posts/:id/like` | POST | Toggle like on post |
| `/api/posts/:id/comments` | GET | Get post comments |
| `/api/posts/:id/comments` | POST | Add comment |

#### Get Posts Query Parameters
- `page` - Page number (default: 1)
- `limit` - Posts per page (default: 10, max: 50)
- `user` - Filter by username

#### Create Post Request
```json
{
  "content": "Hello RealTimeHub! 🚀"
}
```

#### Add Comment Request
```json
{
  "text": "Great post!"
}
```

### Notifications

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications` | GET | Get user notifications |
| `/api/notifications` | PATCH | Mark notifications as read |

## Socket.io Events

### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `authenticate` | `{ userId }` | Register socket with user ID |
| `new_post` | `{ post }` | Broadcast new post |
| `post_liked` | `{ postId, postAuthorId, likerId, likerUsername, liked, likesCount }` | Handle post like |
| `post_commented` | `{ postId, postAuthorId, comment, commenterId }` | Handle new comment |

### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `new_post` | `{ post }` | New post created |
| `like_update` | `{ postId, likerId, liked, likesCount }` | Post like changed |
| `new_comment` | `{ postId, comment }` | New comment added |
| `notification` | `{ type, sender, postId, createdAt }` | New notification |

## Database Schemas

### User
```javascript
{
  username: String,     // Unique, 3-30 chars
  email: String,        // Unique, lowercase
  password: String,     // Hashed with bcrypt
  createdAt: Date
}
```

### Post
```javascript
{
  content: String,      // Max 500 chars
  author: ObjectId,     // Reference to User
  likes: [ObjectId],    // Array of User IDs
  createdAt: Date
}
```

### Comment
```javascript
{
  post: ObjectId,       // Reference to Post
  author: ObjectId,     // Reference to User
  text: String,         // Max 300 chars
  createdAt: Date
}
```

### Notification
```javascript
{
  recipient: ObjectId,  // Who receives
  sender: ObjectId,     // Who triggered
  type: "like" | "comment",
  post: ObjectId,
  read: Boolean,
  createdAt: Date
}
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

## License

This project is licensed under the MIT License.

---

Built with ❤️ using Next.js, MongoDB, and Socket.io
