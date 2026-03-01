/**
 * PostCard Component
 * ==================
 * 
 * Displays a single post in the feed.
 * 
 * Features:
 * - Post content
 * - Author info
 * - Like button with optimistic updates
 * - Comment section
 * - Relative timestamps
 * 
 * Optimistic Updates:
 * -------------------
 * When user likes a post, we update the UI immediately
 * before the API response comes back. This makes the app
 * feel instant. If the API fails, we revert the change.
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { socketManager } from '@/lib/socket';
import CommentSection from './CommentSection';

// Post data type
export interface Post {
  _id: string;
  content: string;
  author: {
    _id: string;
    username: string;
  };
  likes: string[];
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  
  // Local state for optimistic updates
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [isLiking, setIsLiking] = useState(false);  // Prevent double-clicks

  // Initialize like state based on current user
  useEffect(() => {
    if (user) {
      setIsLiked(post.likes.includes(user.id));
    }
  }, [user, post.likes]);

  // Listen for real-time like updates
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket) return;

    const handleLikeUpdate = (data: { postId: string; likesCount: number; likerId: string; liked: boolean }) => {
      if (data.postId === post._id) {
        setLikesCount(data.likesCount);
        // Update our like state if we're the one who liked
        if (user && data.likerId === user.id) {
          setIsLiked(data.liked);
        }
      }
    };

    socket.on('like_update', handleLikeUpdate);
    return () => {
      socket.off('like_update', handleLikeUpdate);
    };
  }, [post._id, user]);

  // Listen for new comments
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket) return;

    const handleNewComment = (data: { postId: string }) => {
      if (data.postId === post._id) {
        setCommentsCount(prev => prev + 1);
      }
    };

    socket.on('new_comment', handleNewComment);
    return () => {
      socket.off('new_comment', handleNewComment);
    };
  }, [post._id]);

  /**
   * Handle Like Click
   * -----------------
   * Uses optimistic updates for instant feedback.
   */
  const handleLike = async () => {
    if (!user || isLiking) return;

    setIsLiking(true);
    
    // Optimistic update
    const wasLiked = isLiked;
    const prevCount = likesCount;
    
    setIsLiked(!wasLiked);
    setLikesCount(wasLiked ? prevCount - 1 : prevCount + 1);

    try {
      const response = await fetch(`/api/posts/${post._id}/like`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        // Emit socket event for real-time updates
        const socket = socketManager.getSocket();
        socket?.emit('post_liked', {
          postId: post._id,
          postAuthorId: post.author._id,
          likerId: user.id,
          likerUsername: user.username,
          liked: data.liked,
          likesCount: data.likesCount,
        });
      } else {
        // Revert on error
        setIsLiked(wasLiked);
        setLikesCount(prevCount);
        console.error('Like failed:', data.error);
      }
    } catch (error) {
      // Revert on network error
      setIsLiked(wasLiked);
      setLikesCount(prevCount);
      console.error('Like error:', error);
    } finally {
      setIsLiking(false);
    }
  };

  /**
   * Format Relative Time
   * --------------------
   * Converts timestamp to "2 hours ago" format.
   */
  const formatTime = (date: string) => {
    const now = new Date();
    const postDate = new Date(date);
    const diffMs = now.getTime() - postDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return postDate.toLocaleDateString();
  };

  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Post Header */}
      <div className="p-4 pb-0">
        <div className="flex items-center gap-3">
          {/* Author Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
            {post.author.username.charAt(0).toUpperCase()}
          </div>
          
          {/* Author Info */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {post.author.username}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatTime(post.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Post Content */}
      <div className="p-4">
        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
          {post.content}
        </p>
      </div>

      {/* Post Stats */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span>{likesCount} {likesCount === 1 ? 'like' : 'likes'}</span>
        <span>{commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}</span>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
        {/* Like Button */}
        <button
          onClick={handleLike}
          disabled={!user || isLiking}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium ${
            isLiked
              ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          } ${(!user || isLiking) ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={isLiked ? 'Unlike post' : 'Like post'}
        >
          {/* Heart Icon */}
          <svg
            className="w-5 h-5"
            fill={isLiked ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          Like
        </button>

        {/* Comment Button */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium"
        >
          {/* Comment Icon */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Comment
        </button>
      </div>

      {/* Comment Section */}
      {showComments && (
        <CommentSection
          postId={post._id}
          postAuthorId={post.author._id}
          onCommentAdded={() => setCommentsCount(prev => prev + 1)}
        />
      )}
    </article>
  );
}
