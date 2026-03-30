/**
 * Call Model
 * ==========
 * 
 * Represents a voice/video call between two users.
 * Stores call history, status, and metadata for 1-on-1 calls.
 * 
 * WebRTC Concept: Two browsers need to exchange connection info (offer/answer)
 * before establishing a direct peer-to-peer connection. This model tracks that flow.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// TypeScript interface for type safety
export interface ICall extends Document {
  _id: mongoose.Types.ObjectId;
  
  // Who initiated the call (the person making the call)
  caller: mongoose.Types.ObjectId;
  
  // Who receives the call (the person being called)
  receiver: mongoose.Types.ObjectId;
  
  // Current status: 'ringing' (caller waiting), 'active' (connected), 'ended' (finished)
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined';
  
  // Duration in seconds (only set when status is 'ended')
  duration: number | null;
  
  // Type of call: 'audio' only or 'video' call
  callType: 'audio' | 'video';
  
  // When the call started ringing (call initiated)
  startedAt: Date;
  
  // When both users actually connected (webRTC peer connected)
  connectedAt: Date | null;
  
  // When the call ended
  endedAt: Date | null;
  
  // Track timestamps
  createdAt: Date;
  updatedAt: Date;
}

const CallSchema: Schema = new Schema(
  {
    // User ID of who started the call
    caller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    // User ID of who is receiving the call
    receiver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    // Call status progression: ringing → active → ended
    // 'ringing': Caller waiting for receiver to answer
    // 'active': Both connected via WebRTC peer connection
    // 'ended': Call finished normally
    // 'missed': Receiver didn't answer within timeout
    // 'declined': Receiver explicitly rejected the call
    status: {
      type: String,
      enum: ['ringing', 'active', 'ended', 'missed', 'declined'],
      default: 'ringing',
      index: true,
    },
    
    // How many seconds the call lasted (calculated: endedAt - connectedAt)
    duration: {
      type: Number,
      default: null,
    },
    
    // Audio only or video call
    // Lets us know later if user enabled video during call
    callType: {
      type: String,
      enum: ['audio', 'video'],
      default: 'audio',
      required: true,
    },
    
    // Timestamp when call started (caller pressed "call" button)
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    
    // Timestamp when WebRTC peer actually connected (both users' streams ready)
    // null until they actually connect
    connectedAt: {
      type: Date,
      default: null,
    },
    
    // Timestamp when call ended
    // null until the call is actually finished
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Auto-adds createdAt and updatedAt
  }
);

// Create or retrieve the Call model
// (Next.js hot reload needs this pattern to avoid duplicate model errors)
const Call: Model<ICall> =
  mongoose.models.Call || mongoose.model<ICall>('Call', CallSchema);

export default Call;
