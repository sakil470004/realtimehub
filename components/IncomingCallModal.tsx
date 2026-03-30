'use client';

/**
 * IncomingCallModal Component
 * ===========================
 * 
 * A modal/notification that appears when someone is calling.
 * Shows caller's name and call type (audio/video).
 * User can answer or decline the call.
 * 
 * Props:
 * - callId: ID of the incoming call
 * - caller: Caller info { _id, username }
 * - callType: 'audio' or 'video'
 * - isOpen: Whether modal is visible
 * - onAnswer: Callback when user clicks "Answer"
 * - onDecline: Callback when user clicks "Decline"
 */

import { useState } from 'react';

interface IncomingCallModalProps {
  callId: string;
  caller: {
    _id: string;
    username: string;
  };
  callType: 'audio' | 'video';
  isOpen: boolean;
  onAnswer: () => void;
  onDecline: () => void;
}

export default function IncomingCallModal({
  callId,
  caller,
  callType,
  isOpen,
  onAnswer,
  onDecline,
}: IncomingCallModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Don't render if modal is not open
  if (!isOpen) return null;

  const handleAnswer = async () => {
    try {
      setIsProcessing(true);

      // 1. Update Call status to 'active' via API
      // This tells both users that WebRTC connection should start
      const response = await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'answer' }),
      });

      if (!response.ok) {
        throw new Error('Failed to answer call');
      }

      // 2. Notify parent component that call was answered
      onAnswer();
    } catch (err: any) {
      console.error('Error answering call:', err);
      alert('Failed to answer call');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    try {
      setIsProcessing(true);

      // 1. Update Call status to 'declined' via API
      // This rejects the incoming call
      const response = await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' }),
      });

      if (!response.ok) {
        throw new Error('Failed to decline call');
      }

      // 2. Notify parent component that call was declined
      onDecline();
    } catch (err: any) {
      console.error('Error declining call:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Dark overlay behind modal (click to decline) */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 cursor-pointer"
        onClick={handleDecline}
      />

      {/* Modal box centered on screen */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-sm w-full mx-4 pointer-events-auto">
          {/* Call info section */}
          <div className="text-center mb-8">
            {/* Ring animation */}
            <div className="mb-6 flex justify-center">
              <div className="relative w-24 h-24 flex items-center justify-center">
                {/* Pulsing ring for ringing effect */}
                <div className="absolute inset-0 border-4 border-blue-400 rounded-full animate-pulse" />

                {/* Call type icon (phone or video camera) */}
                <div className="relative bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center">
                  {callType === 'audio' ? (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.797l.291 2.327a1 1 0 01-.471 1.023l-1.912 1.355a11.002 11.002 0 005.294 5.294l1.355-1.912a1 1 0 011.023-.471l2.327.291a1 1 0 01.797.986V17a1 1 0 01-1 1h-2C5.1 18 1 13.9 1 9V5a1 1 0 011-1h1.153z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm4 2v4m4-6v6m4-5v5" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* Who is calling and call type */}
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
              {caller.username}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {callType === 'audio' ? '🎙️ Audio Call' : '📹 Video Call'}
            </p>
          </div>

          {/* Action buttons - Answer (green) and Decline (red) */}
          <div className="flex gap-4">
            {/* Decline button */}
            <button
              onClick={handleDecline}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-lg font-medium transition-colors
                         bg-red-500 hover:bg-red-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  clipRule="evenodd"
                />
              </svg>
              Decline
            </button>

            {/* Answer button */}
            <button
              onClick={handleAnswer}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-lg font-medium transition-colors
                         bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.797l.291 2.327a1 1 0 01-.471 1.023l-1.912 1.355a11.002 11.002 0 005.294 5.294l1.355-1.912a1 1 0 011.023-.471l2.327.291a1 1 0 01.797.986V17a1 1 0 01-1 1h-2C5.1 18 1 13.9 1 9V5a1 1 0 011-1h1.153z" />
              </svg>
              Answer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
