'use client';

/**
 * CallButton Component
 * ====================
 * 
 * A button to initiate a voice/video call with another user.
 * Shows call type (audio/video) with icons.
 * Handles API call to create Call document and triggers incoming call event.
 * 
 * Props:
 * - recipientId: ID of user to call
 * - recipientUsername: Display name of recipient
 * - callType: 'audio' or 'video'
 * - onCallInitiated: Callback when call starts
 */

import { useCallback, useState } from 'react';

interface CallButtonProps {
  recipientId: string;
  recipientUsername: string;
  callType?: 'audio' | 'video';
  onCallInitiated?: (callId: string) => void;
}

export default function CallButton({
  recipientId,
  recipientUsername,
  callType = 'audio',
  onCallInitiated,
}: CallButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCall = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Call API to create Call document and initiate call
      // This sends Socket.io event to receiver's browser
      const response = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: recipientId,
          callType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate call');
      }

      const { call } = await response.json();

      // 2. Notify parent component that call started
      if (onCallInitiated) {
        onCallInitiated(call._id);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error initiating call:', err);
    } finally {
      setIsLoading(false);
    }
  }, [recipientId, callType, onCallInitiated]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCall}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                   bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
        title={`Start ${callType} call with ${recipientUsername}`}
      >
        {/* Icon changes based on call type (audio phone vs video camera) */}
        {callType === 'audio' ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.797l.291 2.327a1 1 0 01-.471 1.023l-1.912 1.355a11.002 11.002 0 005.294 5.294l1.355-1.912a1 1 0 011.023-.471l2.327.291a1 1 0 01.797.986V17a1 1 0 01-1 1h-2C5.1 18 1 13.9 1 9V5a1 1 0 011-1h1.153z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm4 2v4m4-6v6m4-5v5" />
          </svg>
        )}
        {isLoading ? 'Calling...' : `${callType === 'audio' ? 'Audio' : 'Video'} Call`}
      </button>

      {/* Show error message if call initiation failed */}
      {error && (
        <span className="text-red-500 text-sm">{error}</span>
      )}
    </div>
  );
}
