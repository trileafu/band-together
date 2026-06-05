/**
 * Latency measurement via Trystero data actions (ping/pong over data channel).
 */

const peerLatencies = new Map()  // peerId -> { rtt, lastUpdate }
const pendingPings = new Map()   // peerId -> timestamp

let sendPing = null
let sendPong = null

/**
 * Set up ping/pong actions on a Trystero room.
 * Call this once after joining a room.
 */
export function setupLatency(room) {
  const [_sendPing, onPing] = room.makeAction('_ping')
  const [_sendPong, onPong] = room.makeAction('_pong')

  sendPing = _sendPing
  sendPong = _sendPong

  // When we receive a ping, immediately pong back
  onPing((data, peerId) => {
    _sendPong(data, peerId)
  })

  // When we receive a pong, calculate RTT
  onPong((data, peerId) => {
    const sent = pendingPings.get(peerId)
    if (sent !== undefined) {
      const rtt = performance.now() - sent
      peerLatencies.set(peerId, { rtt: Math.round(rtt), lastUpdate: Date.now() })
      pendingPings.delete(peerId)
    }
  })
}

/**
 * Send a ping to a specific peer.
 */
export function pingPeer(peerId) {
  if (!sendPing) return
  pendingPings.set(peerId, performance.now())
  sendPing(Date.now(), peerId)
}

/**
 * Ping all known peers.
 */
export function pingAll(peerIds) {
  for (const id of peerIds) pingPeer(id)
}

/**
 * Get the last measured RTT for a peer (or null).
 */
export function getLatency(peerId) {
  const entry = peerLatencies.get(peerId)
  return entry ? entry.rtt : null
}

/**
 * Get latency class for UI coloring.
 */
export function getLatencyClass(rtt) {
  if (rtt === null) return ''
  if (rtt < 60) return 'good'
  if (rtt < 120) return 'ok'
  return 'bad'
}

/**
 * Clean up state for a peer that left.
 */
export function removePeer(peerId) {
  peerLatencies.delete(peerId)
  pendingPings.delete(peerId)
}
