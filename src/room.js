/**
 * Room management via Trystero (Nostr strategy).
 * Handles peer discovery, media stream exchange, mesh topology,
 * name/role broadcasting, and audio bitrate configuration.
 *
 * Audio and video are sent as SEPARATE streams so that video congestion
 * or packet loss never degrades audio.
 */

import { joinRoom as trysteroJoin } from '@trystero-p2p/nostr'
import { setupLatency, pingPeer, removePeer as latencyRemovePeer } from './latency.js'

const APP_ID = 'band-together-jam-v1'

let currentRoom = null
let roomCode = null
let localName = ''
let localRole = 'member'
let sendNameAction = null
let sendRoleAction = null
const peers = new Map()  // peerId -> { audioStream, videoStream, name, role }
const peerNames = new Map()
const peerRoles = new Map()

// Callbacks set by main.js
let onPeerJoinCb = null
let onPeerLeaveCb = null
let onPeerStreamCb = null
let onPeerTrackCb = null
let onPeerNameCb = null
let onPeerRoleCb = null

/**
 * Generate a short, memorable room code.
 */
export function generateRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * Join or create a room. Trystero handles mesh automatically.
 */
export function createOrJoinRoom(code, localAudioStream, name = '', role = 'member') {
  roomCode = code.toUpperCase().trim()
  localName = name || 'Anonymous'
  localRole = role

  currentRoom = trysteroJoin(
    { appId: APP_ID, relayRedundancy: 3 },
    roomCode,
  )

  // Set up name broadcasting via data channel
  const [sendName, getName] = currentRoom.makeAction('name')
  sendNameAction = sendName
  getName((name, peerId) => {
    peerNames.set(peerId, name)
    const peer = peers.get(peerId)
    if (peer) peer.name = name
    if (onPeerNameCb) onPeerNameCb(name, peerId)
  })

  // Set up role broadcasting via data channel
  const [sendRole, getRole] = currentRoom.makeAction('role')
  sendRoleAction = sendRole
  getRole((role, peerId) => {
    peerRoles.set(peerId, role)
    const peer = peers.get(peerId)
    if (peer) peer.role = role
    if (onPeerRoleCb) onPeerRoleCb(role, peerId)
  })

  // Add local audio stream — Trystero sends it to all current + future peers
  if (localAudioStream) {
    currentRoom.addStream(localAudioStream)
  }

  // Set up latency measurement
  setupLatency(currentRoom)

  // Peer join
  currentRoom.onPeerJoin(peerId => {
    peers.set(peerId, { audioStream: null, videoStream: null, name: null, role: null })
    // Send our name and role to the new peer
    sendNameAction(localName, peerId)
    sendRoleAction(localRole, peerId)
    // Re-send our audio to the new peer
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
    peerNames.delete(peerId)
    peerRoles.delete(peerId)
    latencyRemovePeer(peerId)
    if (onPeerLeaveCb) onPeerLeaveCb(peerId)
  })

  // Receive remote stream
  currentRoom.onPeerStream((stream, peerId) => {
    const peer = peers.get(peerId) || { audioStream: null, videoStream: null, name: null, role: null }

    const hasAudio = stream.getAudioTracks().length > 0
    const hasVideo = stream.getVideoTracks().length > 0

    if (hasAudio) peer.audioStream = stream
    if (hasVideo) peer.videoStream = stream
    peers.set(peerId, peer)

    if (onPeerStreamCb) onPeerStreamCb(stream, peerId)
  })

  // Receive individual track additions
  currentRoom.onPeerTrack((track, stream, peerId) => {
    const peer = peers.get(peerId) || { audioStream: null, videoStream: null, name: null, role: null }
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
  peerNames.clear()
  peerRoles.clear()
  roomCode = null
  localName = ''
  localRole = 'member'
  videoMediaStream = null
  sendNameAction = null
  sendRoleAction = null
}

export function getRoomCode() { return roomCode }
export function getLocalName() { return localName }
export function getPeerIds() { return [...peers.keys()] }
export function getPeer(peerId) { return peers.get(peerId) }
export function getPeerName(peerId) { return peerNames.get(peerId) || null }
export function getPeerRole(peerId) { return peerRoles.get(peerId) || null }

/**
 * Register event callbacks.
 */
export function onPeerJoin(cb) { onPeerJoinCb = cb }
export function onPeerLeave(cb) { onPeerLeaveCb = cb }
export function onPeerStream(cb) { onPeerStreamCb = cb }
export function onPeerTrack(cb) { onPeerTrackCb = cb }
export function onPeerName(cb) { onPeerNameCb = cb }
export function onPeerRole(cb) { onPeerRoleCb = cb }
