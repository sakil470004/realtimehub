/**
 * Chat Model
 * ==========
 * 
 * Represents a conversation (either direct message or group chat).
 * 
 * Design:
 * - Every direct message creates a Chat document with 2 participants
 * - Group chats can have multiple participants
 * - Messages are stored separately in Message model
 * - Chat document tracks metadata (name, participants, last message)
 * 
 * Why separate?
 * - Scalability: Messages can be huge, better to separate
 * - Query efficiency: Find chats quickly without loading all messages
 * - Easier pagination of messages
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// TypeScript interface for type safety
export interface IChat extends Document {
  _id: mongoose.Types.ObjectId;
  
  // Array of user IDs in this chat
  participants: mongoose.Types.ObjectId[];
  
  // For group chats: custom name like "Team Project"
  // For DMs: null (we can derive name from participants)
  name: string | null;
  
  // Is this a group chat or direct message?
  isGroup: boolean;
  
  // If group chat, who created it
  createdBy: mongoose.Types.ObjectId | null;
  
  // ID of the last message (for quick access without querying Messages)
  lastMessage: mongoose.Types.ObjectId | null;
  
  // Timestamp of the last message (for sorting conversations)
  lastMessageAt: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema: Schema = new Schema(
  {
    // Array of users in this conversation
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    
    // Group chat name like "Project Team" or "Friends"
    // Null for direct messages (DM)
    name: {
      type: String,
      default: null,
      trim: true,
      maxlength: [50, 'Chat name cannot exceed 50 characters'],
    },
    
    // Is this a group chat or one-on-one?
    // true = group chat (3+ participants possible)
    // false = direct message between 2 users
    isGroup: {
      type: Boolean,
      default: false,
      required: true,
    },
    
    // For group chats: who created it
    // For DMs: null
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    
    // Reference to the most recent message
    // Allows quick access to last message content/time
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    
    // Timestamp of the last message
    // Used for sorting chats: "most recent conversations first"
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Database Indexes
 * ----------------
 * Optimize common queries
 */

// Find all chats for a specific user
// Query: "Show me all my conversations"
ChatSchema.index({ participants: 1, lastMessageAt: -1 });

// Find direct message between two specific users
// Query: "Is there already a DM between user A and B?"
// This prevents creating duplicate DM chats
ChatSchema.index({ participants: 1, isGroup: 1 });

// Find group chats created by a user
ChatSchema.index({ createdBy: 1, isGroup: 1 });

// Prevent model recompilation in Next.js development
const Chat: Model<IChat> =
  mongoose.models.Chat || mongoose.model<IChat>('Chat', ChatSchema);

export default Chat;
