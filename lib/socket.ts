/**
 * Socket.io Client Utility
 * ========================
 * 
 * Manages the Socket.io client connection for real-time features.
 * 
 * How Real-Time Works in RealTimeHub:
 * -----------------------------------
 * 1. User logs in → Frontend connects to Socket.io server
 * 2. Server maps userId to socketId (knows which socket = which user)
 * 3. When someone likes/comments → Server emits event to specific user
 * 4. Frontend receives event → Updates UI instantly (no refresh!)
 * 
 * Socket Events:
 * --------------
 * Emitted by Server:
 * - 'new_post': When any user creates a post (broadcast to all)
 * - 'post_liked': When your post gets liked (sent to post owner)
 * - 'post_commented': When your post gets a comment (sent to post owner)
 * - 'notification': Generic notification event
 * 
 * Emitted by Client:
 * - 'authenticate': Send userId to server after connecting
 * 
 * Singleton Pattern:
 * ------------------
 * We use a singleton to ensure only one socket connection exists.
 * Multiple connections would cause duplicate events and waste resources.
 */

'use client';

import { io, Socket } from 'socket.io-client';

// Types for socket events
export interface NewPostEvent {
  post: {
    _id: string;
    content: string;
    author: {
      _id: string;
      username: string;
    };
    likes: string[];
    createdAt: string;
  };
}

export interface PostLikedEvent {
  postId: string;
  likerId: string;
  likerUsername: string;
  totalLikes: number;
}

export interface PostCommentedEvent {
  postId: string;
  comment: {
    _id: string;
    text: string;
    author: {
      _id: string;
      username: string;
    };
    createdAt: string;
  };
}

export interface NotificationEvent {
  _id: string;
  type: 'like' | 'comment';
  sender: {
    _id: string;
    username: string;
  };
  post: string;
  read: boolean;
  createdAt: string;
}

/**
 * Socket Manager Class
 * --------------------
 * Handles socket connection lifecycle and provides methods
 * for connecting, disconnecting, and listening to events.
 */
class SocketManager {
  private socket: Socket | null = null;
  private userId: string | null = null;

  /**
   * Get the socket URL from environment or use default
   * In development, this points to our custom server
   */
  private getSocketUrl(): string {
    return process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
  }

  /**
   * Connect to Socket.io Server
   * 
   * @param userId - The current user's ID for authentication
   * @returns The socket instance
   * 
   * What happens:
   * 1. Creates new socket connection (or returns existing)
   * 2. Sends 'authenticate' event with userId
   * 3. Server maps this socket to the user
   */
  connect(userId: string): Socket {
    // Reuse existing connection for same user
    if (this.socket && this.userId === userId) {
      return this.socket;
    }

    // Disconnect existing connection if different user
    if (this.socket) {
      this.disconnect();
    }

    // Create new connection
    this.socket = io(this.getSocketUrl(), {
      // Reconnection settings
      reconnection: true,          // Auto-reconnect on disconnect
      reconnectionAttempts: 5,     // Try 5 times before giving up
      reconnectionDelay: 1000,     // Wait 1 second between attempts
      
      // Transport settings
      transports: ['websocket', 'polling'],  // Prefer WebSocket, fall back to polling
    });

    this.userId = userId;

    // Send authentication after connecting
    this.socket.on('connect', () => {
      console.log('🔌 Socket connected:', this.socket?.id);
      // Tell the server who we are
      this.socket?.emit('authenticate', { userId });
    });

    // Log disconnections for debugging
    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    // Log connection errors
    this.socket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error.message);
    });

    return this.socket;
  }

  /**
   * Disconnect from Socket.io Server
   * 
   * Call this when:
   * - User logs out
   * - Component unmounts (cleanup)
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
      console.log('🔌 Socket disconnected by client');
    }
  }

  /**
   * Get Current Socket Instance
   * 
   * @returns The socket instance or null if not connected
   * 
   * Use this to add event listeners:
   * const socket = socketManager.getSocket();
   * socket?.on('new_post', handleNewPost);
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Check if Connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Export a singleton instance
// This ensures all components use the same socket connection
export const socketManager = new SocketManager();

/**
 * Custom Hook Helper
 * ------------------
 * Creates typed event listener that auto-cleans up
 * 
 * Usage in React component:
 * useEffect(() => {
 *   return onSocketEvent('new_post', (data) => {
 *     // handle new post
 *   });
 * }, []);
 */
export function onSocketEvent<T>(
  event: string,
  callback: (data: T) => void
): () => void {
  const socket = socketManager.getSocket();
  
  if (socket) {
    socket.on(event, callback);
    
    // Return cleanup function
    return () => {
      socket.off(event, callback);
    };
  }
  
  // Return no-op cleanup if no socket
  return () => {};
}
