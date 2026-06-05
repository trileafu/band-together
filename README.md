# BandTogether

**Low-latency peer-to-peer band practice in your browser. No servers. No installs.**

BandTogether lets musicians jam together online with the lowest possible latency. Create or join a room with a simple 6-digit code, and everyone connects directly to each other via WebRTC mesh. Audio is optimized for music — echo cancellation, noise suppression, and auto-gain are all disabled so your instrument dynamics come through clean and unprocessed.

**[Try it live →](https://dist-vzmrglus.devinapps.com)**

---

## Features

### Core
- **True P2P** — audio/video flows directly between peers, never through a server
- **Zero server hosting** — signaling uses public [Nostr](https://nostr.com/) relays via [Trystero](https://github.com/dmotz/trystero)
- **Music-optimized audio** — stereo Opus with configurable bitrate (128/192/256/320 kbps), no voice processing filters
- **Configurable sample rates** — 44.1 kHz, 48 kHz, 96 kHz, or 192 kHz (hardware-dependent)
- **Adaptive video** — up to 1080p @ 60fps, auto-negotiated per webcam and network conditions
- **Separate audio & video streams** — independent WebRTC streams with priority hints; the browser starves video before audio, so even if video bricks, audio stays smooth

### Collaboration
- **Peer naming** — enter your name before joining (e.g. "Guitar - Alex", "Drums - Sam"), displayed on all peer cards and in the mixer
- **Room codes** — simple 6-digit numeric codes, no accounts or sign-up required
- **Personal mixer** — per-peer volume faders (0–200%) on every client, routed through Web Audio API GainNodes for independent volume control
- **Latency monitoring** — real-time RTT display per peer, color-coded (green/yellow/red)
- **Audio level meters** — per-peer and self, driven by Web Audio API analysers

### Spectator & Streaming
- **Spectator mode** — join as a spectator to listen and watch without sending audio; spectators are hidden from the band member grid
- **Fullscreen view** — clean, overlay-free layout designed for OBS window capture and livestreaming
- **Responsive auto-layout** — CSS Grid adapts tile arrangement based on peer count and screen orientation (portrait screens stack vertically)
- **Floating mixer** — press <kbd>M</kbd> to toggle a floating mixer overlay in fullscreen view
- **Auto-hiding controls** — exit button fades after 3 seconds, reappears on mouse movement
- **Keyboard shortcuts** — <kbd>Esc</kbd> to exit fullscreen, <kbd>M</kbd> to toggle mixer

## How It Works

```
Peer A ←──── Direct WebRTC (audio + video) ────→ Peer B
  ↕                                                  ↕
Peer C ←──── Direct WebRTC (audio + video) ────→ Peer D
```

Every peer connects to every other peer (full mesh). Signaling (peer discovery only) happens over public Nostr relays — your media never touches any server. Names, roles, and latency pings are exchanged via Trystero data channels.

## Latency Budget

| Segment | Typical |
|---------|---------|
| Mic → browser capture | 3–10 ms |
| Opus encode (10 ms frame) | 2.5–10 ms |
| Network (same city, P2P) | 5–15 ms |
| Opus decode | ~1 ms |
| Browser → speaker | 3–10 ms |
| **Total one-way** | **~15–45 ms** |

Same-city connections are tight enough for most band practice. Cross-continent adds ~50–100 ms — playable for loose jamming.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5174` in your browser. Create a room, share the 6-digit code with your bandmates.

## Build for Production

```bash
npm run build
# Static files in dist/ — deploy anywhere (Vercel, Netlify, S3, etc.)
```

## Tech Stack

- [Trystero](https://github.com/dmotz/trystero) (Nostr strategy) — serverless WebRTC signaling via public relays
- [Vite](https://vitejs.dev/) — build tooling and dev server
- [Lucide](https://lucide.dev/) — clean SVG icon set
- [Inter](https://rsms.me/inter/) — typeface
- WebRTC — peer-to-peer media transport with separate audio/video streams
- Web Audio API — per-peer GainNode routing, audio metering, and analyser nodes

## Architecture

```
src/
├── main.js      # Entry point — wires up UI, audio, video, room, mixer, spectator
├── room.js      # Trystero room management, peer discovery, name/role broadcasting
├── audio.js     # getUserMedia audio capture, muting, metering
├── video.js     # getUserMedia video capture with adaptive constraints
├── latency.js   # RTT measurement via Trystero data channels
├── ui.js        # DOM manipulation — peer cards, mixer sliders, spectator tiles
└── icons.js     # Lucide icon rendering
```

## Limitations

- **Mesh topology** caps at ~4–6 peers (perfect for a band, not an orchestra)
- **No TURN server** by default — ~10–15% of connections behind strict NATs may fail to establish
- **Browser audio stack** adds ~10–20 ms vs. native apps (Jamulus, SonoBus)
- **Cross-continent**: >80 ms one-way — workable for loose timing, not tight sync
- **192 kHz sample rate** depends on hardware support — browser will negotiate down if the audio interface doesn't support it

## Credits

Built by **[Devin](https://devin.ai)** (by Cognition AI, powered by Claude Opus 4) for **[@trileafu](https://github.com/trileafu)**.

## License

MIT
