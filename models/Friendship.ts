/**
 * Friend Model
 * =============
 * 
 * Manages friend relationships between users.
 * Uses a Friendship document to track:
 * - Who requested (requester)
 * - Who received (recipient)
 * - Status (pending, accepted)
 * - Timestamps
 * 
 * Why separate from User?
 * - Enables complex queries like: "Show all users who have accepted this user as a friend"
 * - Tracks direction of friendship (A→B is different from B→A)
 * - Maintains request history
 * - Better performance than arrays in User model
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// TypeScript interface for type safety
export interface IFriendship extends Document {
  _id: mongoose.Types.ObjectId;
  
  // The user who sent the friend request
  requester: mongoose.Types.ObjectId;
  
  // The user who received the friend request
  recipient: mongoose.Types.ObjectId;
  
  // Status: 'pending' = waiting for recipient's response
  //         'accepted' = both users are friends
  status: 'pending' | 'accepted';
  
  // Timestamps for tracking
  createdAt: Date;
  updatedAt: Date;
}

const FriendshipSchema: Schema = new Schema(
  {
    // Reference to the user who initiated the friendship
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester is required'],
    },
    
    // Reference to the user who will receive/accept the friendship
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required'],
    },
    
    // Track the state of the friendship
    // pending = request sent, awaiting response
    // accepted = both users are friends and can chat
    status: {
      type: String,
      enum: ['pending', 'accepted'],
      default: 'pending',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Database Indexes for Performance
 * ---------------------------------
 * These speed up common queries:
 * 1. Find pending requests for a user
 * 2. Check if two users are friends
 * 3. Get all friends of a user
 */

// Find all pending requests sent TO a user (recipient field)
// Query: "Show me all friend requests I've received"
FriendshipSchema.index({ recipient: 1, status: 1 });

// Find all pending requests sent BY a user (requester field)
// Query: "Show me pending friend requests I sent"
FriendshipSchema.index({ requester: 1, status: 1 });

// Compound index: Find friendship between two specific users
// Query: "Are these two users friends?"
// This makes it fast to check before allowing chat
FriendshipSchema.index({ requester: 1, recipient: 1 });

// Index for finding all friends (regardless of who requested)
// Note: We'll query both directions in code
FriendshipSchema.index({ status: 1 });

/**
 * Unique constraint: Prevent duplicate friendship documents
 * When status is 'accepted', only one document should exist between two users
 * 
 * This prevents:
 * - User A sends request to B, then B sends request to A creating duplicates
 * - The same friendship being created twice
 */
FriendshipSchema.index(
  { requester: 1, recipient: 1 },
  { unique: true } // This ensures only ONE friendship document per pair
);

// Prevent model recompilation in Next.js development
const Friendship: Model<IFriendship> =
  mongoose.models.Friendship || mongoose.model<IFriendship>('Friendship', FriendshipSchema);

export default Friendship;
