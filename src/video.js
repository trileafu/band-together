/**
 * Video capture — adaptive up to 1080p@60fps.
 * Audio and video are always sent as separate streams so video issues
 * never affect audio quality or latency.
 */

let videoStream = null

const VIDEO_CONSTRAINTS = {
  width: { ideal: 1920, max: 1920 },
  height: { ideal: 1080, max: 1080 },
  frameRate: { ideal: 60, max: 60 },
}

/**
 * Start video capture. The browser will negotiate the best resolution
 * and framerate the webcam and system can handle.
 * Returns the video track (or null on failure).
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
