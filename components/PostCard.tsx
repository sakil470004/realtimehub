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
 * - Edit/Delete (for post author only)
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
import Link from 'next/link';

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
  onPostUpdated?: (updatedPost: Post) => void;
  onPostDeleted?: (postId: string) => void;
}

export default function PostCard({ post, onPostUpdated, onPostDeleted }: PostCardProps) {
  const { user } = useAuth();
  
  // Local state for optimistic updates
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [isLiking, setIsLiking] = useState(false);  // Prevent double-clicks

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Post content state (for real-time updates)
  const [currentContent, setCurrentContent] = useState(post.content);

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

  // Listen for post edit updates
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket) return;

    const handlePostUpdated = (data: { postId: string; content: string }) => {
      if (data.postId === post._id) {
        setCurrentContent(data.content);
        setEditedContent(data.content);
      }
    };

    socket.on('post_updated', handlePostUpdated);
    return () => {
      socket.off('post_updated', handlePostUpdated);
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

  /**
   * Handle Edit Post
   * ----------------
   * Updates post content and emits socket event for real-time updates.
   */
  const handleEditPost = async () => {
    if (!editedContent.trim()) {
      setEditError('Post content cannot be empty');
      return;
    }

    if (editedContent.length > 500) {
      setEditError('Post cannot exceed 500 characters');
      return;
    }

    setIsEditing(true);
    setEditError('');

    try {
      const response = await fetch(`/api/posts/${post._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: editedContent }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update local state
        setCurrentContent(editedContent);
        setShowEditModal(false);

        // Emit socket event for real-time updates
        const socket = socketManager.getSocket();
        socket?.emit('post_edited', {
          postId: post._id,
          content: editedContent,
        });

        // Call callback if provided
        if (onPostUpdated) {
          onPostUpdated({ ...post, content: editedContent });
        }
      } else {
        setEditError(data.error || 'Failed to update post');
      }
    } catch (error) {
      console.error('Edit post error:', error);
      setEditError('Failed to update post');
    } finally {
      setIsEditing(false);
    }
  };

  /**
   * Check if current user is the post author
   */
  const isPostAuthor = user && user.id === post.author._id;

  /**
   * Handle Delete Post
   * ------------------
   * Deletes the post after confirmation.
   * Removes post from feed and emits socket event for real-time deletion.
   */
  const handleDeletePost = async () => {
    setIsDeleting(true);
    setDeleteError('');

    try {
      const response = await fetch(`/api/posts/${post._id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        // Emit socket event for real-time deletion
        const socket = socketManager.getSocket();
        socket?.emit('post_deleted', {
          postId: post._id,
        });

        // Call callback to remove post from feed
        if (onPostDeleted) {
          onPostDeleted(post._id);
        }

        setShowDeleteConfirm(false);
      } else {
        setDeleteError(data.error || 'Failed to delete post');
      }
    } catch (error) {
      console.error('Delete post error:', error);
      setDeleteError('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Post Header */}
      <div className="p-4 pb-0">
        <div className="flex items-center justify-between gap-3">
          {/* ========== AUTHOR INFO - CLICKABLE ========== */}
          <Link
            href={`/profile/${post.author._id}`}
            className="flex items-center gap-3 hover:opacity-80 transition"
          >
            {/* Author Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
              {post.author.username.charAt(0).toUpperCase()}
            </div>
            
            {/* Author Info */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition">
                {post.author.username}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatTime(post.createdAt)}
              </p>
            </div>
          </Link>

          {/* Menu Button (Edit/Delete) - Only for post author */}
          {isPostAuthor && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                aria-label="Post menu"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 overflow-hidden">
                  <button
                    onClick={() => {
                      setShowEditModal(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                  >
                    ✏️ Edit Post
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    🗑️ Delete Post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Content */}
      <div className="p-4">
        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
          {currentContent}
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

      {/* Edit Post Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Edit Post
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditError('');
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {/* Error Message */}
              {editError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-600 dark:text-red-400 text-sm">{editError}</p>
                </div>
              )}

              {/* Content Textarea */}
              <textarea
                value={editedContent}
                onChange={(e) => {
                  setEditedContent(e.target.value);
                  setEditError('');
                }}
                placeholder="What's on your mind?"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={6}
              />

              {/* Character Count */}
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {editedContent.length} / 500 characters
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditError('');
                  setEditedContent(currentContent);
                }}
                disabled={isEditing}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditPost}
                disabled={isEditing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isEditing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-sm w-full">
            {/* Dialog Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Delete Post?
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                This action cannot be undone. All comments and notifications will be deleted as well.
              </p>
            </div>

            {/* Error Message */}
            {deleteError && (
              <div className="mx-6 mt-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm">{deleteError}</p>
              </div>
            )}

            {/* Dialog Footer */}
            <div className="p-6 flex gap-3 justify-end border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError('');
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePost}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2 font-medium"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
