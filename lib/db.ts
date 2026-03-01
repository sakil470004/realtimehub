/**
 * Database Connection Utility
 * ===========================
 * 
 * This file handles the MongoDB connection using Mongoose.
 * 
 * Why we need this pattern:
 * -------------------------
 * In Next.js, especially during development with hot reload,
 * the code gets re-executed multiple times. Without caching,
 * we'd create multiple database connections, eventually hitting
 * MongoDB's connection limit.
 * 
 * The Solution:
 * -------------
 * We cache the connection promise in a global variable that
 * persists across hot reloads. This ensures we reuse the same
 * connection instead of creating new ones.
 * 
 * Usage:
 * ------
 * import connectDB from '@/lib/db';
 * 
 * // In any API route:
 * await connectDB();
 * // Now you can use mongoose models...
 */

import mongoose from 'mongoose';

// Get MongoDB connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

// Type for the cached connection
interface MongooseCache {
  conn: mongoose.Mongoose | null;
  promise: Promise<mongoose.Mongoose> | null;
}

// TypeScript declaration for caching on global object
declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

// Initialize the cache object if it doesn't exist
// This persists across hot reloads in development
const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * Connect to MongoDB
 * 
 * @returns {Promise<mongoose.Mongoose>} The mongoose connection
 * @throws {Error} If MONGODB_URI is not defined in environment
 * 
 * This function:
 * 1. Checks if we have a cached connection → return it
 * 2. Checks if connection is in progress → wait for it
 * 3. Otherwise, creates a new connection and caches it
 */
async function connectDB(): Promise<mongoose.Mongoose> {
  // Validate environment variable exists
  if (!MONGODB_URI) {
    throw new Error(
      'Please define the MONGODB_URI environment variable inside .env.local\n' +
      'Example: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/realtimehub'
    );
  }

  // Return cached connection if available
  if (cached.conn) {
    return cached.conn;
  }

  // If no connection promise exists, create one
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,  // Disable command buffering for better error handling
    };

    // Create the connection promise and cache it
    // This prevents multiple simultaneous connection attempts
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ MongoDB connected successfully');
      return mongoose;
    });
  }

  // Wait for the connection and cache it
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    // If connection fails, clear the promise so we can retry
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
