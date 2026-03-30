'use client';

/**
 * useWebRTCCall Hook
 * ==================
 * 
 * Manages WebRTC peer connections using PeerJS library.
 * Handles:
 * - Local media stream capture (audio/video)
 * - Peer connection establishment via SDP offers/answers
 * - ICE candidate exchange for NAT traversal
 * - Remote stream handling
 * - Media controls (mute/camera toggle)
 * - Connection cleanup
 * 
 * Why PeerJS?
 * -----------
 * PeerJS wraps native WebRTC with easier-to-use API:
 * - Handles ICE candidate gathering automatically
 * - Simpler offer/answer negotiation
 * - Better error handling
 * - Automatic reconnection logic
 * 
 * How WebRTC Works (4 steps):
 * 1. Get local camera/mic stream
 * 2. Create offer (your connection details)
 * 3. Exchange offer + answer (via Socket.io signaling)
 * 4. Connect and stream media
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { onSocketEvent } from '@/lib/socket';

interface UseWebRTCCallProps {
  callId: string;
  userId: string;
  remoteUserId: string;
  callType: 'audio' | 'video';
  isInitiator: boolean; // true if this user initiated the call
}

interface UseWebRTCCallReturn {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isVideoEnabled: boolean;
  isMicEnabled: boolean;
  isConnected: boolean;
  toggleVideo: () => Promise<void>;
  toggleMic: () => Promise<void>;
  endCall: () => void;
  error: string | null;
}

export default function useWebRTCCall({
  callId,
  userId,
  remoteUserId,
  callType,
  isInitiator,
}: UseWebRTCCallProps): UseWebRTCCallReturn {
  // Refs to manage PeerJS and Web RTC objects (persist across renders)
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get Local Media Stream
   * ----------------------
   * Requests camera/microphone from user's browser.
   * Shows browser permission dialog if not yet granted.
   * For audio calls: only microphone
   * For video calls: microphone + camera
   */
  const getLocalStream = useCallback(async (): Promise<MediaStream> => {
    try {
      console.log(`📷 Requesting ${callType} stream...`);

      // Build constraints based on call type
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true, // Remove echo (when speaker plays mic becomes active)
          noiseSuppression: true, // Reduce background noise
          autoGainControl: true, // Auto adjust volume
        },
        video:
          callType === 'video'
            ? {
                width: { ideal: 1280 }, // Prefer HD
                height: { ideal: 720 },
                facingMode: 'user', // Use front camera on mobile
              }
            : false,
      };

      // Request media from browser
      // User will see a dialog asking for camera/mic permission
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Media stream obtained:', stream.getTracks());

      localStreamRef.current = stream;
      return stream;
    } catch (err: any) {
      const msg = `Failed to get media stream: ${err.message}`;
      console.error(msg);
      setError(msg);
      throw err;
    }
  }, [callType]);

  /**
   * Initialize PeerJS Object
   * -------------------------
   * Creates a Peer object which represents this user's peer connection capability.
   * PeerJS handles the complexity of NAT traversal and offer/answer exchange.
   * 
   * Peer ID:
   * You can generate your own ID or let PeerJS generate one.
   * We use userId so we can identify connections by user.
   * 
   * SignalingServer:
   * PeerJS has a free public server, or you can run your own.
   * For production, run your own: https://github.com/peers/peerjs-server
   */
  const initializePeer = useCallback(async (): Promise<Peer> => {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔧 Initializing PeerJS with ID:', userId);

        // Create Peer object
        // This represents our WebRTC capability
        const peer = new Peer(userId, {
          // PeerJS server config (using default public server for now)
          // For production, self-host: npm install peerjs-server
          host: process.env.NEXT_PUBLIC_PEERJS_HOST || 'localhost',
          port: parseInt(process.env.NEXT_PUBLIC_PEERJS_PORT || '9000'),
          path: '/peerjs',
          secure:
            process.env.NODE_ENV === 'production'
              ? true
              : /https/.test(window.location.protocol),
        });

        // When Peer object is ready
        peer.on('open', (id) => {
          console.log('✅ Peer opened with ID:', id);
          resolve(peer);
        });

        // Handle errors from Peer server
        peer.on('error', (err) => {
          const msg = `PeerJS error: ${err.type} - ${err.message}`;
          console.error(msg);
          setError(msg);
          reject(err);
        });

        // Handle disconnection from Peer server
        peer.on('disconnected', () => {
          console.warn('⚠️ Peer disconnected from server');
        });

        // Handle close (clean shutdown)
        peer.on('close', () => {
          console.log('🔲 Peer closed');
        });
      } catch (err) {
        console.error('Error initializing Peer:', err);
        reject(err);
      }
    });
  }, [userId]);

  /**
   * Create WebRTC Offer
   * -------------------
   * Called by the CALLER (person who initiated the call).
   * Creates an offer that describes offered media capabilities.
   * This offer is sent to the receiver who sends back an answer.
   * 
   * SDP (Session Description Protocol):
   * - Format for describing media capabilities
   * - Contains codec info, bandwidth, ICE candidates, etc.
   * - Exchanged via Socket.io signaling
   */
  const createOffer = useCallback(async (peerConnection: RTCPeerConnection) => {
    try {
      console.log('📤 Creating SDP offer...');

      // Create offer with media constraints
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      });

      // Set this offer as our local description
      // (tells browser this is what we're offering)
      await peerConnection.setLocalDescription(offer);

      console.log('✅ Offer created:', offer);
      return offer;
    } catch (err: any) {
      const msg = `Failed to create offer: ${err.message}`;
      console.error(msg);
      setError(msg);
      throw err;
    }
  }, [callType]);

  /**
   * Handle SDP Offer (Receiver side)
   * --------------------------------
   * Called by the RECEIVER (person who was called).
   * When receiving an offer from caller, must:
   * 1. Set the offer as remote description
   * 2. Create an answer SDP
   * 3. Send answer back to caller
   */
  const handleOffer = useCallback(
    async (
      peerConnection: RTCPeerConnection,
      offer: RTCSessionDescriptionInit
    ) => {
      try {
        console.log('📥 Handling offer...');

        // Set the offer from remote peer as remote description
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer)
        );

        // Create answer describing our capabilities
        const answer = await peerConnection.createAnswer();

        // Set our answer as local description
        await peerConnection.setLocalDescription(answer);

        console.log('✅ Answer created:', answer);
        return answer;
      } catch (err: any) {
        const msg = `Failed to handle offer: ${err.message}`;
        console.error(msg);
        setError(msg);
        throw err;
      }
    },
    []
  );

  /**
   *  Handle SDP Answer (Caller side)
   * --------------------------------
   * Called by the CALLER when receiving answer from receiver.
   * Simply accepts the answer and connection setup completes.
   */
  const handleAnswer = useCallback(
    async (
      peerConnection: RTCPeerConnection,
      answer: RTCSessionDescriptionInit
    ) => {
      try {
        console.log('📥 Handling answer...');

        // Accept the remote answer
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer)
        );

        console.log('✅ Answer accepted, connection established');
      } catch (err: any) {
        const msg = `Failed to handle answer: ${err.message}`;
        console.error(msg);
        setError(msg);
        throw err;
      }
    },
    []
  );

  /**
   * Add ICE Candidate
   * -----------------
   * ICE (Interactive Connectivity Establishment) candidates are potential
   * network paths to reach the remote peer.
   * 
   * Process:
   * 1. Browser discovers potential IP:port pairs (STUN server helps)
   * 2. Each pair is an ICE candidate
   * 3. Both peers exchange candidates
   * 4. Browser tests which path works best
   * 5. Uses the working path for media streaming
   */
  const addICECandidate = useCallback(
    async (
      peerConnection: RTCPeerConnection,
      candidate: RTCIceCandidateInit
    ) => {
      try {
        if (!candidate) return;

        console.log('Adding ICE candidate:', candidate);
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err: any) {
        // Ignore duplicate/late candidates (normal in WebRTC)
        if (err.message.includes('already exists')) {
          return;
        }
        console.error('Error adding ICE candidate:', err);
      }
    },
    []
  );

  /**
   * Setup RTCPeerConnection
   * -----------------------
   * Creates the actual WebRTC peer connection object.
   * This is the core object that handles all media streaming.
   */
  const setupPeerConnection = useCallback(
    async (localStream: MediaStream, peer: Peer): Promise<RTCPeerConnection> => {
      try {
        console.log('🔌 Setting up peer connection...');

        // Create RTCPeerConnection
        // This is the actual WebRTC connection object
        const peerConnection = new RTCPeerConnection({
          iceServers: [
            {
              // STUN servers help discover public IP address behind NAT
              urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
              ],
            },
          ],
        });

        // Add local stream tracks to peer connection
        // This sends our audio/video to the remote peer
        localStream.getTracks().forEach((track) => {
          console.log('Adding track to peer connection:', track.kind);
          peerConnection.addTrack(track, localStream);
        });

        // Handle ICE candidates generated by our browser
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('🧊 ICE candidate found:', event.candidate);

            // Send our ICE candidate to remote peer via Socket.io
            const socket = require('@/lib/socket').socketManager.getSocket();
            socket?.emit('ice_candidate', {
              callId,
              candidate: event.candidate.toJSON(),
              targetUserId: remoteUserId,
            });
          }
        };

        // Handle remote stream received from peer
        peerConnection.ontrack = (event) => {
          console.log('📺 Remote track received:', event.track.kind);
          console.log('Remote streams:', event.streams);

          // Create stream from remote tracks
          if (event.streams && event.streams[0]) {
            const remoteStream = event.streams[0];
            remoteStreamRef.current = remoteStream;
            setRemoteStream(remoteStream);
          }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
          console.log('Connection state:', peerConnection.connectionState);

          switch (peerConnection.connectionState) {
            case 'connected':
              console.log('✅ Peer connection established!');
              setIsConnected(true);
              break;
            case 'disconnected':
            case 'failed':
            case 'closed':
              console.log('❌ Peer connection lost');
              setIsConnected(false);
              break;
          }
        };

        connectionRef.current = peerConnection;
        return peerConnection;
      } catch (err: any) {
        const msg = `Failed to setup peer connection: ${err.message}`;
        console.error(msg);
        setError(msg);
        throw err;
      }
    },
    [callId, remoteUserId]
  );

  /**
   * Toggle Video/Camera
   * -------------------
   * Enable or disable video track being sent to remote peer.
   * User see "camera off" icon to indicate disabled state.
   */
  const toggleVideo = useCallback(async () => {
    try {
      if (!localStreamRef.current) return;

      const videoTrack = localStreamRef.current
        .getTracks()
        .find((track) => track.kind === 'video');

      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log(`📹 Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    } catch (err: any) {
      console.error('Error toggling video:', err);
    }
  }, []);

  /**
   * Toggle Microphone
   * -----------------
   * Enable or disable audio track being sent to remote peer.
   * User see "mic off" icon to indicate muted state.
   */
  const toggleMic = useCallback(async () => {
    try {
      if (!localStreamRef.current) return;

      const audioTrack = localStreamRef.current
        .getTracks()
        .find((track) => track.kind === 'audio');

      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicEnabled(audioTrack.enabled);
        console.log(`🎙️ Mic ${audioTrack.enabled ? 'enabled' : 'muted'}`);
      }
    } catch (err: any) {
      console.error('Error toggling mic:', err);
    }
  }, []);

  /**
   * End Call
   * --------
   * Clean up all WebRTC connections and media streams.
   * Called when user hangs up or connection drops.
   */
  const endCall = useCallback(() => {
    console.log('📞 Ending call...');

    // Stop all media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
    }

    // Close peer connection
    if (connectionRef.current) {
      connectionRef.current.close();
    }

    //Close peer
    if (peerRef.current) {
      peerRef.current.destroy();
    }

    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
  }, []);

  /**
   * Main Effects
   * ============
   */

  // Effect 1: Initialize everything when component mounts
  useEffect(() => {
    const initialize = async () => {
      try {
        // 1. Get local media stream (camera/mic)
        const stream = await getLocalStream();
        setLocalStream(stream);

        // 2. Initialize PeerJS
        const peer = await initializePeer();
        peerRef.current = peer;

        // 3. Set up RTCPeerConnection
        const peerConnection = await setupPeerConnection(stream, peer);

        // 4. If this user is the CALLER, create and send offer
        if (isInitiator) {
          const offer = await createOffer(peerConnection);

          // Send offer to receiver via Socket.io
          const socket = require('@/lib/socket').socketManager.getSocket();
          socket?.emit('sdp_offer', {
            callId,
            offer: offer,
            receiverId: remoteUserId,
          });
        }
      } catch (err) {
        console.error('Error initializing call:', err);
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      endCall();
    };
  }, [
    callId,
    isInitiator,
    remoteUserId,
    getLocalStream,
    initializePeer,
    setupPeerConnection,
    createOffer,
    endCall,
  ]);

  // Effect 2: Listen for incoming SDP offer (receiver side)
  useEffect(() => {
    if (isInitiator || !connectionRef.current) return;

    return onSocketEvent('sdp_offer', async (data: any) => {
      if (data.callId === callId && data.offer && connectionRef.current) {
        const answer = await handleOffer(connectionRef.current, data.offer);

        // Send answer back to caller
        const socket = require('@/lib/socket').socketManager.getSocket();
        socket?.emit('sdp_answer', {
          callId,
          answer: answer,
          callerId: remoteUserId,
        });
      }
    });
  }, [isInitiator, callId, remoteUserId, handleOffer]);

  // Effect 3: Listen for incoming SDP answer (caller side)
  useEffect(() => {
    if (!isInitiator || !connectionRef.current) return;

    return onSocketEvent('sdp_answer', async (data: any) => {
      if (data.callId === callId && data.answer && connectionRef.current) {
        await handleAnswer(connectionRef.current, data.answer);
      }
    });
  }, [isInitiator, callId, handleAnswer]);

  // Effect 4: Listen for incoming ICE candidates
  useEffect(() => {
    if (!connectionRef.current) return;

    return onSocketEvent('ice_candidate', async (data: any) => {
      if (data.callId === callId && data.candidate && connectionRef.current) {
        await addICECandidate(connectionRef.current, data.candidate);
      }
    });
  }, [callId, addICECandidate]);

  return {
    localStream,
    remoteStream,
    isVideoEnabled,
    isMicEnabled,
    isConnected,
    toggleVideo,
    toggleMic,
    endCall,
    error,
  };
}
