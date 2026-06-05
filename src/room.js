/**
 * Room management via Trystero (Nostr strategy).
 * Handles peer discovery, media stream exchange, and mesh topology.
 *
 * Audio and video are sent as SEPARATE streams so that video congestion
 * or packet loss never degrades audio. Audio senders get "high" priority,
 * video senders get "low" priority — the browser's bandwidth estimator
 * will always starve video before audio.
 */

import { joinRoom as trysteroJoin } from '@trystero-p2p/nostr'
import { setupLatency, pingPeer, removePeer as latencyRemovePeer } from './latency.js'

const APP_ID = 'band-together-jam-v1'

let currentRoom = null
let roomCode = null
const peers = new Map()  // peerId -> { audioStream, videoStream }

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
 * Join or create a room. Trystero handles mesh automatically.
 * Audio and video are added as separate streams.
 */
export function createOrJoinRoom(code, localAudioStream) {
  roomCode = code.toUpperCase().trim()

  currentRoom = trysteroJoin(
    { appId: APP_ID, relayRedundancy: 3 },
    roomCode,
  )

  // Add local audio stream — Trystero sends it to all current + future peers
  if (localAudioStream) {
    currentRoom.addStream(localAudioStream)
  }

  // Set up latency measurement
  setupLatency(currentRoom)

  // Peer join
  currentRoom.onPeerJoin(peerId => {
    peers.set(peerId, { audioStream: null, videoStream: null })
    // Re-send our audio to the new peer (Trystero may already do this via
    // the initial addStream, but explicit targeting ensures it)
    if (localAudioStream) {
      currentRoom.addStream(localAudioStream, peerId)
    }
    // Also send video if active
    if (videoMediaStream) {
      currentRoom.addStream(videoMediaStream, peerId)
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

  // Receive remote stream (audio-only or video-only, since they're separate)
  currentRoom.onPeerStream((stream, peerId) => {
    const peer = peers.get(peerId) || { audioStream: null, videoStream: null }

    const hasAudio = stream.getAudioTracks().length > 0
    const hasVideo = stream.getVideoTracks().length > 0

    if (hasAudio) {
      peer.audioStream = stream
    }
    if (hasVideo) {
      peer.videoStream = stream
    }
    peers.set(peerId, peer)

    if (onPeerStreamCb) onPeerStreamCb(stream, peerId)
  })

  // Receive individual track additions
  currentRoom.onPeerTrack((track, stream, peerId) => {
    const peer = peers.get(peerId) || { audioStream: null, videoStream: null }
    if (track.kind === 'video') {
      peer.videoStream = stream
    } else if (track.kind === 'audio') {
      peer.audioStream = stream
    }
    peers.set(peerId, peer)
    if (onPeerTrackCb) onPeerTrackCb(track, stream, peerId)
  })

  return currentRoom
}

let videoMediaStream = null

/**
 * Add a video track to broadcast to all peers as a SEPARATE stream.
 * This ensures video is fully independent from audio.
 */
export function addVideoTrack(track) {
  if (!currentRoom) return
  videoMediaStream = new MediaStream([track])
  currentRoom.addStream(videoMediaStream)
}

/**
 * Remove video from broadcast (stop sending).
 */
export function removeVideoTrack() {
  if (!currentRoom || !videoMediaStream) return
  currentRoom.removeStream(videoMediaStream)
  videoMediaStream = null
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
  videoMediaStream = null
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
