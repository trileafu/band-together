/**
 * BandTogether — main entry point.
 * Wires up UI, audio, video, and room management.
 */

import {
  getAudioStream,
  getLocalLevel,
  setMuted,
  listAudioInputs,
  stopAudio,
} from './audio.js'
import { startVideo, stopVideo } from './video.js'
import {
  createOrJoinRoom,
  generateRoomCode,
  leaveRoom,
  getRoomCode,
  getPeerIds,
  addVideoTrack,
  onPeerJoin,
  onPeerLeave,
  onPeerStream,
  onPeerTrack,
} from './room.js'
import { pingAll } from './latency.js'
import {
  showScreen,
  initTabs,
  createPeerCard,
  removePeerCard,
  attachStreamToPeer,
  attachVideoToPeer,
  updateMeters,
} from './ui.js'

// ── State ────────────────────────────────────────
let isMuted = false
let isVideoOn = false
let localStream = null
let animFrameId = null
let pingIntervalId = null

// ── DOM refs ─────────────────────────────────────
const $ = id => document.getElementById(id)

// ── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs()
  populateDevices()

  // Create room
  $('btn-create').addEventListener('click', async () => {
    const code = generateRoomCode()
    await joinSession(code)
  })

  // Join room
  $('btn-join').addEventListener('click', async () => {
    const code = $('input-room-code').value.trim()
    if (!code) {
      $('input-room-code').focus()
      return
    }
    await joinSession(code)
  })

  // Enter key on room code input
  $('input-room-code').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('btn-join').click()
  })

  // Copy room code
  $('btn-copy-code').addEventListener('click', () => {
    const code = getRoomCode()
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        $('btn-copy-code').textContent = 'Copied!'
        setTimeout(() => { $('btn-copy-code').textContent = 'Copy' }, 1500)
      })
    }
  })

  // Mute toggle
  $('btn-mute').addEventListener('click', () => {
    isMuted = !isMuted
    setMuted(isMuted)
    $('btn-mute').classList.toggle('active', isMuted)
    $('btn-mute').querySelector('.label').textContent = isMuted ? 'Unmute' : 'Mute'
  })

  // Video toggle
  $('btn-video').addEventListener('click', async () => {
    if (!isVideoOn) {
      const track = await startVideo()
      if (track) {
        isVideoOn = true
        $('btn-video').classList.add('active')
        $('btn-video').querySelector('.label').textContent = 'Stop Video'

        // Show local preview
        const localVideo = $('local-video')
        localVideo.srcObject = new MediaStream([track])
        localVideo.classList.remove('hidden')

        // Send to peers
        addVideoTrack(track)
      }
    } else {
      isVideoOn = false
      stopVideo()
      $('btn-video').classList.remove('active')
      $('btn-video').querySelector('.label').textContent = 'Video'

      const localVideo = $('local-video')
      localVideo.srcObject = null
      localVideo.classList.add('hidden')
    }
  })

  // Leave
  $('btn-leave').addEventListener('click', () => {
    cleanup()
    showScreen('landing')
  })
})

// ── Join Session ─────────────────────────────────
async function joinSession(code) {
  // Disable buttons during setup
  $('btn-create').disabled = true
  $('btn-join').disabled = true

  try {
    // Get audio settings
    const deviceId = $('select-input')?.value || 'default'
    const sampleRate = parseInt($('select-sample-rate')?.value || '48000', 10)
    const channels = parseInt($('select-channels')?.value || '2', 10)

    // Capture audio
    localStream = await getAudioStream(deviceId, channels, sampleRate)

    // Register callbacks
    onPeerJoin(handlePeerJoin)
    onPeerLeave(handlePeerLeave)
    onPeerStream(handlePeerStream)
    onPeerTrack(handlePeerTrack)

    // Join the Trystero room
    createOrJoinRoom(code, localStream)

    // Update UI
    $('room-code-display').textContent = getRoomCode()
    showScreen('session')

    // Start metering & latency loop
    startAnimationLoop()
    startPingLoop()
  } catch (err) {
    console.error('Failed to join session:', err)
    alert(`Could not start: ${err.message}\n\nMake sure you allow microphone access.`)
  } finally {
    $('btn-create').disabled = false
    $('btn-join').disabled = false
  }
}

// ── Peer callbacks ───────────────────────────────
function handlePeerJoin(peerId) {
  createPeerCard(peerId)
  updatePeerCount()
}

function handlePeerLeave(peerId) {
  removePeerCard(peerId)
  updatePeerCount()
}

function handlePeerStream(stream, peerId) {
  attachStreamToPeer(stream, peerId)
}

function handlePeerTrack(track, stream, peerId) {
  if (track.kind === 'video') {
    attachVideoToPeer(track, stream, peerId)
  }
}

// ── Animation / metering loop ────────────────────
function startAnimationLoop() {
  function tick() {
    const localLevel = getLocalLevel()
    const peerIds = getPeerIds()
    updateMeters(localLevel, peerIds)
    animFrameId = requestAnimationFrame(tick)
  }
  tick()
}

// ── Latency ping loop ────────────────────────────
function startPingLoop() {
  pingIntervalId = setInterval(() => {
    const peerIds = getPeerIds()
    if (peerIds.length > 0) pingAll(peerIds)
    updatePeerCount()
  }, 2000)
}

function updatePeerCount() {
  const count = getPeerIds().length
  $('stats-text').textContent = count === 0
    ? 'Waiting for bandmates to join...'
    : `${count + 1} musician${count > 0 ? 's' : ''} connected`
}

// ── Cleanup ──────────────────────────────────────
function cleanup() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
  if (pingIntervalId) {
    clearInterval(pingIntervalId)
    pingIntervalId = null
  }
  leaveRoom()
  stopAudio()
  stopVideo()
  isMuted = false
  isVideoOn = false
  localStream = null

  // Reset UI
  $('btn-mute').classList.remove('active')
  $('btn-mute').querySelector('.label').textContent = 'Mute'
  $('btn-video').classList.remove('active')
  $('btn-video').querySelector('.label').textContent = 'Video'
  $('local-video').srcObject = null
  $('local-video').classList.add('hidden')

  // Remove all peer cards
  const grid = $('peers-grid')
  for (const card of [...grid.querySelectorAll('.peer-card:not(.local)')]) {
    card.remove()
  }
}

// ── Populate audio device list ───────────────────
async function populateDevices() {
  try {
    // Request permission first to get labeled devices
    await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
      s.getTracks().forEach(t => t.stop())
    })
    const inputs = await listAudioInputs()
    const select = $('select-input')
    select.innerHTML = ''
    for (const device of inputs) {
      const option = document.createElement('option')
      option.value = device.deviceId
      option.textContent = device.label || `Microphone ${select.options.length + 1}`
      select.appendChild(option)
    }
  } catch (err) {
    console.warn('Could not enumerate audio devices:', err)
  }
}
