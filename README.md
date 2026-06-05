# BandTogether

**Low-latency peer-to-peer band practice in your browser. No servers. No installs.**

Musicians create or join a room with a short code (e.g. `ROCK-42`), and everyone connects directly to each other via WebRTC mesh. Audio is optimized for music — echo cancellation, noise suppression, and auto-gain are all disabled so your instrument dynamics come through clean.

## Features

- **True P2P** — audio/video flows directly between peers, never through a server
- **Zero server hosting** — signaling uses public [Nostr](https://nostr.com/) relays via [Trystero](https://github.com/dmotz/trystero)
- **Music-optimized audio** — 128kbps stereo Opus, no voice processing filters
- **Adaptive video** — up to 1080p @ 60fps, auto-negotiated per webcam/network. Sent as a separate stream so video issues never affect audio
- **Audio always wins** — audio and video use independent WebRTC streams with different priority hints; the browser's bandwidth estimator starves video before audio
- **Latency monitoring** — real-time RTT display per peer (color-coded)
- **Audio level meters** — per-peer and self
- **Room codes** — no accounts, no sign-up, just share a code
- **Works on mobile & desktop** — responsive layout, runs in any modern browser

## How It Works

```
Peer A ←──── Direct WebRTC (audio/video) ────→ Peer B
  ↕                                               ↕
Peer C ←──── Direct WebRTC (audio/video) ────→ Peer D
```

Every peer connects to every other peer (full mesh). Signaling (peer discovery only) happens over public Nostr relays — your media never touches any server.

## Latency Budget

| Segment | Typical |
|---------|---------|
| Mic → browser capture | 3–10ms |
| Opus encode (10ms frame) | 2.5–10ms |
| Network (same city, P2P) | 5–15ms |
| Opus decode | ~1ms |
| Browser → speaker | 3–10ms |
| **Total one-way** | **~15–45ms** |

Same-city connections are tight enough for most band practice. Cross-continent adds ~50-100ms — playable for loose jamming.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Create a room, share the code with your bandmates.

## Build for Production

```bash
npm run build
# Static files in dist/ — deploy anywhere
```

## Limitations

- **Mesh topology** caps at ~4–6 peers (perfect for a band, not an orchestra)
- **No TURN server** by default — ~10-15% of connections behind strict NATs may fail
- **Browser audio stack** adds ~10-20ms vs. native apps (Jamulus, SonoBUS)
- **Cross-continent**: >80ms one-way — workable for loose timing, not tight sync

## Tech Stack

- [Trystero](https://github.com/dmotz/trystero) — serverless WebRTC signaling
- [Vite](https://vitejs.dev/) — build tooling
- WebRTC — peer-to-peer media transport
- Web Audio API — metering and low-latency audio context

## License

MIT
