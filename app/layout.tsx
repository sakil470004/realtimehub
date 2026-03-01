/**
 * Root Layout
 * ===========
 * 
 * This is the root layout for the entire application.
 * It wraps all pages with:
 * - HTML structure
 * - Global styles
 * - AuthProvider (authentication context)
 * - Navbar component
 * 
 * Layout vs Page:
 * ---------------
 * - Layout: Shared UI that doesn't re-render on navigation
 * - Page: Unique content for each route
 * 
 * The {children} prop contains the page content that changes
 * based on the current route.
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';

// Load Inter font from Google Fonts
const inter = Inter({ subsets: ['latin'] });

// Metadata for SEO
export const metadata: Metadata = {
  title: 'RealTimeHub - Real-time Social Feed',
  description: 'A real-time social media application with live updates',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900 min-h-screen`}>
        {/* AuthProvider wraps everything to provide auth state */}
        <AuthProvider>
          {/* Navbar is always visible */}
          <Navbar />
          
          {/* Main content area */}
          <main className="min-h-[calc(100vh-64px)]">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
