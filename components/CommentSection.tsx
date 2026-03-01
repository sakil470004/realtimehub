/**
 * CommentSection Component
 * ========================
 * 
 * Displays and manages comments for a post.
 * 
 * Features:
 * - List of existing comments
 * - Add new comment form
 * - Real-time updates via Socket.io
 * - Loading states
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { socketManager } from '@/lib/socket';

// Comment data type
interface Comment {
  _id: string;
  text: string;
  author: {
    _id: string;
    username: string;
  };
  createdAt: string;
}

interface CommentSectionProps {
  postId: string;
  postAuthorId: string;
  onCommentAdded: () => void;
}

export default function CommentSection({ postId, postAuthorId, onCommentAdded }: CommentSectionProps) {
  const { user } = useAuth();
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  /**
   * Fetch Comments
   * --------------
   * Loads existing comments when component mounts.
   */
  useEffect(() => {
    const fetchComments = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/posts/${postId}/comments`);
        
        if (response.ok) {
          const data = await response.json();
          setComments(data.comments);
        } else {
          setError('Failed to load comments');
        }
      } catch (err) {
        console.error('Fetch comments error:', err);
        setError('Failed to load comments');
      } finally {
        setIsLoading(false);
      }
    };

    fetchComments();
  }, [postId]);

  /**
   * Real-time Comment Updates
   * -------------------------
   * Listen for new comments on this post.
   */
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket) return;

    const handleNewComment = (data: { postId: string; comment: Comment }) => {
      if (data.postId === postId) {
        // Add new comment to the top of the list
        // Avoid duplicates (in case we added it ourselves)
        setComments(prev => {
          const exists = prev.some(c => c._id === data.comment._id);
          if (exists) return prev;
          return [data.comment, ...prev];
        });
      }
    };

    socket.on('new_comment', handleNewComment);
    return () => {
      socket.off('new_comment', handleNewComment);
    };
  }, [postId]);

  /**
   * Handle Submit Comment
   * ---------------------
   * Sends new comment to API and emits socket event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newComment.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        // Add comment to local state
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
        onCommentAdded();

        // Emit socket event for real-time updates
        const socket = socketManager.getSocket();
        socket?.emit('post_commented', {
          postId,
          postAuthorId,
          comment: data.comment,
          commenterId: user.id,
        });
      } else {
        setError(data.error || 'Failed to add comment');
      }
    } catch (err) {
      console.error('Submit comment error:', err);
      setError('Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Format Relative Time
   */
  const formatTime = (date: string) => {
    const now = new Date();
    const commentDate = new Date(date);
    const diffMs = now.getTime() - commentDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return commentDate.toLocaleDateString();
  };

  return (
    <div className="border-t border-gray-100 dark:border-gray-700">
      {/* Comment Form */}
      {user ? (
        <form onSubmit={handleSubmit} className="p-4">
          <div className="flex gap-3">
            {/* User Avatar */}
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
              {user.username.charAt(0).toUpperCase()}
            </div>
            
            {/* Input Field */}
            <div className="flex-1">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                maxLength={300}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              {/* Error message */}
              {error && (
                <p className="text-red-500 text-sm mt-1">{error}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              {isSubmitting ? '...' : 'Post'}
            </button>
          </div>
        </form>
      ) : (
        <p className="p-4 text-center text-gray-500 dark:text-gray-400">
          Please login to comment
        </p>
      )}

      {/* Comments List */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          // Loading skeleton
          <div className="p-4 space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="p-4 text-center text-gray-500 dark:text-gray-400">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {comments.map((comment) => (
              <div key={comment._id} className="p-4 flex gap-3">
                {/* Comment Author Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  {comment.author.username.charAt(0).toUpperCase()}
                </div>
                
                {/* Comment Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {comment.author.username}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-gray-800 dark:text-gray-200 mt-1 break-words">
                    {comment.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
