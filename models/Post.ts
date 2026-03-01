/**
 * Post Model
 * -----------
 * Represents a text post in the social feed.
 * Posts are the core content of RealTimeHub - users create posts
 * that appear in the global feed.
 * 
 * Fields:
 * - content: The text content of the post (max 500 chars)
 * - author: Reference to the User who created the post
 * - likes: Array of User IDs who liked this post
 * - createdAt/updatedAt: Auto-generated timestamps
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// TypeScript interface for type safety
export interface IPost extends Document {
  _id: mongoose.Types.ObjectId;
  content: string;
  author: mongoose.Types.ObjectId;
  likes: mongoose.Types.ObjectId[];  // Array of user IDs who liked the post
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema: Schema = new Schema(
  {
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
      maxlength: [500, 'Post cannot exceed 500 characters'],
    },
    // Reference to the User model - allows us to use .populate('author')
    // to get full user details instead of just the ID
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',  // References the 'User' model
      required: true,
    },
    // Array of user references for the like system
    // We store user IDs to prevent duplicate likes and track who liked
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

/**
 * Database Indexes for Performance
 * ---------------------------------
 * Indexes speed up queries that filter/sort by these fields.
 * Without indexes, MongoDB scans every document (slow for large collections).
 */

// Index for feed query: get posts sorted by newest first
PostSchema.index({ createdAt: -1 });  // -1 = descending order

// Compound index for filtering posts by author AND sorting by date
// Useful for: "Show me all posts by user X, newest first"
PostSchema.index({ author: 1, createdAt: -1 });

// Prevent model recompilation in Next.js development
const Post: Model<IPost> = mongoose.models.Post || mongoose.model<IPost>('Post', PostSchema);

export default Post;
