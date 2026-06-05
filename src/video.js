/**
 * Video capture — secondary to audio, low quality by design.
 */

let videoStream = null

const VIDEO_CONSTRAINTS = {
  width: { ideal: 320 },
  height: { ideal: 240 },
  frameRate: { ideal: 15, max: 15 },
}

/**
 * Start video capture. Returns the video track (or null on failure).
 */
export async function startVideo() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: VIDEO_CONSTRAINTS,
      audio: false,
    })
    return videoStream.getVideoTracks()[0] || null
  } catch (err) {
    console.warn('Video capture failed:', err.message)
    return null
  }
}

/**
 * Stop video capture.
 */
export function stopVideo() {
  if (videoStream) {
    for (const track of videoStream.getTracks()) track.stop()
    videoStream = null
  }
}

/**
 * Get the current video stream.
 */
export function getVideoStream() {
  return videoStream
}
