/**
 * Message Model
 * =============
 * 
 * Represents a single message in a chat conversation.
 * 
 * Features:
 * - Text content with edit history
 * - Read receipts per user
 * - Soft delete (mark as deleted, don't remove from DB)
 * - Metadata: sender, chat, timestamps
 * 
 * Why soft delete?
 * - Other users might have already read/referenced this message
 * - Deleting breaks the timeline
 * - Better to show "[message deleted]" placeholder
 * - Keeps message ID consistent
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// TypeScript interface for type safety
export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  
  // Which chat this message belongs to
  chat: mongoose.Types.ObjectId;
  
  // Who sent the message
  sender: mongoose.Types.ObjectId;
  
  // The actual message content
  content: string;
  
  // Track if message was edited and when
  isEdited: boolean;
  editedAt?: Date;
  
  // Soft delete flag (message is "deleted" but data remains)
  isDeleted: boolean;
  
  // Array of users who have read this message
  // Each entry: { userId, readAt }
  readBy: Array<{
    user: mongoose.Types.ObjectId;
    readAt: Date;
  }>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema: Schema = new Schema(
  {
    // Which conversation this message belongs to
    chat: {
      type: Schema.Types.ObjectId,
      required: [true, 'Chat reference is required'],
      // If chat is deleted, consider deleting messages too
      index: true,
    },
    
    // Who sent this message
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required'],
      index: true,
    },
    
    // The message text
    content: {
      type: String,
      required: [true, 'Message content is required'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
      trim: true,
    },
    
    // Track edits for transparency
    // True if message has been edited at least once
    isEdited: {
      type: Boolean,
      default: false,
    },
    
    // When the message was last edited
    // Null if never edited
    editedAt: {
      type: Date,
      default: null,
    },
    
    // Soft delete: message is "deleted" but data remains
    // We show "[message deleted]" instead of the content
    isDeleted: {
      type: Boolean,
      default: false,
    },
    
    // Read receipts: track which users have read this message
    // Example: [
    //   { user: userId1, readAt: 2024-03-28T10:30:00Z },
    //   { user: userId2, readAt: 2024-03-28T10:31:00Z }
    // ]
    readBy: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        // When this user read the message
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt
  }
);

/**
 * Database Indexes
 * ----------------
 * Optimize query performance
 */

// Find all messages in a conversation, sorted by newest first
// Query: "Show me all messages in this chat"
// This is the most common query for message loading
MessageSchema.index({ chat: 1, createdAt: -1 });

// Find all messages from a specific user in a chat
// Query: "Show all of user X's messages in this chat"
MessageSchema.index({ chat: 1, sender: 1 });

// Find unread messages for a user
// Query: "Show me messages I haven't read yet"
// Using a sparse index for better performance (only indexes docs where readBy array doesn't contain this user)
MessageSchema.index({ chat: 1, 'readBy.user': 1 });

/**
 * Virtual Field: Message Status
 * ------------------------------
 * Derive read status from the readBy array
 * Example: "3 people have read this"
 */
MessageSchema.virtual('readCount').get(function (this: any) {
  return this.readBy ? this.readBy.length : 0;
});

/**
 * Method: Mark Message as Read
 * ----------------------------
 * Add a user to the readBy array
 * Prevents duplicates
 */
MessageSchema.methods.markAsRead = function (userId: string) {
  // Check if already read by this user
  const alreadyRead = this.readBy?.some(
    (r: { user: mongoose.Types.ObjectId }) => r.user.toString() === userId
  );
  
  // If not already read, add it
  if (!alreadyRead) {
    if (!this.readBy) {
      this.readBy = [];
    }
    this.readBy.push({
      user: new mongoose.Types.ObjectId(userId),
      readAt: new Date(),
    });
  }
};

/**
 * Method: Check if User Has Read
 * --------------------------------
 * Returns true if user is in readBy array
 */
MessageSchema.methods.hasUserRead = function (userId: string): boolean {
  return this.readBy?.some(
    (r: { user: mongoose.Types.ObjectId }) => r.user.toString() === userId
  ) || false;
};

// Prevent model recompilation in Next.js development
const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);

export default Message;
