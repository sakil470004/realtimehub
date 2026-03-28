/**
 * Feed Page
 * =========
 * 
 * Path: /feed
 * 
 * The main feed displaying all posts in reverse chronological order.
 * Protected route - requires authentication.
 * 
 * Features:
 * - Paginated post feed
 * - Real-time new post updates
 * - Filter by username
 * - Infinite scroll (loads more on scroll)
 * - Loading states
 * - Empty state
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { socketManager } from '@/lib/socket';
import PostCard, { Post } from '@/components/PostCard';

// Separate component that uses useSearchParams
function FeedContent() {
  const { user, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const filterUser = searchParams.get('user');

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  /**
   * Fetch Posts
   * -----------
   * Loads posts from the API with pagination.
   */
  const fetchPosts = useCallback(async (pageNum: number, append: boolean = false) => {
    if (pageNum === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError('');

    try {
      // Build URL with query params
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '10',
      });
      
      if (filterUser) {
        params.set('user', filterUser);
      }

      const response = await fetch(`/api/posts?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (append) {
          // Append to existing posts (infinite scroll)
          setPosts(prev => [...prev, ...data.posts]);
        } else {
          // Replace posts (initial load or filter change)
          setPosts(data.posts);
        }
        
        setHasMore(data.pagination.hasMore);
      } else {
        setError('Failed to load posts');
      }
    } catch (err) {
      console.error('Fetch posts error:', err);
      setError('Failed to load posts');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [filterUser]);

  // Initial fetch when component mounts or filter changes
  useEffect(() => {
    setPage(1);
    fetchPosts(1);
  }, [fetchPosts]);

  /**
   * Real-time New Posts
   * -------------------
   * Listen for new posts via Socket.io.
   */
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket) return;

    const handleNewPost = (data: { post: Post }) => {
      // Only add if not filtering or matches filter
      if (!filterUser || data.post.author.username === filterUser) {
        // Add to top of feed
        setPosts(prev => {
          // Avoid duplicates
          const exists = prev.some(p => p._id === data.post._id);
          if (exists) return prev;
          return [data.post, ...prev];
        });
      }
    };

    socket.on('new_post', handleNewPost);
    return () => {
      socket.off('new_post', handleNewPost);
    };
  }, [filterUser]);

  /**
   * Real-time Post Deletion
   * -----------------------
   * Listen for deleted posts via Socket.io.
   */
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket) return;

    const handlePostDeleted = (data: { postId: string }) => {
      // Remove deleted post from feed
      setPosts(prev => prev.filter(p => p._id !== data.postId));
    };

    socket.on('post_deleted', handlePostDeleted);
    return () => {
      socket.off('post_deleted', handlePostDeleted);
    };
  }, []);

  /**
   * Load More Posts
   * ---------------
   * Called when user scrolls to bottom or clicks "Load More".
   */
  const loadMore = () => {
    if (isLoadingMore || !hasMore) return;
    
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, true);
  };

  /**
   * Infinite Scroll Handler
   * -----------------------
   * Detects when user scrolls near bottom of page.
   */
  useEffect(() => {
    const handleScroll = () => {
      // Check if user scrolled to bottom (with 200px buffer)
      const scrolledToBottom = 
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200;

      if (scrolledToBottom && hasMore && !isLoadingMore && !isLoading) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, isLoading, page]);

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {filterUser ? `Posts by ${filterUser}` : 'Your Feed'}
        </h1>
        {filterUser && (
          <a
            href="/feed"
            className="text-blue-600 hover:text-blue-700 text-sm mt-1 inline-block"
          >
            ← Back to all posts
          </a>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => fetchPosts(1)}
            className="text-red-600 dark:text-red-400 underline mt-2"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                <div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {filterUser ? `No posts from ${filterUser}` : 'No posts yet'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {filterUser
              ? 'This user hasn\'t posted anything yet.'
              : 'Be the first to share something with the community!'}
          </p>
          {user && !filterUser && (
            <a
              href="/create"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Create your first post
            </a>
          )}
        </div>
      ) : (
        /* Posts List */
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard 
              key={post._id} 
              post={post}
              onPostDeleted={(postId) => {
                // Remove deleted post from feed
                setPosts(prev => prev.filter(p => p._id !== postId));
              }}
            />
          ))}

          {/* Load More Button / Loading */}
          {hasMore && (
            <div className="py-4 text-center">
              {isLoadingMore ? (
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  <div className="spinner w-5 h-5"></div>
                  <span>Loading more...</span>
                </div>
              ) : (
                <button
                  onClick={loadMore}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Load more posts
                </button>
              )}
            </div>
          )}

          {/* End of Feed */}
          {!hasMore && posts.length > 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              You&apos;ve reached the end of the feed
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Main component with Suspense wrapper
export default function FeedPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="spinner w-8 h-8"></div>
      </div>
    }>
      <FeedContent />
    </Suspense>
  );
}
