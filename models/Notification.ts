/**
 * Notification Model
 * -------------------
 * Handles real-time notifications for user interactions.
 * When someone likes or comments on a post, the post owner
 * receives a notification.
 * 
 * Fields:
 * - recipient: User who receives the notification (post owner)
 * - sender: User who triggered the notification (liker/commenter)
 * - type: Either 'like' or 'comment'
 * - post: The post that was interacted with
 * - read: Whether the user has seen this notification
 * - createdAt: When the notification was created
 * 
 * Note: We don't notify users about their own actions
 * (e.g., if you like your own post, no notification)
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// Type union for notification types - helps with TypeScript autocomplete
export type NotificationType = 'like' | 'comment';

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  type: NotificationType;
  post: mongoose.Types.ObjectId;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    // Who should see this notification
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Who triggered this notification
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // What kind of interaction happened
    type: {
      type: String,
      enum: ['like', 'comment'],  // Only allow these two values
      required: true,
    },
    // Which post was interacted with (for linking in the notification)
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    // Track if user has seen this notification
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for notification queries
 */
// Main query: "Get all notifications for user X, newest first"
NotificationSchema.index({ recipient: 1, createdAt: -1 });

// For counting unread notifications (the badge number)
NotificationSchema.index({ recipient: 1, read: 1 });

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
