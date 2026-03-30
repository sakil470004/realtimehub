'use client';

/**
 * Calls Page
 * ==========
 * 
 * Central hub for managing voice/video calls.
 * Shows:
 * 1. Incoming call notifications
 * 2. Active call window
 * 3. Call history
 * 4. Online users to call
 * 
 * Flow:
 * - User clicks "Call" button on another user
 * - POST /api/calls creates Call doc + sends Socket.io event
 * - Receiver browser shows IncomingCallModal
 * - Receiver clicks "Answer"
 * - Both setup WebRTC peer connection
 * - Video/audio streams flow via P2P
 * - Either user can hang up
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import IncomingCallModal from '@/components/IncomingCallModal';
import ActiveCallWindow from '@/components/ActiveCallWindow';
import useWebRTCCall from '@/hooks/useWebRTCCall';
import { socketManager, onSocketEvent } from '@/lib/socket';

interface IncomingCall {
  callId: string;
  caller: {
    _id: string;
    username: string;
  };
  callType: 'audio' | 'video';
}

interface OnlineUser {
  _id: string;
  username: string;
  isOnline: boolean;
}

export default function CallsPage() {
  const { user } = useAuth();
  const router = useRouter();

  // State
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [callDuration, setCallDuration] = useState(0);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch friends list and setup online status tracking
  useEffect(() => {
    if (!user) return;

    const fetchFriends = async () => {
      try {
        // 1. Fetch list of accepted friends
        console.log('📞 Fetching friends list...');
        const response = await fetch('/api/friends/list');
        if (response.ok) {
          const { friends } = await response.json();
          console.log('✅ Friends fetched:', friends.length, friends);
          
          // Initialize all friends with offline status
          const usersWithStatus: OnlineUser[] = friends.map((friend: any) => ({
            _id: friend._id,
            username: friend.username,
            isOnline: false,
          }));
          
          setOnlineUsers(usersWithStatus);
        } else {
          console.error('Failed to fetch friends:', response.status);
        }
      } catch (err) {
        console.error('Error fetching friends:', err);
      }
    };

    fetchFriends();
  }, [user]);

  // Listen for user online status changes via Socket.io
  useEffect(() => {
    // When user status changes (online or offline)
    // Server broadcasts 'user_status_changed' when user_online/user_offline events are received
    const unsubscribeStatusChange = onSocketEvent('user_status_changed', (data: any) => {
      console.log('👁️ User status changed:', data.userId, data.isOnline);
      setOnlineUsers((prev) =>
        prev.map((user) =>
          user._id === data.userId 
            ? { ...user, isOnline: data.isOnline } 
            : user
        )
      );
    });

    return () => {
      unsubscribeStatusChange();
    };
  }, []);

  // WebRTC hook
  const webRTC = activeCallId && activeCall
    ? useWebRTCCall({
        callId: activeCallId,
        userId: user?.id || '',
        remoteUserId: activeCall.caller._id === user?.id 
          ? activeCall.receiver._id 
          : activeCall.caller._id,
        callType: activeCall.callType,
        isInitiator: activeCall.caller._id === user?.id,
      })
    : null;

  // Update video refs
  useEffect(() => {
    if (webRTC?.localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = webRTC.localStream;
    }
  }, [webRTC?.localStream]);

  useEffect(() => {
    if (webRTC?.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = webRTC.remoteStream;
    }
  }, [webRTC?.remoteStream]);

  // Listen for incoming calls
  useEffect(() => {
    if (!user) return;

    return onSocketEvent('incoming_call', (data: any) => {
      console.log('📞 Incoming call event:', data);
      setIncomingCall({
        callId: data.callId,
        caller: data.caller,
        callType: data.callType,
      });

      // Play ringtone sound (optional)
      playRingtone();
    });
  }, [user]);

  // Listen for call answered event
  useEffect(() => {
    return onSocketEvent('call_answered', (data: any) => {
      console.log('✅ Call answered:', data);
      // Both parties switch to active call mode
      if (activeCallId === data.callId) {
        fetchAndSetActiveCall(data.callId);
      }
    });
  }, [activeCallId]);

  // Listen for call ended event
  useEffect(() => {
    return onSocketEvent('call_ended', (data: any) => {
      console.log('📞 Call ended:', data);
      if (activeCallId === data.callId) {
        endActiveCall();
      }
    });
  }, [activeCallId]);

  // Listen for call declined event
  useEffect(() => {
    return onSocketEvent('call_declined', (data: any) => {
      console.log('❌ Call declined:', data);
      if (activeCallId === data.callId) {
        setActiveCall(null);
        setActiveCallId(null);
      }
    });
  }, [activeCallId]);

  // Call duration timer
  useEffect(() => {
    if (!activeCallId) return;

    durationTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [activeCallId]);

  // Fetch active call details
  const fetchAndSetActiveCall = async (callId: string) => {
    try {
      const response = await fetch(`/api/calls/${callId}`);
      if (response.ok) {
        const { call } = await response.json();
        setActiveCall(call);
      }
    } catch (err) {
      console.error('Error fetching call:', err);
    }
  };

  // Handle incoming call answer
  const handleAnswerCall = async () => {
    if (!incomingCall) return;

    try {
      setActiveCallId(incomingCall.callId);
      await fetchAndSetActiveCall(incomingCall.callId);
      setIncomingCall(null);
      setCallDuration(0);
    } catch (err) {
      console.error('Error answering call:', err);
    }
  };

  // Handle declining call
  const handleDeclineCall = () => {
    setIncomingCall(null);
  };

  // Handle initiating call
  const handleInitiateCall = async (
    recipientId: string,
    recipientUsername: string,
    callType: 'audio' | 'video'
  ) => {
    try {
      const response = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: recipientId,
          callType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate call');
      }

      const { call } = await response.json();
      setActiveCallId(call._id);
      setActiveCall(call);
      setCallDuration(0);
    } catch (err: any) {
      console.error('Error initiating call:', err);
      alert('Failed to initiate call: ' + err.message);
    }
  };

  // End active call
  const endActiveCall = () => {
    if (webRTC) {
      webRTC.endCall();
    }
    setActiveCall(null);
    setActiveCallId(null);
    setCallDuration(0);
  };

  // Play ringtone
  const playRingtone = () => {
    // Create simple beep using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.frequency.value = 1000;
      gain.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (err) {
      console.log('Ringtone not available');
    }
  };

  // Redirect if not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Please log in to access calls</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          callId={incomingCall.callId}
          caller={incomingCall.caller}
          callType={incomingCall.callType}
          isOpen={true}
          onAnswer={handleAnswerCall}
          onDecline={handleDeclineCall}
        />
      )}

      {/* Active Call Window */}
      {activeCallId && activeCall && webRTC && (
        <ActiveCallWindow
          callId={activeCallId}
          remoteUser={
            activeCall.caller._id === user.id
              ? activeCall.receiver
              : activeCall.caller
          }
          callType={activeCall.callType}
          isVideoEnabled={webRTC.isVideoEnabled}
          isMicEnabled={webRTC.isMicEnabled}
          callDuration={callDuration}
          onToggleVideo={webRTC.toggleVideo}
          onToggleMic={webRTC.toggleMic}
          onEndCall={endActiveCall}
          localVideoRef={localVideoRef as any}
          remoteVideoRef={remoteVideoRef as any}
        />
      )}

      {/* Main Content (shown when not in active call) */}
      {!activeCallId && (
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              📞 Calls
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Video and audio calling with your friends
            </p>
          </div>

          {/* Online Friends Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              👥 Online Friends
            </h2>

            {onlineUsers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {onlineUsers.map((friendUser) => (
                  <div
                    key={friendUser._id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                          {friendUser.username[0].toUpperCase()}
                        </div>
                        {friendUser.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {friendUser.username}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {friendUser.isOnline ? 'Online' : 'Offline'}
                        </p>
                      </div>
                    </div>

                    {/* Call buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleInitiateCall(
                            friendUser._id,
                            friendUser.username,
                            'audio'
                          )
                        }
                        className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                        title="Audio call"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.797l.291 2.327a1 1 0 01-.471 1.023l-1.912 1.355a11.002 11.002 0 005.294 5.294l1.355-1.912a1 1 0 011.023-.471l2.327.291a1 1 0 01.797.986V17a1 1 0 01-1 1h-2C5.1 18 1 13.9 1 9V5a1 1 0 011-1h1.153z" />
                        </svg>
                      </button>
                      <button
                        onClick={() =>
                          handleInitiateCall(
                            friendUser._id,
                            friendUser.username,
                            'video'
                          )
                        }
                        className="p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
                        title="Video call"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm4 2v4m4-6v6m4-5v5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                No online friends at the moment
              </p>
            )}
          </div>

          {/* Call History Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              📋 Recent Calls
            </h2>

            <div className="space-y-2">
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                Call history will appear here
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
