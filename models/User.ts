/**
 * User Model
 * -----------
 * Represents a user in the RealTimeHub application.
 * Users can create posts, like posts, comment, and receive notifications.
 * 
 * Fields:
 * - username: Unique identifier chosen by user (3-30 chars)
 * - email: Unique email address for login
 * - password: Hashed password (bcrypt) - never store plain text!
 * - createdAt: Auto-generated timestamp
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// TypeScript interface for type safety when working with User documents
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  password: string;
  createdAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,  // Creates a unique index in MongoDB
      trim: true,    // Removes whitespace from both ends
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,  // Converts email to lowercase before saving
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],  // Basic email regex validation
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      // Note: Password is hashed in the API route before saving, not here
    },
  },
  {
    timestamps: true,  // Automatically adds createdAt and updatedAt fields
  }
);

/**
 * Prevent model recompilation error in Next.js development
 * In development, Next.js clears the module cache on every request,
 * which can cause mongoose to try to recompile the model.
 * This check prevents that by reusing the existing model if it exists.
 */
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
