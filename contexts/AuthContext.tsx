/**
 * Authentication Context
 * ======================
 * 
 * Provides authentication state throughout the app.
 * 
 * What is Context?
 * ----------------
 * React Context allows you to share data between components
 * without passing props manually at every level (prop drilling).
 * 
 * Usage:
 * ------
 * // In any component:
 * const { user, login, logout, isLoading } = useAuth();
 * 
 * if (isLoading) return <Spinner />;
 * if (!user) return <LoginPrompt />;
 * return <h1>Hello, {user.username}!</h1>;
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { socketManager } from '@/lib/socket';

/**
 * User type - matches what we get from the API
 */
interface User {
  id: string;
  username: string;
  email: string;
}

/**
 * Auth Context type - what we provide to components
 */
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

// Create the context with undefined default
// (will be provided by AuthProvider)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Auth Provider Component
 * -----------------------
 * Wrap your app with this to provide auth state to all components.
 * 
 * Example in layout.js:
 * <AuthProvider>
 *   <Navbar />
 *   {children}
 * </AuthProvider>
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);  // Initially loading
  const router = useRouter();

  /**
   * Check Authentication
   * --------------------
   * Called on app load to check if user is logged in.
   * Fetches user data from /api/auth/me endpoint.
   */
  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        
        // Connect to Socket.io when user is authenticated
        socketManager.connect(data.user.id);
        
        // Broadcast that user came online
        const socket = socketManager.getSocket();
        socket?.emit('user_online', {
          userId: data.user.id,
          username: data.user.username,
        });
      } else {
        setUser(null);
        socketManager.disconnect();
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check auth on initial load
  useEffect(() => {
    checkAuth();
    
    // Cleanup socket on unmount
    return () => {
      socketManager.disconnect();
    };
  }, [checkAuth]);

  /**
   * Login Function
   * ---------------
   * Sends credentials to API, updates state on success.
   */
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        // Connect to socket after login
        socketManager.connect(data.user.id);
        
        // Broadcast that user came online
        const socket = socketManager.getSocket();
        socket?.emit('user_online', {
          userId: data.user.id,
          username: data.user.username,
        });
        
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  /**
   * Signup Function
   * ---------------
   * Creates new account, logs user in on success.
   */
  const signup = async (username: string, email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        // Connect to socket after signup
        socketManager.connect(data.user.id);
        
        // Broadcast that user came online
        const socket = socketManager.getSocket();
        socket?.emit('user_online', {
          userId: data.user.id,
          username: data.user.username,
        });
        
        return { success: true };
      } else {
        return { 
          success: false, 
          error: data.details 
            ? Object.values(data.details).join(', ') 
            : data.error || 'Signup failed' 
        };
      }
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  /**
   * Logout Function
   * ---------------
   * Calls logout API, clears state, redirects to login.
   */
  const logout = async () => {
    try {
      // Broadcast that user went offline (before disconnecting)
      if (user) {
        const socket = socketManager.getSocket();
        socket?.emit('user_offline', {
          userId: user.id,
          username: user.username,
        });
      }
      
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      socketManager.disconnect();
      router.push('/login');
    }
  };

  // Provide auth state and functions to children
  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth Hook
 * ------------
 * Custom hook to access auth context.
 * Must be used within an AuthProvider.
 * 
 * Throws error if used outside provider (catches bugs early).
 */
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}
