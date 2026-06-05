/**
 * UI helpers — DOM manipulation, peer cards, meters, mixer, spectator view.
 */

import { getLevel, createRemoteAnalyser } from './audio.js'
import { getLatency, getLatencyClass } from './latency.js'
import { icon, CameraOff } from './icons.js'

const remoteAnalysers = new Map()  // peerId -> analyser
const peerGainNodes = new Map()    // peerId -> GainNode
const peerAudioCtxs = new Map()    // peerId -> { ctx, source, gain }

/**
 * Create a peer card element for a remote peer.
 */
export function createPeerCard(peerId, name) {
  const card = document.createElement('div')
  card.className = 'peer-card'
  card.id = `peer-${peerId}`
  card.innerHTML = `
    <div class="peer-video-wrap">
      <video autoplay playsinline></video>
      <div class="no-video-label">
        <span class="no-video-icon"></span>
        <span>Camera Off</span>
      </div>
    </div>
    <div class="peer-info">
      <span class="peer-name">${name || `Peer ${peerId.slice(0, 6)}`}</span>
      <div class="meter-wrap">
        <div class="meter-bar"></div>
      </div>
      <span class="peer-latency"></span>
    </div>
  `
  // Inject Lucide CameraOff icon
  const iconHolder = card.querySelector('.no-video-icon')
  if (iconHolder) iconHolder.appendChild(icon(CameraOff, 24))

  document.getElementById('peers-grid').appendChild(card)

  // Also create spectator tile
  createSpectatorTile(peerId, name)
  // Add mixer slider
  addMixerSlider(peerId, name)
  return card
}

/**
 * Update a peer's displayed name.
 */
export function updatePeerName(peerId, name) {
  const card = document.getElementById(`peer-${peerId}`)
  if (card) {
    card.querySelector('.peer-name').textContent = name
  }
  const tile = document.getElementById(`spec-${peerId}`)
  if (tile) {
    const label = tile.querySelector('.spec-name')
    if (label) label.textContent = name
  }
  const slider = document.getElementById(`mixer-${peerId}`)
  if (slider) {
    const label = slider.querySelector('.mixer-label')
    if (label) label.textContent = name
  }
  const specSlider = document.getElementById(`spec-mixer-${peerId}`)
  if (specSlider) {
    const label = specSlider.querySelector('.mixer-label')
    if (label) label.textContent = name
  }
}

/**
 * Hide a peer card from the member grid (spectators shouldn't be listed).
 * Audio still flows, only the visual card is hidden.
 */
export function hidePeerCard(peerId) {
  const card = document.getElementById(`peer-${peerId}`)
  if (card) card.style.display = 'none'
}

/**
 * Remove a peer card from the DOM.
 */
export function removePeerCard(peerId) {
  const card = document.getElementById(`peer-${peerId}`)
  if (card) card.remove()
  remoteAnalysers.delete(peerId)
  const audioCtxInfo = peerAudioCtxs.get(peerId)
  if (audioCtxInfo) {
    peerAudioCtxs.delete(peerId)
    peerGainNodes.delete(peerId)
  }
  const tile = document.getElementById(`spec-${peerId}`)
  if (tile) tile.remove()
  const slider = document.getElementById(`mixer-${peerId}`)
  if (slider) slider.remove()
  const specSlider = document.getElementById(`spec-mixer-${peerId}`)
  if (specSlider) specSlider.remove()
}

/**
 * Attach an incoming stream to a peer card.
 * Routes audio through a GainNode for per-peer volume control.
 */
export function attachStreamToPeer(stream, peerId) {
  const card = document.getElementById(`peer-${peerId}`)
  if (!card) return

  const hasAudio = stream.getAudioTracks().length > 0
  const hasVideo = stream.getVideoTracks().length > 0

  if (hasAudio) {
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    const source = ctx.createMediaStreamSource(stream)
    const gain = ctx.createGain()
    gain.gain.value = 1.0
    const dest = ctx.createMediaStreamDestination()

    source.connect(gain)
    gain.connect(dest)

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.5
    source.connect(analyser)
    remoteAnalysers.set(peerId, analyser)

    peerGainNodes.set(peerId, gain)
    peerAudioCtxs.set(peerId, { ctx, source, gain, dest })

    let audioEl = card.querySelector('audio')
    if (!audioEl) {
      audioEl = document.createElement('audio')
      audioEl.autoplay = true
      audioEl.playsInline = true
      card.appendChild(audioEl)
    }
    audioEl.srcObject = dest.stream

    audioEl.play().catch(() => {
      document.addEventListener('click', () => audioEl.play(), { once: true })
    })

    const tile = document.getElementById(`spec-${peerId}`)
    if (tile) {
      let specAudio = tile.querySelector('audio')
      if (!specAudio) {
        specAudio = document.createElement('audio')
        specAudio.autoplay = true
        specAudio.playsInline = true
        tile.appendChild(specAudio)
      }
      specAudio.srcObject = dest.stream
      specAudio.play().catch(() => {})
    }
  }

  if (hasVideo) {
    const videoEl = card.querySelector('video')
    videoEl.srcObject = stream
    videoEl.classList.remove('hidden')
    card.querySelector('.no-video-label').style.display = 'none'

    const tile = document.getElementById(`spec-${peerId}`)
    if (tile) {
      const specVideo = tile.querySelector('video')
      if (specVideo) {
        specVideo.srcObject = stream
        specVideo.classList.remove('hidden')
        const noVideoLabel = tile.querySelector('.spec-no-video')
        if (noVideoLabel) noVideoLabel.style.display = 'none'
      }
    }
  }
}

