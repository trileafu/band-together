/**
 * BandTogether — main entry point.
 * Wires up UI, audio, video, room management, names, mixer, spectator.
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
  onPeerName,
  onPeerRole,
  getPeerName,
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
  updatePeerName,
  hidePeerCard,
} from './ui.js'
import { renderIcons } from './icons.js'

// ── State ────────────────────────────────────────
let isMuted = false
let isVideoOn = false
let localStream = null
let animFrameId = null
let pingIntervalId = null
let isSpectatorMode = false
let spectatorHideTimeout = null

// ── DOM refs ─────────────────────────────────────
const $ = id => document.getElementById(id)

// ── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs()
  populateDevices()
  renderIcons()

  // Create room
  $('btn-create').addEventListener('click', async () => {
    const code = generateRoomCode()
    const name = $('input-name-create').value.trim()
    await joinSession(code, name, false)
  })

  // Join room
  $('btn-join').addEventListener('click', async () => {
    const code = $('input-room-code').value.trim()
    if (!code) {
      $('input-room-code').focus()
      return
    }
    const name = $('input-name-join').value.trim()
    const mode = document.querySelector('input[name="join-mode"]:checked')?.value
    await joinSession(code, name, mode === 'spectator')
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
        const label = $('btn-copy-code').querySelector('span:last-child')
        if (label) label.textContent = 'Copied!'
        setTimeout(() => { if (label) label.textContent = 'Copy' }, 1500)
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
        const localVideo = $('local-video')
        localVideo.srcObject = new MediaStream([track])
        localVideo.classList.remove('hidden')
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

  // Fullscreen view toggle
  $('btn-spectator').addEventListener('click', () => {
    enterSpectatorMode()
  })

  // Exit spectator
  $('btn-exit-spectator').addEventListener('click', () => {
    exitSpectatorMode()
  })

  // Spectator mixer close
  $('btn-close-spec-mixer').addEventListener('click', () => {
    $('spectator-mixer').classList.add('hidden')
  })

  // Keyboard shortcuts in spectator mode
  document.addEventListener('keydown', e => {
    if (!isSpectatorMode) return
    if (e.key === 'Escape') {
      exitSpectatorMode()
    } else if (e.key === 'm' || e.key === 'M') {
      $('spectator-mixer').classList.toggle('hidden')
    }
  })

  // Mouse move in spectator — show/hide exit button
  document.addEventListener('mousemove', () => {
    if (!isSpectatorMode) return
    const exitBtn = $('btn-exit-spectator')
    exitBtn.classList.remove('fade-out')
    clearTimeout(spectatorHideTimeout)
    spectatorHideTimeout = setTimeout(() => {
      exitBtn.classList.add('fade-out')
    }, 3000)
  })

  // Leave
  $('btn-leave').addEventListener('click', () => {
    cleanup()
    showScreen('landing')
  })
})

// ── Join Session ─────────────────────────────────
async function joinSession(code, name, spectator) {
  $('btn-create').disabled = true
  $('btn-join').disabled = true

  try {
    const deviceId = $('select-input')?.value || 'default'
    const sampleRate = parseInt($('select-sample-rate')?.value || '48000', 10)
    const channels = parseInt($('select-channels')?.value || '2', 10)
    const bitrate = parseInt($('select-bitrate')?.value || '128000', 10)

    // Spectators don't capture audio
    if (!spectator) {
      try {
        localStream = await getAudioStream(deviceId, channels, sampleRate)
      } catch (audioErr) {
        console.warn('No microphone available, joining in listen-only mode:', audioErr.message)
        localStream = null
      }
    }

    // Register callbacks
    onPeerJoin(handlePeerJoin)
    onPeerLeave(handlePeerLeave)
    onPeerStream(handlePeerStream)
    onPeerTrack(handlePeerTrack)
    onPeerName(handlePeerName)
    onPeerRole(handlePeerRole)

    // Join the Trystero room (pass role so peers know if we're spectator)
    const role = spectator ? 'spectator' : 'member'
    createOrJoinRoom(code, localStream, name || 'Anonymous', role)

    // Update UI
    const displayName = name || 'You'
    $('local-name').textContent = displayName
    $('room-code-display').textContent = getRoomCode()

    if (!localStream) {
      $('btn-mute').classList.add('active')
      $('btn-mute').querySelector('.label').textContent = spectator ? 'Spectator' : 'No Mic'
      $('btn-mute').disabled = true
    }

    if (spectator) {
      isSpectatorMode = true
      $('local-card').style.display = 'none'
      showScreen('spectator')
      spectatorHideTimeout = setTimeout(() => {
        $('btn-exit-spectator').classList.add('fade-out')
      }, 3000)
    } else {
      showScreen('session')
    }

    startAnimationLoop()
    startPingLoop()
  } catch (err) {
    console.error('Failed to join session:', err)
    alert(`Could not start: ${err.message}`)
  } finally {
    $('btn-create').disabled = false
    $('btn-join').disabled = false
  }
}

// ── Spectator mode ───────────────────────────────
function enterSpectatorMode() {
  isSpectatorMode = true
  showScreen('spectator')
  spectatorHideTimeout = setTimeout(() => {
    $('btn-exit-spectator').classList.add('fade-out')
  }, 3000)
}

function exitSpectatorMode() {
  isSpectatorMode = false
  clearTimeout(spectatorHideTimeout)
  $('btn-exit-spectator').classList.remove('fade-out')
  $('spectator-mixer').classList.add('hidden')
  showScreen('session')
}

// ── Peer callbacks ───────────────────────────────
function handlePeerJoin(peerId) {
  const name = getPeerName(peerId)
  createPeerCard(peerId, name)
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

function handlePeerName(name, peerId) {
  updatePeerName(peerId, name)
}

function handlePeerRole(role, peerId) {
  if (role === 'spectator') {
    hidePeerCard(peerId)
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
  clearTimeout(spectatorHideTimeout)
  isSpectatorMode = false
  leaveRoom()
  stopAudio()
  stopVideo()
  isMuted = false
  isVideoOn = false
  localStream = null

  // Reset UI
  $('btn-mute').classList.remove('active')
  $('btn-mute').querySelector('.label').textContent = 'Mute'
  $('btn-mute').disabled = false
  $('btn-video').classList.remove('active')
  $('btn-video').querySelector('.label').textContent = 'Video'
  $('local-video').srcObject = null
  $('local-video').classList.add('hidden')
  $('local-card').style.display = ''

  // Remove all peer cards
  const grid = $('peers-grid')
  for (const card of [...grid.querySelectorAll('.peer-card:not(.local)')]) {
    card.remove()
  }
  // Clear spectator grid
  const specGrid = $('spectator-grid')
  if (specGrid) specGrid.innerHTML = ''
  // Clear mixer sliders
  const mixerSliders = $('mixer-sliders')
  if (mixerSliders) mixerSliders.innerHTML = ''
  const specMixerSliders = $('spectator-mixer-sliders')
  if (specMixerSliders) specMixerSliders.innerHTML = ''
}

// ── Populate audio device list ───────────────────
async function populateDevices() {
  try {
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
