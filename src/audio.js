/**
 * Audio capture and metering — optimized for music (not voice).
 */

let audioCtx = null
let localStream = null
let localAnalyser = null

const MUSIC_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
}

/**
 * Get audio-only stream with music-optimized constraints.
 */
export async function getAudioStream(deviceId, channels = 2, sampleRate = 48000) {
  const constraints = {
    audio: {
      ...MUSIC_CONSTRAINTS,
      channelCount: channels,
      sampleRate,
      ...(deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}),
    },
    video: false,
  }

  localStream = await navigator.mediaDevices.getUserMedia(constraints)

  // Set up AudioContext for metering
  audioCtx = new AudioContext({ latencyHint: 'interactive', sampleRate })
  const source = audioCtx.createMediaStreamSource(localStream)
  localAnalyser = audioCtx.createAnalyser()
  localAnalyser.fftSize = 256
  localAnalyser.smoothingTimeConstant = 0.5
  source.connect(localAnalyser)

  return localStream
}

/**
 * Get the current audio level (0-1) from the local mic.
 */
export function getLocalLevel() {
  if (!localAnalyser) return 0
  const data = new Uint8Array(localAnalyser.frequencyBinCount)
  localAnalyser.getByteFrequencyData(data)
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i]
  return sum / (data.length * 255)
}

/**
 * Create an analyser for a remote peer's audio stream.
 */
export function createRemoteAnalyser(stream) {
  if (!audioCtx) {
    audioCtx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 })
  }
  const source = audioCtx.createMediaStreamSource(stream)
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.5
  source.connect(analyser)
  return analyser
}

/**
 * Get level from a remote analyser.
 */
export function getLevel(analyser) {
  if (!analyser) return 0
  const data = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(data)
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i]
  return sum / (data.length * 255)
}

/**
 * Mute / unmute the local audio track.
 */
export function setMuted(muted) {
  if (!localStream) return
  for (const track of localStream.getAudioTracks()) {
    track.enabled = !muted
  }
}

/**
 * List available audio input devices.
 */
export async function listAudioInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter(d => d.kind === 'audioinput')
}

/**
 * Stop all local tracks and close the AudioContext.
 */
export function stopAudio() {
  if (localStream) {
    for (const track of localStream.getTracks()) track.stop()
    localStream = null
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
  localAnalyser = null
}