/**
 * Attach a video track to a peer card.
 */
export function attachVideoToPeer(track, stream, peerId) {
  const card = document.getElementById(`peer-${peerId}`)
  if (card) {
    const videoEl = card.querySelector('video')
    videoEl.srcObject = stream
    videoEl.classList.remove('hidden')
    card.querySelector('.no-video-label').style.display = 'none'
  }
  const tile = document.getElementById(`spec-${peerId}`)
  if (tile) {
    const specVideo = tile.querySelector('video')
    if (specVideo) {
      specVideo.srcObject = stream
      specVideo.classList.remove('hidden')
      const noVideoLabel = tile.querySelector('.spec-no-video')
      if (noVideoLabel) noVideoLabel.style.display = 'none'
    }
  }
}

// ── Mixer ──────────────────────────────────────

export function setPeerVolume(peerId, volume) {
  const gain = peerGainNodes.get(peerId)
  if (gain) {
    gain.gain.value = volume
  }
}

function addMixerSlider(peerId, name) {
  const displayName = name || `Peer ${peerId.slice(0, 6)}`
  const sliderHtml = `
    <div class="mixer-row" id="mixer-${peerId}">
      <span class="mixer-label">${displayName}</span>
      <input type="range" min="0" max="200" value="100" class="mixer-slider"
             data-peer="${peerId}" />
      <span class="mixer-value">100%</span>
    </div>
  `
  const container = document.getElementById('mixer-sliders')
  if (container) container.insertAdjacentHTML('beforeend', sliderHtml)

  const specContainer = document.getElementById('spectator-mixer-sliders')
  if (specContainer) {
    const specSliderHtml = `
      <div class="mixer-row" id="spec-mixer-${peerId}">
        <span class="mixer-label">${displayName}</span>
        <input type="range" min="0" max="200" value="100" class="mixer-slider"
               data-peer="${peerId}" />
        <span class="mixer-value">100%</span>
      </div>
    `
    specContainer.insertAdjacentHTML('beforeend', specSliderHtml)
  }

  document.querySelectorAll(`.mixer-slider[data-peer="${peerId}"]`).forEach(slider => {
    slider.addEventListener('input', e => {
      const val = parseInt(e.target.value, 10)
      setPeerVolume(peerId, val / 100)
      document.querySelectorAll(`.mixer-slider[data-peer="${peerId}"]`).forEach(s => {
        s.value = val
        s.closest('.mixer-row').querySelector('.mixer-value').textContent = `${val}%`
      })
    })
  })
}

// ── Spectator View ─────────────────────────────

function createSpectatorTile(peerId, name) {
  const tile = document.createElement('div')
  tile.className = 'spec-tile'
  tile.id = `spec-${peerId}`
  tile.innerHTML = `
    <video autoplay playsinline></video>
    <div class="spec-no-video">No Video</div>
    <div class="spec-name">${name || `Peer ${peerId.slice(0, 6)}`}</div>
  `
  const grid = document.getElementById('spectator-grid')
  if (grid) grid.appendChild(tile)
}

/**
 * Update all meter bars and latency displays. Call on rAF loop.
 */
export function updateMeters(localLevel, peerIds) {
  updateMeter(document.getElementById('local-meter'), localLevel)

  for (const peerId of peerIds) {
    const card = document.getElementById(`peer-${peerId}`)
    if (!card) continue

    const analyser = remoteAnalysers.get(peerId)
    const level = analyser ? getLevel(analyser) : 0
    const meterBar = card.querySelector('.meter-bar')
    updateMeter(meterBar, level)

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
  const pct = Math.min(level * 100 * 2.5, 100)
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
