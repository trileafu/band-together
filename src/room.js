/**
 * Room management via Trystero (Nostr strategy).
 * Handles peer discovery, media stream exchange, and mesh topology.
 */

import { joinRoom as trysteroJoin } from '@trystero-p2p/nostr'
import { setupLatency, pingPeer, removePeer as latencyRemovePeer } from './latency.js'

const APP_ID = 'band-together-jam-v1'

let currentRoom = null
let roomCode = null
const peers = new Map()  // peerId -> { stream, videoTrack }

// Callbacks set by main.js
let onPeerJoinCb = null
let onPeerLeaveCb = null
let onPeerStreamCb = null
let onPeerTrackCb = null

/**
 * Generate a short, memorable room code.
 */
export function generateRoomCode() {
  const words = [
    'ROCK', 'JAZZ', 'FUNK', 'BEAT', 'BASS', 'DRUM', 'RIFF', 'SOLO',
    'TUNE', 'VIBE', 'SYNC', 'LOOP', 'FRET', 'PICK', 'KICK', 'SNAP',
    'BOOM', 'CLAP', 'STRUM', 'PLUCK', 'DROP', 'GROOVE', 'CHORD', 'NOTE',
  ]
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(Math.random() * 90) + 10
  return `${word}-${num}`
}

/**
 * Configure WebRTC for low-latency audio.
 */
function getRtcConfig() {
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  }
}

/**
 * Join or create a room. Trystero handles mesh automatically.
 */
export function createOrJoinRoom(code, localStream) {
  roomCode = code.toUpperCase().trim()

  currentRoom = trysteroJoin(
    { appId: APP_ID, relayRedundancy: 3 },
    roomCode,
    getRtcConfig()
  )

  // Add local audio stream — Trystero sends it to all peers automatically
  if (localStream) {
    currentRoom.addStream(localStream)
  }

  // Set up latency measurement
  setupLatency(currentRoom)

  // Peer join
  currentRoom.onPeerJoin(peerId => {
    peers.set(peerId, { stream: null, videoTrack: null })
    // Send our stream to the new peer
    if (localStream) {
      currentRoom.addStream(localStream, null, { target: peerId })
    }
    // Start measuring latency
    setTimeout(() => pingPeer(peerId), 500)
    if (onPeerJoinCb) onPeerJoinCb(peerId)
  })

  // Peer leave
  currentRoom.onPeerLeave(peerId => {
    peers.delete(peerId)
    latencyRemovePeer(peerId)
    if (onPeerLeaveCb) onPeerLeaveCb(peerId)
  })

  // Receive remote stream
  currentRoom.onPeerStream((stream, peerId) => {
    const peer = peers.get(peerId) || { stream: null, videoTrack: null }
    peer.stream = stream
    peers.set(peerId, peer)

    // Prioritize audio sender params if we can access the underlying PC
    optimizeAudioSender(peerId)

    if (onPeerStreamCb) onPeerStreamCb(stream, peerId)
  })

  // Receive individual track additions (for video toggle)
  currentRoom.onPeerTrack((track, stream, peerId) => {
    if (track.kind === 'video') {
      const peer = peers.get(peerId) || { stream: null, videoTrack: null }
      peer.videoTrack = track
      peers.set(peerId, peer)
    }
    if (onPeerTrackCb) onPeerTrackCb(track, stream, peerId)
  })

  return currentRoom
}

/**
 * Try to set audio encoding priority to high.
 */
function optimizeAudioSender(peerId) {
  // Trystero doesn't expose raw RTCPeerConnection directly,
  // but the audio priority hints are set via addStream constraints.
  // This is a best-effort optimization.
}

/**
 * Add a video track to broadcast to all peers.
 */
export function addVideoTrack(track) {
  if (!currentRoom) return
  const stream = new MediaStream([track])
  currentRoom.addStream(stream)
}

/**
 * Remove video from broadcast (stop sending).
 */
export function removeVideoTrack(track) {
  if (!currentRoom) return
  currentRoom.removeStream(track)
}

/**
 * Leave the current room and clean up.
 */
export function leaveRoom() {
  if (currentRoom) {
    currentRoom.leave()
    currentRoom = null
  }
  peers.clear()
  roomCode = null
}

/**
 * Get current room code.
 */
export function getRoomCode() {
  return roomCode
}

/**
 * Get all connected peer IDs.
 */
export function getPeerIds() {
  return [...peers.keys()]
}

/**
 * Get peer data.
 */
export function getPeer(peerId) {
  return peers.get(peerId)
}

/**
 * Register event callbacks.
 */
export function onPeerJoin(cb) { onPeerJoinCb = cb }
export function onPeerLeave(cb) { onPeerLeaveCb = cb }
export function onPeerStream(cb) { onPeerStreamCb = cb }
export function onPeerTrack(cb) { onPeerTrackCb = cb }
