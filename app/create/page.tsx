/**
 * Create Post Page
 * ================
 * 
 * Path: /create
 * 
 * Allows users to create new text posts.
 * Protected route - requires authentication.
 * 
 * Features:
 * - Text area with character counter
 * - Real-time character count
 * - Submit with Enter (Cmd+Enter or Ctrl+Enter)
 * - Emits socket event for real-time feed updates
 * - Redirects to feed after posting
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { socketManager } from '@/lib/socket';

// Maximum characters allowed in a post
const MAX_CHARS = 500;

export default function CreatePostPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // Form state
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Character count
  const charCount = content.length;
  const charRemaining = MAX_CHARS - charCount;
  const isOverLimit = charCount > MAX_CHARS;
  const isEmpty = content.trim().length === 0;

  /**
   * Handle Content Change
   */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setError('');  // Clear error when user types
  };

  /**
   * Handle Keyboard Shortcuts
   * Cmd+Enter (Mac) or Ctrl+Enter (Windows) to submit
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  /**
   * Handle Form Submit
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (isEmpty) {
      setError('Please write something to post');
      return;
    }
    if (isOverLimit) {
      setError(`Post is too long. Maximum ${MAX_CHARS} characters allowed.`);
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        // Emit socket event for real-time feed updates
        const socket = socketManager.getSocket();
        socket?.emit('new_post', { post: data.post });

        // Redirect to feed
        router.push('/feed');
      } else {
        setError(data.error || 'Failed to create post');
      }
    } catch (err) {
      console.error('Create post error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  // Shouldn't happen due to middleware, but just in case
  if (!user) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Create Post
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Share your thoughts with the community
        </p>
      </div>

      {/* Create Post Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <form onSubmit={handleSubmit}>
          {/* User Avatar and Input */}
          <div className="p-4">
            <div className="flex gap-4">
              {/* User Avatar */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {user.username.charAt(0).toUpperCase()}
              </div>

              {/* Text Area */}
              <div className="flex-1">
                <textarea
                  value={content}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder="What's on your mind?"
                  rows={5}
                  className="w-full resize-none bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-lg focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-4 pb-2">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          {/* Footer with Counter and Submit */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            {/* Character Counter */}
            <div className="flex items-center gap-3">
              {/* Progress Ring */}
              <div className="relative w-8 h-8">
                <svg className="w-8 h-8 transform -rotate-90">
                  {/* Background circle */}
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-gray-200 dark:text-gray-600"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={`${Math.min(charCount / MAX_CHARS, 1) * 88} 88`}
                    className={`transition-all duration-150 ${
                      isOverLimit
                        ? 'text-red-500'
                        : charRemaining <= 20
                        ? 'text-yellow-500'
                        : 'text-blue-500'
                    }`}
                  />
                </svg>
              </div>

              {/* Character Count Text */}
              <span
                className={`text-sm font-medium ${
                  isOverLimit
                    ? 'text-red-500'
                    : charRemaining <= 20
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {charRemaining}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isEmpty || isOverLimit || isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="spinner w-4 h-4 border-white/30 border-t-white"></span>
                  Posting...
                </>
              ) : (
                'Post'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Tips */}
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        <p>
          💡 Tip: Press{' '}
          <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">
            ⌘ Enter
          </kbd>{' '}
          or{' '}
          <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">
            Ctrl Enter
          </kbd>{' '}
          to post
        </p>
      </div>
    </div>
  );
}
