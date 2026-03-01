/**
 * Comment Model
 * --------------
 * Represents a comment on a post.
 * Comments allow users to engage with posts beyond just liking.
 * 
 * Fields:
 * - post: Reference to the Post being commented on
 * - author: Reference to the User who wrote the comment
 * - text: The comment content (max 300 chars)
 * - createdAt: Auto-generated timestamp
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IComment extends Document {
  _id: mongoose.Types.ObjectId;
  post: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
}

const CommentSchema: Schema = new Schema(
  {
    // Which post this comment belongs to
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    // Who wrote this comment
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true,
      maxlength: [300, 'Comment cannot exceed 300 characters'],
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compound index for fetching comments on a specific post
 * Query pattern: "Get all comments for post X, sorted newest first"
 * The index makes this query fast even with millions of comments
 */
CommentSchema.index({ post: 1, createdAt: -1 });

const Comment: Model<IComment> = mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);

export default Comment;
