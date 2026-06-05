/**
 * UI helpers — DOM manipulation, peer cards, meters.
 */

import { getLevel, createRemoteAnalyser } from './audio.js'
import { getLatency, getLatencyClass } from './latency.js'

const remoteAnalysers = new Map()  // peerId -> analyser

/**
 * Create a peer card element for a remote peer.
 */
export function createPeerCard(peerId) {
  const card = document.createElement('div')
  card.className = 'peer-card'
  card.id = `peer-${peerId}`
  card.innerHTML = `
    <div class="peer-video-wrap">
      <video autoplay playsinline></video>
      <div class="no-video-label">Camera Off</div>
    </div>
    <div class="peer-info">
      <span class="peer-name">Peer ${peerId.slice(0, 6)}</span>
      <div class="meter-wrap">
        <div class="meter-bar"></div>
      </div>
      <span class="peer-latency"></span>
    </div>
  `
  document.getElementById('peers-grid').appendChild(card)
  return card
}

/**
 * Remove a peer card from the DOM.
 */
export function removePeerCard(peerId) {
  const card = document.getElementById(`peer-${peerId}`)
  if (card) card.remove()
  remoteAnalysers.delete(peerId)
}

/**
 * Attach an audio stream to a peer card and set up an analyser.
 */
export function attachStreamToPeer(stream, peerId) {
  const card = document.getElementById(`peer-${peerId}`)
  if (!card) return

  // Create an audio element for playback (not the video element)
  let audioEl = card.querySelector('audio')
  if (!audioEl) {
    audioEl = document.createElement('audio')
    audioEl.autoplay = true
    audioEl.playsInline = true
    card.appendChild(audioEl)
  }
  audioEl.srcObject = stream

  // Try to play (handle autoplay policy)
  audioEl.play().catch(() => {
    // Will be unblocked on user interaction
    document.addEventListener('click', () => audioEl.play(), { once: true })
  })

  // Set up analyser for metering
  try {
    const analyser = createRemoteAnalyser(stream)
    remoteAnalysers.set(peerId, analyser)
  } catch (e) {
    console.warn('Could not create analyser for peer', peerId, e)
  }

  // If stream has video tracks, show them
  const videoTracks = stream.getVideoTracks()
  if (videoTracks.length > 0) {
    const videoEl = card.querySelector('video')
    videoEl.srcObject = stream
    videoEl.classList.remove('hidden')
  }
}

/**
 * Attach a video track to a peer card.
 */
export function attachVideoToPeer(track, stream, peerId) {
  const card = document.getElementById(`peer-${peerId}`)
  if (!card) return

  const videoEl = card.querySelector('video')
  videoEl.srcObject = stream
  videoEl.classList.remove('hidden')
}

/**
 * Update all meter bars and latency displays. Call on rAF loop.
 */
export function updateMeters(localLevel, peerIds) {
  // Local meter
  updateMeter(document.getElementById('local-meter'), localLevel)

  // Remote meters
  for (const peerId of peerIds) {
    const card = document.getElementById(`peer-${peerId}`)
    if (!card) continue

    const analyser = remoteAnalysers.get(peerId)
    const level = analyser ? getLevel(analyser) : 0
    const meterBar = card.querySelector('.meter-bar')
    updateMeter(meterBar, level)

    // Latency display
    const latencyEl = card.querySelector('.peer-latency')
    const rtt = getLatency(peerId)
    if (rtt !== null) {
      latencyEl.textContent = `${rtt}ms`
      latencyEl.className = `peer-latency ${getLatencyClass(rtt)}`
    } else {
      latencyEl.textContent = '...'
      latencyEl.className = 'peer-latency'
    }
  }
}

function updateMeter(el, level) {
  if (!el) return
  const pct = Math.min(level * 100 * 2.5, 100)  // amplify for visibility
  el.style.width = `${pct}%`
  el.classList.toggle('loud', pct > 70)
  el.classList.toggle('clipping', pct > 90)
}

/**
 * Switch between screens.
 */
export function showScreen(screenId) {
  for (const s of document.querySelectorAll('.screen')) {
    s.classList.toggle('active', s.id === screenId)
  }
}

/**
 * Set up tab switching in the landing screen.
 */
export function initTabs() {
  const tabs = document.querySelectorAll('.tab')
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'))
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active')
    })
  })
}
