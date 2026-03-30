'use client';

/**
 * ActiveCallWindow Component
 * ==========================
 * 
 * Displays during an active voice/video call.
 * Shows video streams (video call) or just audio (audio call).
 * Controls: mute/unmute, camera toggle, hang up.
 * Displays call duration timer.
 * 
 * Props:
 * - callId: ID of active call
 * - remoteUser: User on other end of call
 * - callType: 'audio' or 'video'
 * - isVideoEnabled: Whether camera is on
 * - isMicEnabled: Whether microphone is on
 * - callDuration: Seconds elapsed since connection
 * - onToggleVideo: Callback to enable/disable video
 * - onToggleMic: Callback to enable/disable microphone
 * - onEndCall: Callback when user hangs up
 * - localVideoRef: Ref to local video element
 * - remoteVideoRef: Ref to remote video element
 */

import { useEffect, useState } from 'react';

interface ActiveCallWindowProps {
  callId: string;
  remoteUser: {
    _id: string;
    username: string;
  };
  callType: 'audio' | 'video';
  isVideoEnabled: boolean;
  isMicEnabled: boolean;
  callDuration: number;
  onToggleVideo: () => void;
  onToggleMic: () => void;
  onEndCall: () => void;
  localVideoRef?: React.RefObject<HTMLVideoElement>;
  remoteVideoRef?: React.RefObject<HTMLVideoElement>;
}

export default function ActiveCallWindow({
  callId,
  remoteUser,
  callType,
  isVideoEnabled,
  isMicEnabled,
  callDuration,
  onToggleVideo,
  onToggleMic,
  onEndCall,
  localVideoRef,
  remoteVideoRef,
}: ActiveCallWindowProps) {
  const [displayTime, setDisplayTime] = useState('00:00');

  // Update call duration display every second
  useEffect(() => {
    const minutes = Math.floor(callDuration / 60);
    const seconds = callDuration % 60;
    setDisplayTime(
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    );
  }, [callDuration]);

  const handleEndCall = async () => {
    try {
      // 1. Update Call status to 'ended' via API
      // This records duration and notifies other user
      const response = await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end' }),
      });

      if (!response.ok) {
        throw new Error('Failed to end call');
      }

      // 2. Notify parent component that call ended
      onEndCall();
    } catch (err: any) {
      console.error('Error ending call:', err);
      alert('Error ending call');
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Call header with user info and duration timer */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
        <div>
          {/* Remote user name */}
          <h2 className="text-white text-lg font-semibold">
            {remoteUser.username}
          </h2>
          {/* Call duration timer MM:SS format */}
          <p className="text-gray-400 text-sm">{displayTime}</p>
        </div>

        {/* Call type icon and label */}
        <div className="flex items-center gap-2 text-gray-300">
          {callType === 'audio' ? (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.797l.291 2.327a1 1 0 01-.471 1.023l-1.912 1.355a11.002 11.002 0 005.294 5.294l1.355-1.912a1 1 0 011.023-.471l2.327.291a1 1 0 01.797.986V17a1 1 0 01-1 1h-2C5.1 18 1 13.9 1 9V5a1 1 0 011-1h1.153z" />
              </svg>
              <span>Audio Call</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm4 2v4m4-6v6m4-5v5" />
              </svg>
              <span>Video Call</span>
            </>
          )}
        </div>
      </div>

      {/* Main call content - Video streams or audio placeholder */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {callType === 'video' ? (
          <>
            {/* Remote user's video (full screen, main focus) */}
            {remoteVideoRef && (
              <video
                ref={remoteVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
              />
            )}

            {/* Local user's video (bottom right corner, small preview) */}
            {localVideoRef && (
              <video
                ref={localVideoRef}
                className="absolute bottom-4 right-4 w-32 h-32 object-cover rounded-lg border-2 border-white"
                autoPlay
                playsInline
                muted
              />
            )}
          </>
        ) : (
          // For audio calls, show a placeholder with user avatar/name
          <div className="text-center">
            <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center mb-4">
              <svg
                className="w-16 h-16 text-gray-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-white text-xl font-medium">{remoteUser.username}</p>
            <p className="text-gray-400 mt-2">🎙️ Audio Call</p>
          </div>
        )}
      </div>

      {/* Call controls (bottom) - Mute, camera, hang up */}
      <div className="bg-gray-900 border-t border-gray-700 px-6 py-4 flex justify-center items-center gap-4">
        {/* Mute/unmute button */}
        <button
          onClick={onToggleMic}
          className={`p-4 rounded-full transition-colors ${
            isMicEnabled
              ? 'bg-gray-700 hover:bg-gray-600'
              : 'bg-red-600 hover:bg-red-700'
          }`}
          title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          <svg
            className="w-6 h-6 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            {isMicEnabled ? (
              <path d="M8 16.5a6 6 0 006 6v-1.5a4.5 4.5 0 00-4.5-4.5h-1.5v-1.5zm6-12a3 3 0 11-6 0 3 3 0 016 0z" />
            ) : (
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V16.5h1.143l6.471-6.471 1.765-1.236z" />
            )}
          </svg>
        </button>

        {/* Toggle camera (only for video calls) */}
        {callType === 'video' && (
          <button
            onClick={onToggleVideo}
            className={`p-4 rounded-full transition-colors ${
              isVideoEnabled
                ? 'bg-gray-700 hover:bg-gray-600'
                : 'bg-red-600 hover:bg-red-700'
            }`}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            <svg
              className="w-6 h-6 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              {isVideoEnabled ? (
                <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm4 2v4m4-6v6m4-5v5" />
              ) : (
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V16.5h1.143l6.471-6.471 1.765-1.236z" />
              )}
            </svg>
          </button>
        )}

        {/* Hang up button (end call) */}
        <button
          onClick={handleEndCall}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
          title="End call"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
