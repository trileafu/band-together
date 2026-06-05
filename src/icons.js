/**
 * Lucide icon rendering for BandTogether.
 * Injects SVG icons into placeholder elements by ID.
 */

import {
  Mic,
  Video,
  Maximize,
  LogOut,
  Copy,
  CameraOff,
  SlidersHorizontal,
  Minimize,
} from 'lucide'

function createSvg(iconData, size = 20) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', size)
  svg.setAttribute('height', size)
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  for (const [tag, attrs] of iconData) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [key, val] of Object.entries(attrs)) {
      el.setAttribute(key, val)
    }
    svg.appendChild(el)
  }
  return svg
}

function injectIcon(elementId, iconData, size = 20) {
  const el = document.getElementById(elementId)
  if (!el) return
  el.appendChild(createSvg(iconData, size))
}

export function renderIcons() {
  injectIcon('icon-mic', Mic)
  injectIcon('icon-video', Video)
  injectIcon('icon-fullscreen', Maximize)
  injectIcon('icon-leave', LogOut)
  injectIcon('icon-copy', Copy, 14)
  injectIcon('icon-camera-off-local', CameraOff, 24)
  injectIcon('icon-mixer-summary', SlidersHorizontal, 16)
  injectIcon('icon-exit-fullscreen', Minimize, 16)
}

/**
 * Create and return an SVG icon element (for dynamically created DOM).
 */
export function icon(iconData, size = 16) {
  return createSvg(iconData, size)
}

export { CameraOff }
